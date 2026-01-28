# Real-Time Vocabulary Quiz

## What is included
- Bun WebSocket server with sqlite persistence.
- Flutter mobile client with join flow and live leaderboard.
- Project documentation in `docs/`.

## Run the server
```bash
cd server
bun install
bun run start
```

## Run the client
```bash
cd client
flutter pub get
flutter run
```

## Manual verification checklist
- Start server and confirm `server_started` log.
- Connect a client and join a quiz session.
- Submit answers and observe leaderboard updates.
- Open a second client and ensure the leaderboard syncs.
