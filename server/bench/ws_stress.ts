import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { cpus } from "node:os";
import path from "node:path";
import {
  buildStageResult,
  cleanupSqliteFiles,
  createProcessSampler,
  createTempDbPath,
  DEFAULT_STAGE_DURATION_MS,
  DEFAULT_WARMUP_MS,
  maxSustainableRps,
  parseNumberEnv,
  parseStageRpsEnv,
  parseThresholds,
  printFinal,
  printStage,
  runRpsStage,
  sleep,
  writeOutput,
  type BenchmarkConfig,
  type BenchmarkRunOutput,
  type OperationResult,
} from "./_common";
import type { ClientMessage, ServerMessage } from "../src/models";

type PendingKind = "join" | "answer";
type CompletionType = "question" | "quiz_complete" | "error" | "timeout" | "close";

interface PendingRequest {
  kind: PendingKind;
  startedAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (result: {
    ok: boolean;
    latencyMs: number;
    completion: CompletionType;
  }) => void;
}

interface StressClient {
  id: number;
  username: string;
  socket: WebSocket;
  open: boolean;
  closed: boolean;
  currentQuestionId: string | null;
  pending: PendingRequest | null;
}

const mode = "ws";
const quizId = process.env.STRESS_QUIZ_ID ?? "stress-quiz";
const stageRps = parseStageRpsEnv();
const stageDurationMs = parseNumberEnv(
  "STRESS_STAGE_DURATION_MS",
  DEFAULT_STAGE_DURATION_MS
);
const warmupMs = parseNumberEnv("STRESS_WARMUP_MS", DEFAULT_WARMUP_MS);
const warmupClients = parseNumberEnv("STRESS_WARMUP_CLIENTS", 300);
const maxClients = parseNumberEnv("STRESS_MAX_CLIENTS", 2000);
const concurrency = parseNumberEnv("STRESS_CONCURRENCY", 400);
const joinRatio = parseNumberEnv("STRESS_JOIN_RATIO", 0.1);
const responseTimeoutMs = parseNumberEnv("STRESS_RESPONSE_TIMEOUT_MS", 3000);
const startupTimeoutMs = parseNumberEnv("STRESS_SERVER_START_TIMEOUT_MS", 15000);
const thresholds = parseThresholds();
const dbPath = createTempDbPath(mode);

let clientIdCounter = 0;
let usernameCounter = 0;

const decodeMessage = (raw: string | ArrayBuffer | Buffer | Uint8Array) => {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf-8");
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString("utf-8");
  return raw.toString("utf-8");
};

const chooseOptionId = (questionId: string) => {
  const draw = Math.random();
  if (draw < 0.8) return `${questionId}_b`;
  if (draw < 0.95) return `${questionId}_a`;
  return "";
};

const nextUsername = () =>
  `ws-stress-user-${String((usernameCounter += 1)).padStart(8, "0")}`;

const getFreePort = async () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate free port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });

const waitForServerStart = async (
  processRef: ChildProcess,
  timeoutMs: number
) =>
  new Promise<void>((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(new Error(`Server start timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const onExit = (code: number | null, signal: string | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      reject(
        new Error(`Server exited before startup (code=${code}, signal=${signal})`)
      );
    };

    const onStdout = (chunk: Buffer | string) => {
      if (resolved) return;
      const text = chunk.toString();
      if (text.includes('"event":"server_started"')) {
        resolved = true;
        clearTimeout(timer);
        processRef.off("exit", onExit);
        resolve();
      }
    };

    processRef.on("exit", onExit);
    processRef.stdout?.on("data", onStdout);
  });

const stopServer = async (processRef: ChildProcess) => {
  if (processRef.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (completed) return;
      completed = true;
      processRef.kill("SIGKILL");
      resolve();
    }, 5000);
    processRef.once("exit", () => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve();
    });
    processRef.kill("SIGTERM");
  });
};

const startServer = async (port: number, sqlitePath: string) => {
  const serverDir = path.resolve(process.cwd());
  const child = spawn("bun", ["run", "src/index.ts"], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: sqlitePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr?.on("data", (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      console.error(`[ws-server] ${line}`);
    }
  });

  await waitForServerStart(child, startupTimeoutMs);
  return child;
};

const sendAndWait = async (
  client: StressClient,
  payload: ClientMessage
): Promise<OperationResult & { completion: CompletionType }> => {
  if (!client.open || client.closed || client.pending) {
    return { ok: false, latencyMs: 0, completion: "close" };
  }

  const startedAt = performance.now();
  return new Promise((resolve) => {
    const pending: PendingRequest = {
      kind: payload.type,
      startedAt,
      timeoutId: setTimeout(() => {
        if (client.pending !== pending) {
          return;
        }
        client.pending = null;
        resolve({
          ok: false,
          latencyMs: performance.now() - startedAt,
          completion: "timeout",
        });
      }, responseTimeoutMs),
      resolve: (result) => {
        resolve({
          ok: result.ok,
          latencyMs: result.latencyMs,
          completion: result.completion,
        });
      },
    };

    try {
      client.pending = pending;
      client.socket.send(JSON.stringify(payload));
    } catch {
      clearTimeout(pending.timeoutId);
      client.pending = null;
      resolve({
        ok: false,
        latencyMs: performance.now() - startedAt,
        completion: "close",
      });
    }
  });
};

const createClient = async (url: string, username: string) =>
  new Promise<StressClient>((resolve, reject) => {
    const socket = new WebSocket(url);
    const client: StressClient = {
      id: ++clientIdCounter,
      username,
      socket,
      open: false,
      closed: false,
      currentQuestionId: null,
      pending: null,
    };

    const failOpenTimer = setTimeout(() => {
      reject(new Error("WebSocket open timeout"));
    }, responseTimeoutMs);

    socket.onopen = () => {
      clearTimeout(failOpenTimer);
      client.open = true;
      resolve(client);
    };
    socket.onerror = () => {
      clearTimeout(failOpenTimer);
      if (!client.open) {
        reject(new Error("WebSocket failed to open"));
      }
    };
    socket.onclose = () => {
      client.open = false;
      client.closed = true;
      if (client.pending) {
        const pending = client.pending;
        client.pending = null;
        clearTimeout(pending.timeoutId);
        pending.resolve({
          ok: false,
          latencyMs: performance.now() - pending.startedAt,
          completion: "close",
        });
      }
    };
    socket.onmessage = (event) => {
      const text = decodeMessage(event.data as string | ArrayBuffer | Uint8Array);
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(text) as ServerMessage;
      } catch {
        return;
      }

      if (parsed.type === "question") {
        client.currentQuestionId = parsed.questionId;
      } else if (parsed.type === "quiz_complete") {
        client.currentQuestionId = null;
      }

      if (
        parsed.type !== "question" &&
        parsed.type !== "quiz_complete" &&
        parsed.type !== "error"
      ) {
        return;
      }

      if (!client.pending) {
        return;
      }

      const pending = client.pending;
      client.pending = null;
      clearTimeout(pending.timeoutId);
      pending.resolve({
        ok: parsed.type !== "error",
        latencyMs: performance.now() - pending.startedAt,
        completion: parsed.type,
      });
    };
  });

const closeClient = async (client: StressClient) => {
  if (client.closed) return;
  await new Promise<void>((resolve) => {
    const socket = client.socket;
    const timer = setTimeout(() => resolve(), 1000);
    socket.onclose = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      socket.close();
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
};

export const runWsStress = async () => {
  const startedAt = new Date().toISOString();
  const port = await getFreePort();
  const wsUrl = `ws://127.0.0.1:${port}`;

  await cleanupSqliteFiles(dbPath);
  const server = await startServer(port, dbPath);

  const clients: StressClient[] = [];
  const config: BenchmarkConfig = {
    stageRps,
    stageDurationMs,
    warmupMs,
    thresholds,
    concurrency,
    traffic: `join=${joinRatio},answer=${(1 - joinRatio).toFixed(2)}`,
    dbPath,
  };

  const warmupDelay = warmupClients > 0 ? warmupMs / warmupClients : 0;
  for (let index = 0; index < warmupClients; index += 1) {
    const username = nextUsername();
    const client = await createClient(wsUrl, username);
    const joinResult = await sendAndWait(client, {
      type: "join",
      quizId,
      username,
    });
    if (joinResult.ok) {
      clients.push(client);
    } else {
      await closeClient(client);
    }
    if (warmupDelay > 0) {
      await sleep(warmupDelay);
    }
  }

  const sampler = createProcessSampler();
  const stages = [];

  try {
    for (let index = 0; index < stageRps.length; index += 1) {
      const targetRps = stageRps[index];
      let joinOps = 0;
      let answerOps = 0;
      let timeouts = 0;
      let protocolErrors = 0;
      let createJoinOps = 0;
      let reuseJoinOps = 0;

      const pickAvailableClient = () => {
        if (clients.length === 0) return null;
        for (let tries = 0; tries < 40; tries += 1) {
          const candidate = clients[Math.floor(Math.random() * clients.length)];
          if (candidate && candidate.open && !candidate.closed && !candidate.pending) {
            return candidate;
          }
        }
        return null;
      };

      const runJoin = async (): Promise<OperationResult> => {
        joinOps += 1;
        const username = nextUsername();

        if (clients.length < maxClients) {
          const client = await createClient(wsUrl, username);
          client.username = username;
          const result = await sendAndWait(client, {
            type: "join",
            quizId,
            username,
          });
          if (result.completion === "timeout") {
            timeouts += 1;
          }
          if (result.completion === "error") {
            protocolErrors += 1;
          }
          if (result.ok) {
            createJoinOps += 1;
            clients.push(client);
            return result;
          }
          await closeClient(client);
          return result;
        }

        const client = pickAvailableClient();
        if (!client) {
          return { ok: false, latencyMs: 0 };
        }
        client.username = username;
        const result = await sendAndWait(client, {
          type: "join",
          quizId,
          username,
        });
        if (result.completion === "timeout") {
          timeouts += 1;
        }
        if (result.completion === "error") {
          protocolErrors += 1;
        }
        if (result.ok) {
          reuseJoinOps += 1;
        }
        return result;
      };

      const runAnswer = async (): Promise<OperationResult> => {
        answerOps += 1;
        const client = pickAvailableClient();
        if (!client || !client.currentQuestionId) {
          return runJoin();
        }
        const result = await sendAndWait(client, {
          type: "answer",
          quizId,
          username: client.username,
          questionId: client.currentQuestionId,
          optionId: chooseOptionId(client.currentQuestionId),
        });
        if (result.completion === "timeout") {
          timeouts += 1;
        }
        if (result.completion === "error") {
          protocolErrors += 1;
        }
        return result;
      };

      const totals = await runRpsStage({
        targetRps,
        durationMs: stageDurationMs,
        concurrency,
        operation: async () => {
          if (Math.random() < joinRatio) {
            return runJoin();
          }
          return runAnswer();
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
          createJoinOps,
          reuseJoinOps,
          activeClients: clients.filter((client) => client.open && !client.closed).length,
          timeouts,
          protocolErrors,
        },
      });

      stages.push(stage);
      printStage(mode, stage);
    }
  } finally {
    await Promise.all(clients.map((client) => closeClient(client)));
    await stopServer(server);
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
    config,
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
  await cleanupSqliteFiles(dbPath);
  return { output, outputPath };
};

if (import.meta.main) {
  runWsStress().catch(async (error) => {
    console.error(`[ws] benchmark failed: ${String(error)}`);
    await cleanupSqliteFiles(dbPath);
    process.exit(1);
  });
}
