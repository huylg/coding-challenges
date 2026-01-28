# Demo video transcript
_Exported on 1/28/2026 at 13:15:57 GMT+7 from Cursor (2.4.21)_

---

**User**

@docs/REQUIREMENT.md:72-85 Now work on demo:
- Explore @docs/  
- Generate a transript for demo video

---

**Cursor**

Below is a ready-to-read demo video transcript (about 7–8 minutes). It aligns with `docs/REQUIREMENT.md`, references the docs in `docs/`, and calls out the concrete artifacts in this repo.

## Demo Video Transcript (7–8 min)

**0:00–0:30 — Introduction**  
Hi, I’m [Your Name]. I’m presenting my Real-Time Vocabulary Quiz coding challenge submission. I built a Flutter client and a Bun WebSocket server with sqlite persistence, and documented the system design and AI collaboration process in `docs/`.

**0:30–1:15 — Assignment Overview**  
The assignment is to design and implement a real-time quiz component where multiple users can join a quiz session, submit answers, and see a live leaderboard. It also requires documenting AI collaboration and showing verification steps for AI-assisted output.

**1:15–2:30 — Solution Overview (System Design)**  
Here’s the high-level architecture from `docs/SYSTEM_DESIGN.md`.  
A Flutter mobile client connects to a Bun WebSocket server, and the server persists sessions, participants, and answers in sqlite.  
Data flow is:  
1) The client connects and sends a `join` message with quiz ID and username.  
2) The server creates or loads the session and participant, then broadcasts the current leaderboard.  
3) The client sends `answer` messages.  
4) The server scores, stores the answer, and broadcasts updated leaderboard entries.  

Tech choices:  
- Flutter for a fast, declarative, cross-platform client.  
- Bun for a lightweight WebSocket server.  
- sqlite for simple, local persistence.

**2:30–3:30 — Implementation Highlights**  
On the server side:  
- `server/src/index.ts` hosts the WebSocket lifecycle and message routing.  
- `server/src/db.ts` handles sqlite schema and queries.  
- `server/src/quiz_service.ts` manages scoring and leaderboard ordering.  

On the client side:  
- `client/lib/ui/quiz_screen.dart` implements the join form, answer submission, and leaderboard UI.  
- `client/lib/data/ws_client.dart` manages the WebSocket client lifecycle and message parsing.  

The leaderboard updates are broadcast on every answer, so clients stay in sync with real-time standings.

**3:30–4:30 — AI Collaboration Story (Required)**  
I used Cursor AI to speed up initial scaffolding and documentation, and tracked it in `docs/AI_COLLABORATION.md`.  
Examples:  
- Drafted the WebSocket flow and message routing for the server.  
- Outlined the Flutter quiz screen layout and ChangeNotifier wiring.  
- Structured system design and run instructions.  

To ensure quality, correctness, and security, I:  
- Manually reviewed message schemas and error paths.  
- Validated join/answer/leaderboard flows against the acceptance criteria.  
- Planned tests for both server and client, including parse errors, quiz mismatch handling, and leaderboard ordering.  
- Confirmed error handling paths and disconnect cleanup were covered.  

**4:30–6:30 — Demo: Code and App in Action**  
Now I’ll demo the code running.

1) Start the server:  
- `cd server`  
- `bun install`  
- `bun run start`  
I see a `server_started` log, confirming it’s listening.

2) Start the Flutter client:  
- `cd client`  
- `flutter pub get`  
- `flutter run`  

3) Join a quiz:  
- Enter server URL, a quiz ID like `quiz-101`, and a username.  
- Tap Join; the leaderboard renders immediately.

4) Submit an answer:  
- Submit an answer
- The score increments for correct answers and the leaderboard updates live.

5) Open a second client:  
- Join the same quiz with a different username.  
- Submit answers from both clients; the leaderboard stays in sync in real time.

This verifies the real-time session participation, scoring updates, and leaderboard requirements.

**6:30–7:00 — Tests and Verification**  
Server tests are in `server/tests/` and run with `bun test`.  
Client tests are run with `flutter test` or `puro flutter test`.  
The manual checklist in `README.md` confirms the full join → answer → leaderboard flow and multi-client sync.

**7:00–7:30 — Conclusion**  
That’s the full walkthrough. The solution meets real-time participation, scoring, and leaderboard requirements, includes AI collaboration documentation, and is structured for scalability and maintainability.  
Future improvements could include a shared pub/sub layer for horizontal scaling and metrics for deeper observability.  
Thanks for watching.

---

If you want, I can tailor this transcript to your preferred tone or shorten it to exactly 5–6 minutes.

