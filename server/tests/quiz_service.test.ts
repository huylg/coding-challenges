import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createDatabase, seedQuestions } from "../src/db";
import { handleAnswer, handleJoin } from "../src/quiz_service";

let db: Database;

beforeEach(() => {
  db = createDatabase({ dbPath: ":memory:" });
  seedQuestions(db);
});

afterEach(() => {
  db.close();
});

test("handleJoin creates participant and returns leaderboard", () => {
  const result = handleJoin(db, "quiz-1", "alice");
  expect(result.leaderboard).toEqual([
    { username: "alice", score: 0 },
  ]);
  expect(result.question?.questionId).toBe("q1");
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
  handleAnswer(db, "quiz-1", "alice", "q1", "q1_b");
  handleAnswer(db, "quiz-1", "alice", "q2", "q2_b");
  const result = handleAnswer(
    db,
    "quiz-1",
    "alice",
    "q3",
    "q3_a"
  );
  expect(result.isCorrect).toBe(false);
  expect(result.leaderboard).toEqual([
    { username: "alice", score: 2 },
  ]);
});

test("handleAnswer creates participant for new user", () => {
  const result = handleAnswer(
    db,
    "quiz-1",
    "bob",
    "q1",
    "q1_a"
  );
  expect(result.leaderboard).toEqual([
    { username: "bob", score: 0 },
  ]);
});
