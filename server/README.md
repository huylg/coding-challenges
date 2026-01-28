## Server (Bun + WebSocket + sqlite)

### Setup
- Install Bun: `https://bun.sh`
- From `server`, install dependencies: `bun install`

### Run
- Start the server: `bun run src/index.ts`
- Expect log output like: `{"event":"server_started","port":3000,...}`

### Tests
- Run all tests: `bun test`

### Manual check
- Connect with any WebSocket client to `ws://localhost:3000`
- Send a join message:
  - `{"type":"join","quizId":"quiz-1","username":"alex"}`
- Send an answer message:
  - `{"type":"answer","quizId":"quiz-1","username":"alex","questionId":"q1","answer":"cat","isCorrect":true}`
- Expect `leaderboard_update` messages with updated scores.
