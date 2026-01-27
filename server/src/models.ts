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
  answer: string;
  isCorrect: boolean;
}

export type ServerMessage =
  | JoinedMessage
  | LeaderboardUpdateMessage
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

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}
