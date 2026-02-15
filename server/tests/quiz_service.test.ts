import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { createDatabase, seedQuestions } from "../src/db";
import { handleAnswer, handleJoin, scoreAnswer } from "../src/quiz_service";

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

test("scoreAnswer returns 2 for correct answer within 5 seconds", () => {
  expect(scoreAnswer(true, 3000)).toBe(2);
});

test("scoreAnswer returns 2 for correct answer at exactly 5 seconds", () => {
  expect(scoreAnswer(true, 5000)).toBe(2);
});

test("scoreAnswer returns 1 for correct answer after 5 seconds", () => {
  expect(scoreAnswer(true, 8000)).toBe(1);
});

test("scoreAnswer returns 0 for incorrect answer regardless of time", () => {
  expect(scoreAnswer(false, 2000)).toBe(0);
  expect(scoreAnswer(false, 8000)).toBe(0);
});

test("handleAnswer awards double points for fast correct answer", () => {
  const sentAt = Date.now();
  const result = handleAnswer(
    db,
    "quiz-1",
    "alice",
    "q1",
    "q1_b",
    sentAt
  );
  expect(result.isCorrect).toBe(true);
  expect(result.leaderboard).toEqual([
    { username: "alice", score: 2 },
  ]);
});

test("handleAnswer awards 0 points for empty optionId", () => {
  const result = handleAnswer(
    db,
    "quiz-1",
    "alice",
    "q1",
    ""
  );
  expect(result.isCorrect).toBe(false);
  expect(result.leaderboard).toEqual([
    { username: "alice", score: 0 },
  ]);
  expect(result.question?.questionId).toBe("q2");
});

test("handleAnswer keeps score/progress consistency after one answer", () => {
  const sentAt = Date.now() - 1000;
  const result = handleAnswer(
    db,
    "quiz-1",
    "alice",
    "q1",
    "q1_b",
    sentAt
  );
  expect(result.isCorrect).toBe(true);
  expect(result.leaderboard).toEqual([
    { username: "alice", score: 2 },
  ]);
  expect(result.question?.questionId).toBe("q2");

  const answerRow = db
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
  expect(answerRow.question_id).toBe("q1");
  expect(answerRow.answer_text).toBe("q1_b");
  expect(answerRow.is_correct).toBe(1);

  const progressRow = db
    .prepare(
      `
      SELECT question_index
      FROM participant_progress
      WHERE quiz_id = ? AND username = ?
    `
    )
    .get("quiz-1", "alice") as { question_index: number };
  expect(progressRow.question_index).toBe(1);
});

test("handleAnswer out-of-order wrong answer does not advance progress", () => {
  handleJoin(db, "quiz-1", "alice");
  const result = handleAnswer(
    db,
    "quiz-1",
    "alice",
    "q2",
    "q2_a"
  );
  expect(result.isCorrect).toBe(false);
  expect(result.question?.questionId).toBe("q1");

  const progressRow = db
    .prepare(
      `
      SELECT question_index
      FROM participant_progress
      WHERE quiz_id = ? AND username = ?
    `
    )
    .get("quiz-1", "alice") as { question_index: number };
  expect(progressRow.question_index).toBe(0);
});
