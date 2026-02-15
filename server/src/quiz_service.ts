import { Database } from "bun:sqlite";
import {
  advanceParticipantProgress,
  ensureParticipant,
  ensureParticipantProgress,
  ensureSession,
  getLeaderboard,
  getOptionsForQuestion,
  getParticipantProgress,
  getQuestionByIndex,
  incrementScore,
  insertAnswer,
  isOptionCorrect,
} from "./db";
import { LeaderboardEntry } from "./models";

export interface QuestionPayload {
  questionId: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
}

const buildQuestionPayload = (
  db: Database,
  questionIndex: number
): QuestionPayload | null => {
  if (questionIndex < 0) {
    return null;
  }
  const question = getQuestionByIndex(db, questionIndex);
  if (!question) {
    return null;
  }
  const options = getOptionsForQuestion(db, question.id).map((option) => ({
    id: option.id,
    text: option.optionText,
  }));
  return {
    questionId: question.id,
    prompt: question.prompt,
    options,
  };
};

export const handleJoin = (
  db: Database,
  quizId: string,
  username: string
): { leaderboard: LeaderboardEntry[]; question: QuestionPayload | null } => {
  ensureSession(db, quizId);
  ensureParticipant(db, quizId, username);
  ensureParticipantProgress(db, quizId, username);
  const leaderboard = getLeaderboard(db, quizId);
  const questionIndex = getParticipantProgress(db, quizId, username);
  const question = buildQuestionPayload(db, questionIndex);
  return { leaderboard, question };
};

export const scoreAnswer = (
  isCorrect: boolean,
  elapsedMs: number,
): number => {
  if (!isCorrect) return 0;
  return elapsedMs <= 5000 ? 2 : 1;
};

export const handleAnswer = (
  db: Database,
  quizId: string,
  username: string,
  questionId: string,
  optionId: string,
  questionSentAt?: number,
): {
  leaderboard: LeaderboardEntry[];
  question: QuestionPayload | null;
  isCorrect: boolean;
} => {
  ensureSession(db, quizId);
  ensureParticipant(db, quizId, username);
  ensureParticipantProgress(db, quizId, username);
  const isCorrect =
    optionId !== "" && isOptionCorrect(db, questionId, optionId);
  insertAnswer(db, quizId, username, questionId, optionId, isCorrect);
  const elapsedMs =
    questionSentAt != null ? Date.now() - questionSentAt : Infinity;
  const delta = scoreAnswer(isCorrect, elapsedMs);
  incrementScore(db, quizId, username, delta);
  const currentIndex = getParticipantProgress(db, quizId, username);
  const currentQuestion = getQuestionByIndex(db, currentIndex);
  let nextIndex = currentIndex;
  if (currentQuestion?.id === questionId) {
    nextIndex = advanceParticipantProgress(db, quizId, username);
  }
  const leaderboard = getLeaderboard(db, quizId);
  const nextQuestion = buildQuestionPayload(db, nextIndex);
  return { leaderboard, question: nextQuestion, isCorrect };
};
