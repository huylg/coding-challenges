---
name: testing-strategy
overview: Define a detailed testing strategy for server and client, and document it in the master plan and AI collaboration guide.
todos: []
isProject: false
---

# Testing Strategy Update

## Context

- Add a detailed testing strategy section to [`/.cursor/plans/MASTER_PLAN.md`](/Users/huy.ly/personal/coding-challenges/.cursor/plans/MASTER_PLAN.md) replacing the current brief bullets under `## Testing approach`.
- Add a matching testing strategy section to [`AI_COLLABORATION.md`](/Users/huy.ly/personal/coding-challenges/AI_COLLABORATION.md).
- Base server test cases on WebSocket join/answer flows and SQLite leaderboard logic in [`server/src/index.ts`](/Users/huy.ly/personal/coding-challenges/server/src/index.ts), [`server/src/quiz_service.ts`](/Users/huy.ly/personal/coding-challenges/server/src/quiz_service.ts), [`server/src/db.ts`](/Users/huy.ly/personal/coding-challenges/server/src/db.ts), [`server/src/models.ts`](/Users/huy.ly/personal/coding-challenges/server/src/models.ts).
- Base client test cases on state management and UI flows in [`client/lib/data/quiz_view_model.dart`](/Users/huy.ly/personal/coding-challenges/client/lib/data/quiz_view_model.dart), [`client/lib/data/ws_client.dart`](/Users/huy.ly/personal/coding-challenges/client/lib/data/ws_client.dart), [`client/lib/models/quiz_models.dart`](/Users/huy.ly/personal/coding-challenges/client/lib/models/quiz_models.dart), [`client/lib/ui/quiz_screen.dart`](/Users/huy.ly/personal/coding-challenges/client/lib/ui/quiz_screen.dart), [`client/lib/ui/leaderboard_widget.dart`](/Users/huy.ly/personal/coding-challenges/client/lib/ui/leaderboard_widget.dart).

## Proposed content to add

- **Server test suite layout**
- Unit tests: DB helpers, scoring, leaderboard ordering.
- Integration tests: WebSocket join/answer flows, error handling, broadcasts.
- **Server detailed test cases**
- Message parsing/validation; quiz mismatch; invalid types; parse errors.
- Score increment rules; leaderboard ordering (score desc, joined_at asc).
- Session tracking and cleanup on disconnect.
- **Client test suite layout**
- Unit tests: model parsing, WebSocket client, ViewModel logic.
- Widget tests: status banner, join section, answer section, leaderboard widget.
- (Optional) integration test: full join/answer flow.
- **Client detailed test cases**
- ViewModel: validation, state transitions, reconnect backoff, message handling.
- UI: visibility toggles, interaction wiring, accessibility labels.

## Deliverable

- Updated `## Testing approach` section in `MASTER_PLAN.md` with a structured test suite outline and explicit test case list for both server and client.
- Updated `AI_COLLABORATION.md` with the same testing strategy section for shared guidance.

## Notes

- Keep it concise but detailed; use bullet lists for test cases and suite layout.
- No code changes; documentation-only update in the plan document.
