import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createDatabase } from "../src/db";
import { handleAnswer, handleJoin } from "../src/quiz_service";

let db: Database;

beforeEach(() => {
  db = createDatabase({ dbPath: ":memory:" });
});

afterEach(() => {
  db.close();
});

test("handleJoin creates participant and returns leaderboard", () => {
  const leaderboard = handleJoin(db, "quiz-1", "alice");
  expect(leaderboard).toEqual([
    { username: "alice", score: 0 },
  ]);
});

test("handleJoin is idempotent per user", () => {
  handleJoin(db, "quiz-1", "alice");
  handleJoin(db, "quiz-1", "alice");
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM participants " +
        "WHERE quiz_id = ? AND username = ?"
    )
    .get("quiz-1", "alice") as { count: number };
  expect(row.count).toBe(1);
});

test("handleAnswer increments score for correct answers", () => {
  handleAnswer(db, "quiz-1", "alice", "q1", "42", true);
  handleAnswer(db, "quiz-1", "alice", "q2", "43", true);
  const leaderboard = handleAnswer(
    db,
    "quiz-1",
    "alice",
    "q3",
    "44",
    false
  );
  expect(leaderboard).toEqual([
    { username: "alice", score: 2 },
  ]);
});

test("handleAnswer creates participant for new user", () => {
  const leaderboard = handleAnswer(
    db,
    "quiz-1",
    "bob",
    "q1",
    "42",
    false
  );
  expect(leaderboard).toEqual([
    { username: "bob", score: 0 },
  ]);
});
