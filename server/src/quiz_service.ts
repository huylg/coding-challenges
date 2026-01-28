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
  getQuestionCount,
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
  const total = getQuestionCount(db);
  if (questionIndex >= total) {
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

const scoreAnswer = (isCorrect: boolean) => (isCorrect ? 1 : 0);

export const handleAnswer = (
  db: Database,
  quizId: string,
  username: string,
  questionId: string,
  optionId: string
): {
  leaderboard: LeaderboardEntry[];
  question: QuestionPayload | null;
  isCorrect: boolean;
} => {
  ensureSession(db, quizId);
  ensureParticipant(db, quizId, username);
  ensureParticipantProgress(db, quizId, username);
  const isCorrect = isOptionCorrect(db, questionId, optionId);
  insertAnswer(db, quizId, username, questionId, optionId, isCorrect);
  const delta = scoreAnswer(isCorrect);
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
