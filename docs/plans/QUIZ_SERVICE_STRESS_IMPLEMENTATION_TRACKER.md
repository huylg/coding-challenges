# Quiz Service Stress Improvement Implementation Tracker

## Source Plan

This tracker implements the user-approved plan dated 2026-02-15 for:
- Transactional `handleAnswer` write path
- `incrementScore` optimization via `UPDATE ... RETURNING`
- Test additions for score/progress consistency and non-advancing wrong/out-of-order answers
- WS stress rerun with `STRESS_STAGE_RPS=100,150,200`, `STRESS_STAGE_DURATION_MS=15000`, `STRESS_CONCURRENCY=200`, `STRESS_RESPONSE_TIMEOUT_MS=3000`

## Status

- [x] 1. Save plan as project artifact
- [x] 2. Refactor `server/src/quiz_service.ts` transaction boundary
- [x] 3. Update `server/src/db.ts` `incrementScore` to `RETURNING`
- [x] 4. Update/add tests in `server/tests/quiz_service.test.ts`
- [x] 5. Update/add tests in `server/tests/db.test.ts`
- [x] 6. Run unit tests (`bun test`)
- [x] 7. Run WS stress benchmark with required env
- [x] 8. Record before/after stress comparison summary

## Progress Log

- 2026-02-15: Tracker created and implementation started.
- 2026-02-15: Implemented transactional mutation boundary in `handleAnswer`.
- 2026-02-15: Replaced `incrementScore` read-after-write with `UPDATE ... RETURNING`.
- 2026-02-15: Added quiz service and DB tests for consistency, non-advance out-of-order flow, and cumulative score return behavior.
- 2026-02-15: `bun test` passed (23 pass, 0 fail).
- 2026-02-15: Ran required WS stress command; output: `/Users/huy.ly/personal/coding-challenges/server/stress-results/2026-02-15T04-03-02-193Z-ws.json`.
- 2026-02-15: Ran baseline-aligned WS stress (`STRESS_WARMUP_MS=5000`, `STRESS_WARMUP_CLIENTS=100`) for apples-to-apples comparison; output: `/Users/huy.ly/personal/coding-challenges/server/stress-results/2026-02-15T04-04-26-456Z-ws.json`.
- 2026-02-15: Baseline (`03-23-37-403Z`) vs aligned-after (`04-04-26-456Z`) summary:
  - Stage 1: p95 `8.7ms` -> `7.43ms`, error `0` -> `0`.
  - Stage 2: p95 `3167.62ms` -> `3198.06ms`, error `18.59%` -> `19.49%`, timeouts `371` -> `404`.
  - Stage 3: p95 `3192.2ms` -> `3211.77ms`, error `59.65%` -> `59.76%`, timeouts `1277` -> `1234`.
  - `maxSustainableRps` unchanged at `100`.
