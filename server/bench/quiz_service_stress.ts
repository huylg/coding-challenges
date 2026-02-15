import { cpus } from "node:os";
import {
  cleanupSqliteFiles,
  createProcessSampler,
  createTempDbPath,
  DEFAULT_STAGE_DURATION_MS,
  DEFAULT_WARMUP_MS,
  parseNumberEnv,
  parseStageRpsEnv,
  parseThresholds,
  printFinal,
  printStage,
  runRpsStage,
  sleep,
  buildStageResult,
  maxSustainableRps,
  writeOutput,
  type BenchmarkConfig,
  type BenchmarkRunOutput,
} from "./_common";
import { createDatabase, getQuestionCount, seedQuestions } from "../src/db";
import { handleAnswer, handleJoin } from "../src/quiz_service";

interface UserState {
  username: string;
  questionIndex: number;
  complete: boolean;
}

const mode = "service";
const quizId = process.env.STRESS_QUIZ_ID ?? "stress-quiz";
const stageRps = parseStageRpsEnv();
const stageDurationMs = parseNumberEnv(
  "STRESS_STAGE_DURATION_MS",
  DEFAULT_STAGE_DURATION_MS
);
const warmupMs = parseNumberEnv("STRESS_WARMUP_MS", DEFAULT_WARMUP_MS);
const warmupUsers = parseNumberEnv("STRESS_WARMUP_USERS", 500);
const concurrency = parseNumberEnv("STRESS_CONCURRENCY", 512);
const joinRatio = parseNumberEnv("STRESS_JOIN_RATIO", 0.1);
const thresholds = parseThresholds();
const dbPath = createTempDbPath(mode);

let userCounter = 0;

const parseQuestionIndex = (questionId: string) => {
  const parsed = Number.parseInt(questionId.replace(/^q/, ""), 10);
  if (Number.isNaN(parsed) || parsed < 1) return 0;
  return parsed - 1;
};

const chooseOptionId = (questionId: string) => {
  const draw = Math.random();
  if (draw < 0.8) return `${questionId}_b`;
  if (draw < 0.95) return `${questionId}_a`;
  return "";
};

const buildConfig = (): BenchmarkConfig => ({
  stageRps,
  stageDurationMs,
  warmupMs,
  thresholds,
  concurrency,
  traffic: `join=${joinRatio},answer=${(1 - joinRatio).toFixed(2)}`,
  dbPath,
});

export const runServiceStress = async () => {
  const startedAt = new Date().toISOString();
  await cleanupSqliteFiles(dbPath);

  const db = createDatabase({ dbPath });
  seedQuestions(db);
  const totalQuestions = getQuestionCount(db);
  const users: UserState[] = [];

  const createUser = () => ({
    username: `stress-user-${String(userCounter += 1).padStart(8, "0")}`,
    questionIndex: 0,
    complete: false,
  });

  const joinUser = (user: UserState) => {
    const result = handleJoin(db, quizId, user.username);
    if (!result.question) {
      user.complete = true;
      return;
    }
    user.complete = false;
    user.questionIndex = parseQuestionIndex(result.question.questionId);
  };

  const answerUser = (user: UserState) => {
    if (user.complete || user.questionIndex >= totalQuestions) {
      user.complete = true;
      return;
    }
    const questionId = `q${user.questionIndex + 1}`;
    const optionId = chooseOptionId(questionId);
    const result = handleAnswer(
      db,
      quizId,
      user.username,
      questionId,
      optionId,
      Date.now() - Math.floor(Math.random() * 8_000)
    );
    if (!result.question) {
      user.complete = true;
      return;
    }
    user.complete = false;
    user.questionIndex = parseQuestionIndex(result.question.questionId);
  };

  const pickAnswerUser = () => {
    if (users.length === 0) return null;
    for (let tries = 0; tries < 25; tries += 1) {
      const candidate = users[Math.floor(Math.random() * users.length)];
      if (candidate && !candidate.complete) {
        return candidate;
      }
    }
    return null;
  };

  const warmupDelay = warmupUsers > 0 ? warmupMs / warmupUsers : 0;
  for (let index = 0; index < warmupUsers; index += 1) {
    const user = createUser();
    joinUser(user);
    users.push(user);
    if (warmupDelay > 0) {
      await sleep(warmupDelay);
    }
  }

  const sampler = createProcessSampler();
  const stages = [];

  for (let index = 0; index < stageRps.length; index += 1) {
    const targetRps = stageRps[index];
    let joinOps = 0;
    let answerOps = 0;

    const totals = await runRpsStage({
      targetRps,
      durationMs: stageDurationMs,
      concurrency,
      operation: async () => {
        const shouldJoin = Math.random() < joinRatio;
        if (shouldJoin) {
          const user = createUser();
          joinUser(user);
          users.push(user);
          joinOps += 1;
          return true;
        }

        const answerUserState = pickAnswerUser();
        if (!answerUserState) {
          const user = createUser();
          joinUser(user);
          users.push(user);
          joinOps += 1;
          return true;
        }

        answerUser(answerUserState);
        answerOps += 1;
        return true;
      },
    });

    const stage = buildStageResult({
      mode,
      stage: index + 1,
      targetRps,
      durationMs: stageDurationMs,
      totals,
      thresholds,
      notes: {
        joinOps,
        answerOps,
        users: users.length,
      },
    });
    stages.push(stage);
    printStage(mode, stage);
  }

  const resources = sampler.stop();
  const finishedAt = new Date().toISOString();
  const output: BenchmarkRunOutput = {
    mode,
    startedAt,
    finishedAt,
    thresholds,
    maxSustainableRps: maxSustainableRps(stages),
    stages,
    config: buildConfig(),
    resources,
    runtime: {
      bunVersion: Bun.version,
      platform: process.platform,
      arch: process.arch,
      cpus: cpus().length,
    },
  };

  const outputPath = await writeOutput({ mode, output });
  printFinal(output, outputPath);

  db.close();
  await cleanupSqliteFiles(dbPath);
  return { output, outputPath };
};

if (import.meta.main) {
  runServiceStress().catch(async (error) => {
    console.error(`[service] benchmark failed: ${String(error)}`);
    await cleanupSqliteFiles(dbPath);
    process.exit(1);
  });
}
