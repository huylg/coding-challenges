# Quiz Service Stress Testing Plan

## Summary

First artifact to create:

- `/Users/huy.ly/personal/coding-challenges/docs/plans/QUIZ_SERVICE_STRESS_PLAN.md`

Then execute a two-layer stress benchmark for
`/Users/huy.ly/personal/coding-challenges/server/src/quiz_service.ts` targeting
**sustainable RPS** with:

- `90%` answer / `10%` join traffic
- `60s` stages
- isolated temp SQLite DB
- pass thresholds: error rate `<= 1%`, p95 latency `<= 200ms`

## Public API / Interface Changes

1. `/Users/huy.ly/personal/coding-challenges/server/src/index.ts`

- Add `DB_PATH` env override:
  - `createDatabase({ dbPath: process.env.DB_PATH })`
- Default behavior unchanged when unset.

2. `/Users/huy.ly/personal/coding-challenges/server/package.json`

- Add scripts:
  - `stress:service`
  - `stress:ws`
  - `stress:all`

3. New internal result schema (JSON output)

- Path pattern:
  `/Users/huy.ly/personal/coding-challenges/server/stress-results/<timestamp>-<mode>.json`
- Fields: `mode`, `stage`, `targetRps`, `actualRps`, `total`, `ok`, `errors`,
  `errorRate`, `latencyMs{p50,p95,p99,max}`, `pass`, runtime metadata.

## Implementation Plan

1. Persist this plan doc first at
   `/Users/huy.ly/personal/coding-challenges/docs/plans/QUIZ_SERVICE_STRESS_PLAN.md`.
2. Add shared bench utilities in
   `/Users/huy.ly/personal/coding-challenges/server/bench/_common.ts`:
   - stage runner, percentile math, process stats sampler, temp DB lifecycle.
3. Add service harness in
   `/Users/huy.ly/personal/coding-challenges/server/bench/quiz_service_stress.ts`:
   - direct calls to `handleJoin`/`handleAnswer`, staged RPS ramp.
4. Add WS harness in
   `/Users/huy.ly/personal/coding-challenges/server/bench/ws_stress.ts`:
   - child-process server startup, persistent socket pool, staged message load.
5. Wire scripts in `/Users/huy.ly/personal/coding-challenges/server/package.json`.
6. Emit console summary + JSON metrics, including max sustainable RPS by mode.

## Test Cases and Scenarios

1. Pre-check: run existing tests in
   `/Users/huy.ly/personal/coding-challenges/server/tests`.
2. Service stress stages: verify metric integrity and threshold-based pass/fail.
3. WS stress stages: verify join/answer cycles, timeout/error accounting, clean
   teardown.
4. Overload stage: confirm graceful fail classification (not harness crash).
5. Data checks: `ok + errors == total`, and `p50 <= p95 <= p99 <= max`.

## Assumptions and Defaults

- Runtime: Bun available locally.
- External load tools not required; Bun-native harness only.
- Single-laptop results represent local capacity, not distributed production
  limits.
- Selected defaults locked:
  - Scope: both layers
  - Goal: sustainable RPS
  - DB: isolated temp file
  - Stage length: `60s`
  - Traffic mix: `90%` answer / `10%` join
  - SLO: error `<= 1%`, p95 `<= 200ms`
