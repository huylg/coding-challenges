# Real-Time Quiz System Design

## Overview
This system provides a real-time vocabulary quiz experience with live score
updates and a shared leaderboard. A Flutter mobile client connects to a Bun
WebSocket server, which persists sessions and scores in sqlite.

## Architecture diagram
```mermaid
flowchart LR
  Client[Flutter Mobile Client]
  Server[WebSocket Server (Bun)]
  DB[(sqlite)]

  Client <--> Server
  Server --> DB
```

## Components
- Flutter mobile client: join a quiz, submit answers, render live leaderboard.
- Bun WebSocket server: manage sessions, score answers, broadcast updates.
- sqlite database: persist sessions, participants, and answers.

## Data flow
1. User enters server URL, quiz ID, and username in the client.
2. Client opens a WebSocket connection and sends `join`.
3. Server creates/loads session and participant, then broadcasts leaderboard.
4. Client sends `answer` messages with question/answer data.
5. Server records the answer, updates score, and broadcasts a new leaderboard.

## Technology choices
- Flutter (client): fast UI iteration, native performance, declarative widgets.
- Bun (server): lightweight runtime with built-in WebSocket support.
- sqlite (storage): simple persistence for session and score data.

## Scalability, performance, reliability, observability
- Scalability: in-memory connection sets per quiz with persisted scores; a
  shared database or pub/sub layer would be needed for horizontal scaling.
- Performance: leaderboard queries are indexed and ordered; broadcasts send
  only the latest sorted list.
- Reliability: input validation, error messages, and reconnect logic in client.
- Observability: structured JSON logs on the server; extend with metrics for
  connection count and broadcast rate.

## AI collaboration
AI assistance (Cursor AI) was used to draft the server WebSocket flow, the
Flutter UI layout, and the documentation outline. Verification steps included
manual review of message schemas, checking error handling paths, and validating
the join/answer/leaderboard flow against the acceptance criteria.
