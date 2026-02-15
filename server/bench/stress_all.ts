import { cpus } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runServiceStress } from "./quiz_service_stress";
import { runWsStress } from "./ws_stress";

const outputDir = path.resolve(process.cwd(), "stress-results");

const run = async () => {
  const startedAt = new Date().toISOString();
  const service = await runServiceStress();
  const ws = await runWsStress();
  const finishedAt = new Date().toISOString();

  const summary = {
    mode: "all",
    startedAt,
    finishedAt,
    runtime: {
      bunVersion: Bun.version,
      platform: process.platform,
      arch: process.arch,
      cpus: cpus().length,
    },
    outputs: {
      service: service.outputPath,
      ws: ws.outputPath,
    },
    maxSustainableRps: {
      service: service.output.maxSustainableRps,
      ws: ws.output.maxSustainableRps,
    },
    thresholds: {
      service: service.output.thresholds,
      ws: ws.output.thresholds,
    },
  };

  await mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `${timestamp}-all.json`);
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
  console.log(`[all] output=${outputPath}`);
};

run().catch((error) => {
  console.error(`[all] benchmark failed: ${String(error)}`);
  process.exit(1);
});
