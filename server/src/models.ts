export type ClientMessage = JoinMessage | AnswerMessage;

export interface JoinMessage {
  type: "join";
  quizId: string;
  username: string;
}

export interface AnswerMessage {
  type: "answer";
  quizId: string;
  username: string;
  questionId: string;
  optionId: string;
}

export type ServerMessage =
  | JoinedMessage
  | LeaderboardUpdateMessage
  | QuestionMessage
  | QuizCompleteMessage
  | ErrorMessage;

export interface JoinedMessage {
  type: "joined";
  quizId: string;
  username: string;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
}

export interface LeaderboardUpdateMessage {
  type: "leaderboard_update";
  quizId: string;
  leaderboard: LeaderboardEntry[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionMessage {
  type: "question";
  quizId: string;
  questionId: string;
  prompt: string;
  options: QuestionOption[];
}

export interface QuizCompleteMessage {
  type: "quiz_complete";
  quizId: string;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}
