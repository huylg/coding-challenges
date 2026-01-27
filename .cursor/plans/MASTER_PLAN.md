---
name: RealtimeQuizMasterPlan
overview: "Deliver a full-stack real-time quiz system: Bun WebSocket server with sqlite persistence and a Flutter mobile client, plus required design docs and AI-collaboration evidence."
todos:
  - id: design-doc
    content: Draft SYSTEM_DESIGN.md with diagram, flow, AI usage
    status: completed
  - id: server-core
    content: Implement Bun WebSocket server + sqlite persistence
    status: in_progress
  - id: client-core
    content: Implement Flutter mobile client and live leaderboard
    status: pending
  - id: ai-log
    content: Add AI collaboration notes and verification steps
    status: pending
  - id: docs
    content: Add run instructions and test notes
    status: pending
isProject: false
---

# Real-Time Quiz Master Plan

## Scope and deliverables

- System design document with architecture diagram, component descriptions, data flow, tech choices, and AI collaboration narrative.
- Working code for full stack: Bun WebSocket server + sqlite storage + Flutter mobile client.
- Run instructions, test/verification notes, and AI collaboration evidence in code/comments/docs.

## Architecture (high level)

- Components:
- Flutter mobile client: join quiz, send answers, render live leaderboard.
- Bun WebSocket server: session lifecycle, scoring, broadcast leaderboard.
- sqlite storage: persist quiz sessions, participants, answers, scores.
- Data flow:
- Client joins with quiz ID → server validates/creates session → server registers participant → initial leaderboard pushed.
- Client submits answer → server scores → server updates sqlite → server broadcasts leaderboard updates.

## Planned structure (new files)

- Server (Bun): [` `````````/Users/huy.ly/personal/coding-challenges/server/````````` `](/Users/huy.ly/personal/coding-challenges/server/)
- `server/src/index.ts` WebSocket entrypoint, session routing
- `server/src/db.ts` sqlite connection and queries
- `server/src/quiz_service.ts` scoring + leaderboard logic
- `server/src/models.ts` shared types
- `server/README.md` run instructions
- Client (Flutter): [` `````````/Users/huy.ly/personal/coding-challenges/client/````````` `](/Users/huy.ly/personal/coding-challenges/client/)
- `client/lib/main.dart` app entry, routing
- `client/lib/data/ws_client.dart` WebSocket client
- `client/lib/models/quiz_models.dart` data structures
- `client/lib/ui/quiz_screen.dart` join/answer UI
- `client/lib/ui/leaderboard_widget.dart` real-time list
- `client/README.md` run instructions
- Design doc: [` `````````/Users/huy.ly/personal/coding-challenges/SYSTEM_DESIGN.md````````` `](/Users/huy.ly/personal/coding-challenges/SYSTEM_DESIGN.md)
- AI collaboration log: [` `````````/Users/huy.ly/personal/coding-challenges/AI_COLLABORATION.md````````` `](/Users/huy.ly/personal/coding-challenges/AI_COLLABORATION.md)

## Implementation steps

1. **System design doc**

- Draft architecture diagram (Mermaid) + components + data flow + tech choices.
- Add AI collaboration section describing prompts and verification process.

2. **Server (Bun + sqlite)**

- Define WebSocket message schema (join, answer, leaderboard_update, error).
- Implement sqlite schema and persistence (sessions, participants, answers, scores).
- Build scoring and leaderboard update flow with broadcasts.
- Add error handling and observability hooks (structured logs).

3. **Flutter mobile client**

- Create join UI with quiz ID and username.
- Implement WebSocket client and message handling.
- Render live leaderboard with `ListView.builder`.
- Handle connection errors and retries gracefully.

4. **AI collaboration evidence**

- Annotate AI-assisted sections in code/doc with tool, prompt summary, and verification steps.

5. **Run instructions + verification**

- Document setup, run, and simple manual test steps for server and client.

## Key quality considerations

- Scalability: in-memory session cache with periodic persistence; discuss horizontal scale limits.
- Performance: efficient leaderboard updates (delta or sorted list updates).
- Reliability: reconnect handling, input validation, database constraints.
- Maintainability: modular service layer and typed message contracts.
- Observability: structured logging + suggested metrics.

## Testing approach

- Server: lightweight unit tests for scoring and leaderboard ordering.
- Client: manual QA checklist for join, answer, and live updates.

## Mermaid diagram (planned)

- Use a simple `flowchart` showing Client ↔ WebSocket Server ↔ sqlite.

Todos

- design-doc: Draft `SYSTEM_DESIGN.md` with diagram, flow, AI usage
- server-core: Implement Bun WebSocket server + sqlite persistence
- client-core: Implement Flutter mobile client and live leaderboard
- ai-log: Add AI collaboration notes and verification steps
- docs: Add run instructions and test notes
