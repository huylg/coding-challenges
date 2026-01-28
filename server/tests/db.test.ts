import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import {
  createDatabase,
  ensureParticipant,
  ensureSession,
  getLeaderboard,
  incrementScore,
  insertAnswer,
} from "../src/db";

let db: Database;

beforeEach(() => {
  db = createDatabase({ dbPath: ":memory:" });
});

afterEach(() => {
  db.close();
});

test("ensureSession inserts once", () => {
  ensureSession(db, "quiz-1");
  ensureSession(db, "quiz-1");
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE quiz_id = ?"
    )
    .get("quiz-1") as { count: number };
  expect(row.count).toBe(1);
});

test("ensureParticipant inserts once per quiz/user", () => {
  ensureSession(db, "quiz-1");
  ensureParticipant(db, "quiz-1", "alice");
  ensureParticipant(db, "quiz-1", "alice");
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM participants " +
        "WHERE quiz_id = ? AND username = ?"
    )
    .get("quiz-1", "alice") as { count: number };
  expect(row.count).toBe(1);
});

test("incrementScore updates and returns score", () => {
  ensureSession(db, "quiz-1");
  ensureParticipant(db, "quiz-1", "bob");
  const score = incrementScore(db, "quiz-1", "bob", 2);
  expect(score).toBe(2);
});

test("incrementScore returns 0 for missing participant", () => {
  ensureSession(db, "quiz-1");
  const score = incrementScore(db, "quiz-1", "ghost", 1);
  expect(score).toBe(0);
});

test("insertAnswer persists answer with correctness", () => {
  ensureSession(db, "quiz-1");
  ensureParticipant(db, "quiz-1", "alice");
  insertAnswer(db, "quiz-1", "alice", "q1", "42", true);
  const row = db
    .prepare(
      `
      SELECT question_id, answer_text, is_correct
      FROM answers
      WHERE quiz_id = ? AND username = ?
    `
    )
    .get("quiz-1", "alice") as {
    question_id: string;
    answer_text: string;
    is_correct: number;
  };
  expect(row.question_id).toBe("q1");
  expect(row.answer_text).toBe("42");
  expect(row.is_correct).toBe(1);
});

test("getLeaderboard orders by score then join time", () => {
  ensureSession(db, "quiz-1");
  const insert = db.prepare(
    `
      INSERT INTO participants (quiz_id, username, score, joined_at)
      VALUES (?, ?, ?, ?)
    `
  );
  insert.run(
    "quiz-1",
    "alice",
    2,
    "2024-01-01T00:00:00.000Z"
  );
  insert.run(
    "quiz-1",
    "bob",
    2,
    "2024-01-01T00:00:01.000Z"
  );
  insert.run(
    "quiz-1",
    "cory",
    3,
    "2024-01-01T00:00:02.000Z"
  );
  const leaderboard = getLeaderboard(db, "quiz-1");
  expect(leaderboard.map((entry) => entry.username)).toEqual([
    "cory",
    "alice",
    "bob",
  ]);
});
