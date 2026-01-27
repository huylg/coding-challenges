import { Database } from "bun:sqlite";
import {
  ensureParticipant,
  ensureSession,
  getLeaderboard,
  incrementScore,
  insertAnswer,
} from "./db";
import { LeaderboardEntry } from "./models";

export const handleJoin = (
  db: Database,
  quizId: string,
  username: string
): LeaderboardEntry[] => {
  ensureSession(db, quizId);
  ensureParticipant(db, quizId, username);
  return getLeaderboard(db, quizId);
};

const scoreAnswer = (isCorrect: boolean) => (isCorrect ? 1 : 0);

export const handleAnswer = (
  db: Database,
  quizId: string,
  username: string,
  questionId: string,
  answer: string,
  isCorrect: boolean
): LeaderboardEntry[] => {
  ensureSession(db, quizId);
  ensureParticipant(db, quizId, username);
  insertAnswer(db, quizId, username, questionId, answer, isCorrect);
  const delta = scoreAnswer(isCorrect);
  incrementScore(db, quizId, username, delta);
  return getLeaderboard(db, quizId);
};
