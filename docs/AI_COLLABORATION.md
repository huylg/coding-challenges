# AI Collaboration Log

## Summary

This project used Cursor AI to accelerate system design, server scaffolding,
and Flutter UI composition. The notes below list AI-assisted sections and the
verification steps taken.

## Testing strategy

- Server tests: unit tests for `db.ts` helpers and leaderboard ordering, plus
  integration tests for WebSocket join/answer flows, broadcast updates, and
  error handling (parse errors, quiz mismatch).
- Client tests: unit tests for model parsing, WebSocket client lifecycle, and
  view model state transitions; widget tests for status banner, join/answer
  sections, and leaderboard rendering; optional integration test for full quiz
  flow with reconnect.

## Entries

### Demo video transcript (`docs/conversations/cursor_demo_video_transcript.md`)

- Tool + task: Cursor AI drafted a 7–8 minute demo transcript aligned with the
  assignment requirements and repo artifacts.
- Prompt summary: "Explore docs and generate a demo video transcript."
- Verification: cross-checked the outline against `docs/REQUIREMENT.md`, ensured
  referenced files exist, and verified run/test commands match the repo.

### Bun WebSocket server (`server/src/index.ts`)

- Tool + task: Cursor AI drafted the WebSocket lifecycle and message routing.
- Prompt summary: "Design Bun WebSocket server with sqlite, join/answer
  handling, and leaderboard broadcast."
- Verification: manually reviewed message validation, ran a dry JSON flow for
  join/answer, and checked disconnect cleanup paths.

### Flutter quiz screen (`client/lib/ui/quiz_screen.dart`)

- Tool + task: Cursor AI outlined a screen layout and ChangeNotifier wiring.
- Prompt summary: "Create a Flutter quiz screen with join form, leaderboard,
  and answer submission."
- Verification: validated widget rebuild logic and null-safety of controllers,
  ensured form inputs map to view model methods.

### Documentation (`SYSTEM_DESIGN.md`, `server/README.md`, `client/README.md`)

- Tool + task: Cursor AI structured the system design and run instructions.
- Prompt summary: "Write a concise system design doc with diagram and data
  flow; add setup/run steps."
- Verification: checked documentation against acceptance criteria and repo
  structure, adjusted commands for Bun and Flutter.
