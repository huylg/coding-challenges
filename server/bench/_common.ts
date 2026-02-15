import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const DEFAULT_STAGE_RPS = [
  250, 500, 750, 1000, 1250, 1500, 1750, 2000,
];
export const DEFAULT_STAGE_DURATION_MS = 60_000;
export const DEFAULT_WARMUP_MS = 15_000;

export interface StressThresholds {
  maxErrorRate: number;
  maxP95Ms: number;
}

export interface StageLatencySummary {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface StageResult {
  mode: string;
  stage: number;
  targetRps: number;
  actualRps: number;
  total: number;
  ok: number;
  errors: number;
  errorRate: number;
  latencyMs: StageLatencySummary;
  pass: boolean;
  durationMs: number;
  notes?: Record<string, number | string>;
}

export interface ProcessSample {
  rssMbStart: number;
  rssMbEnd: number;
  rssMbPeak: number;
  cpuUserMs: number;
  cpuSystemMs: number;
}

export interface BenchmarkConfig {
  stageRps: number[];
  stageDurationMs: number;
  warmupMs: number;
  thresholds: StressThresholds;
  concurrency: number;
  traffic: string;
  dbPath: string;
}

export interface BenchmarkRunOutput {
  mode: string;
  startedAt: string;
  finishedAt: string;
  maxSustainableRps: number;
  thresholds: StressThresholds;
  config: BenchmarkConfig;
  stages: StageResult[];
  resources: ProcessSample;
  runtime: {
    bunVersion: string;
    platform: string;
    arch: string;
    cpus: number;
  };
}

export interface StageRunTotals {
  total: number;
  ok: number;
  errors: number;
  latenciesMs: number[];
}

export interface OperationResult {
  ok: boolean;
  latencyMs?: number;
}

const toMb = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(2));

const percentile = (sorted: number[], quantile: number) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1)
  );
  return Number(sorted[index].toFixed(2));
};

export const summarizeLatency = (latenciesMs: number[]): StageLatencySummary => {
  if (latenciesMs.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
  };
};

export const parseNumberEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseStageRpsEnv = (
  name = "STRESS_STAGE_RPS",
  fallback = DEFAULT_STAGE_RPS
) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  return parsed.length > 0 ? parsed : fallback;
};

export const parseThresholds = (): StressThresholds => ({
  maxErrorRate: parseNumberEnv("STRESS_SLO_MAX_ERROR_RATE", 0.01),
  maxP95Ms: parseNumberEnv("STRESS_SLO_MAX_P95_MS", 200),
});

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const createTempDbPath = (mode: string) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return path.join(tmpdir(), `quiz-stress-${mode}-${suffix}.sqlite`);
};

const removeIfExists = async (filePath: string) => {
  await rm(filePath, { force: true }).catch(() => undefined);
};

export const cleanupSqliteFiles = async (dbPath: string) => {
  await Promise.all([
    removeIfExists(dbPath),
    removeIfExists(`${dbPath}-wal`),
    removeIfExists(`${dbPath}-shm`),
  ]);
};

export const createProcessSampler = (sampleIntervalMs = 5_000) => {
  const startCpu = process.cpuUsage();
  const startRss = process.memoryUsage().rss;
  let peakRss = startRss;
  const interval = setInterval(() => {
    const current = process.memoryUsage().rss;
    if (current > peakRss) {
      peakRss = current;
    }
  }, sampleIntervalMs);

  return {
    stop: (): ProcessSample => {
      clearInterval(interval);
      const endRss = process.memoryUsage().rss;
      peakRss = Math.max(peakRss, endRss);
      const cpu = process.cpuUsage(startCpu);
      return {
        rssMbStart: toMb(startRss),
        rssMbEnd: toMb(endRss),
        rssMbPeak: toMb(peakRss),
        cpuUserMs: Number((cpu.user / 1000).toFixed(2)),
        cpuSystemMs: Number((cpu.system / 1000).toFixed(2)),
      };
    },
  };
};

const normalizeOutcome = (outcome: boolean | OperationResult) => {
  if (typeof outcome === "boolean") {
    return { ok: outcome, latencyMs: undefined };
  }
  return outcome;
};

export const runRpsStage = async ({
  targetRps,
  durationMs,
  concurrency,
  operation,
}: {
  targetRps: number;
  durationMs: number;
  concurrency: number;
  operation: () => Promise<boolean | OperationResult>;
}): Promise<StageRunTotals> => {
  const latenciesMs: number[] = [];
  let total = 0;
  let ok = 0;
  let errors = 0;
  let scheduled = 0;

  const inFlight = new Set<Promise<void>>();
  const startedAt = performance.now();

  while (performance.now() - startedAt < durationMs) {
    const elapsedMs = performance.now() - startedAt;
    const shouldHaveScheduled = Math.floor((elapsedMs / 1000) * targetRps);

    while (scheduled < shouldHaveScheduled) {
      while (inFlight.size >= concurrency) {
        await Promise.race(inFlight);
      }

      scheduled += 1;
      const launchAt = performance.now();
      const task = (async () => {
        try {
          const outcome = normalizeOutcome(await operation());
          if (outcome.ok) {
            ok += 1;
          } else {
            errors += 1;
          }
          const latency = outcome.latencyMs ?? performance.now() - launchAt;
          latenciesMs.push(latency);
        } catch {
          errors += 1;
          latenciesMs.push(performance.now() - launchAt);
        } finally {
          total += 1;
        }
      })();

      inFlight.add(task);
      task.finally(() => {
        inFlight.delete(task);
      });
    }

    await sleep(2);
  }

  await Promise.all(inFlight);
  return { total, ok, errors, latenciesMs };
};

export const buildStageResult = ({
  mode,
  stage,
  targetRps,
  durationMs,
  totals,
  thresholds,
  notes,
}: {
  mode: string;
  stage: number;
  targetRps: number;
  durationMs: number;
  totals: StageRunTotals;
  thresholds: StressThresholds;
  notes?: Record<string, number | string>;
}): StageResult => {
  const errorRate = totals.total === 0 ? 0 : totals.errors / totals.total;
  const latencyMs = summarizeLatency(totals.latenciesMs);
  const actualRps = Number((totals.total / (durationMs / 1000)).toFixed(2));
  return {
    mode,
    stage,
    targetRps,
    actualRps,
    total: totals.total,
    ok: totals.ok,
    errors: totals.errors,
    errorRate: Number(errorRate.toFixed(4)),
    latencyMs,
    pass:
      errorRate <= thresholds.maxErrorRate &&
      latencyMs.p95 <= thresholds.maxP95Ms,
    durationMs,
    notes,
  };
};

export const maxSustainableRps = (stages: StageResult[]) =>
  stages
    .filter((stage) => stage.pass)
    .reduce((best, stage) => Math.max(best, stage.targetRps), 0);

export const printStage = (mode: string, stage: StageResult) => {
  const status = stage.pass ? "PASS" : "FAIL";
  console.log(
    `[${mode}] stage=${stage.stage} targetRps=${stage.targetRps} ` +
      `actualRps=${stage.actualRps} total=${stage.total} ` +
      `errorRate=${(stage.errorRate * 100).toFixed(2)}% ` +
      `p95=${stage.latencyMs.p95}ms status=${status}`
  );
};

export const printFinal = (output: BenchmarkRunOutput, outputPath: string) => {
  console.log(
    `[${output.mode}] maxSustainableRps=${output.maxSustainableRps} ` +
      `thresholds(error<=${(output.thresholds.maxErrorRate * 100).toFixed(2)}%, ` +
      `p95<=${output.thresholds.maxP95Ms}ms) output=${outputPath}`
  );
};

export const writeOutput = async ({
  mode,
  output,
  dir = path.resolve(process.cwd(), "stress-results"),
}: {
  mode: string;
  output: BenchmarkRunOutput;
  dir?: string;
}) => {
  await mkdir(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(dir, `${timestamp}-${mode}.json`);
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  return outputPath;
};
