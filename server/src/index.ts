import { createDatabase, seedQuestions } from "./db";
import { handleAnswer, handleJoin } from "./quiz_service";
import type {
  AnswerMessage,
  ClientMessage,
  JoinMessage,
  LeaderboardUpdateMessage,
  QuestionMessage,
  QuizCompleteMessage,
  ServerMessage,
} from "./models";
import type { ServerWebSocket } from "bun";

// AI-assisted section: Cursor AI helped draft the WebSocket lifecycle flow.
// Prompt summary: "Design Bun WebSocket server with sqlite persistence, join,
// answer handling, and leaderboard broadcast." Verified by manual review of
// message validation paths and a dry-run of join/answer flow with JSON samples.

interface ConnectionData {
  quizId?: string;
  username?: string;
}

const db = createDatabase();
seedQuestions(db);
const sessions = new Map<string, Set<ServerWebSocket<ConnectionData>>>();

const logEvent = (event: string, data: Record<string, unknown> = {}) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data,
    })
  );
};

const getSessionSockets = (quizId: string) => {
  const sockets = sessions.get(quizId);
  if (sockets) {
    return sockets;
  }
  const next = new Set<ServerWebSocket<ConnectionData>>();
  sessions.set(quizId, next);
  return next;
};

const attachToSession = (ws: ServerWebSocket<ConnectionData>, quizId: string) =>
  getSessionSockets(quizId).add(ws);

const detachFromSession = (ws: ServerWebSocket<ConnectionData>) => {
  const quizId = ws.data.quizId;
  if (!quizId) {
    return;
  }
  const sockets = sessions.get(quizId);
  if (!sockets) {
    return;
  }
  sockets.delete(ws);
  if (sockets.size === 0) {
    sessions.delete(quizId);
  }
};

const sendMessage = (
  ws: ServerWebSocket<ConnectionData>,
  message: ServerMessage
) => {
  ws.send(JSON.stringify(message));
};

const sendError = (
  ws: ServerWebSocket<ConnectionData>,
  code: string,
  message: string
) => sendMessage(ws, { type: "error", code, message });

const broadcastLeaderboard = (
  quizId: string,
  leaderboard: LeaderboardUpdateMessage["leaderboard"]
) => {
  const sockets = sessions.get(quizId);
  if (!sockets) {
    return;
  }
  const payload: LeaderboardUpdateMessage = {
    type: "leaderboard_update",
    quizId,
    leaderboard,
  };
  const body = JSON.stringify(payload);
  sockets.forEach((socket) => socket.send(body));
};

const sendQuestion = (
  ws: ServerWebSocket<ConnectionData>,
  payload: Omit<QuestionMessage, "type">
) => {
  sendMessage(ws, { type: "question", ...payload });
};

const sendQuizComplete = (
  ws: ServerWebSocket<ConnectionData>,
  quizId: string
) => {
  const payload: QuizCompleteMessage = { type: "quiz_complete", quizId };
  sendMessage(ws, payload);
};

const parseMessage = (raw: string | Uint8Array) => {
  const text =
    typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  const parsed = JSON.parse(text) as ClientMessage;
  return parsed;
};

const isJoinMessage = (message: ClientMessage): message is JoinMessage =>
  message.type === "join" &&
  typeof message.quizId === "string" &&
  typeof message.username === "string";

const isAnswerMessage = (message: ClientMessage): message is AnswerMessage =>
  message.type === "answer" &&
  typeof message.quizId === "string" &&
  typeof message.username === "string" &&
  typeof message.questionId === "string" &&
  typeof message.optionId === "string";

const handleClientMessage = (
  ws: ServerWebSocket<ConnectionData>,
  message: ClientMessage
) => {
  if (isJoinMessage(message)) {
    ws.data.quizId = message.quizId;
    ws.data.username = message.username;
    attachToSession(ws, message.quizId);
    const { leaderboard, question } = handleJoin(
      db,
      message.quizId,
      message.username
    );
    sendMessage(ws, {
      type: "joined",
      quizId: message.quizId,
      username: message.username,
    });
    broadcastLeaderboard(message.quizId, leaderboard);
    if (question) {
      sendQuestion(ws, { quizId: message.quizId, ...question });
    } else {
      sendQuizComplete(ws, message.quizId);
    }
    logEvent("join", { quizId: message.quizId, username: message.username });
    return;
  }

  if (isAnswerMessage(message)) {
    if (ws.data.quizId && ws.data.quizId !== message.quizId) {
      sendError(ws, "quiz_mismatch", "Quiz ID does not match session.");
      return;
    }
    const { leaderboard, question, isCorrect } = handleAnswer(
      db,
      message.quizId,
      message.username,
      message.questionId,
      message.optionId
    );
    broadcastLeaderboard(message.quizId, leaderboard);
    if (question) {
      sendQuestion(ws, { quizId: message.quizId, ...question });
    } else {
      sendQuizComplete(ws, message.quizId);
    }
    logEvent("answer", {
      quizId: message.quizId,
      username: message.username,
      isCorrect,
    });
    return;
  }

  sendError(ws, "invalid_message", "Unsupported message shape.");
};

const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

Bun.serve<ConnectionData>({
  port: PORT,
  fetch(req, server) {
    if (server.upgrade(req, { data: {} })) {
      return;
    }
    return new Response("WebSocket only", { status: 426 });
  },
  websocket: {
    open(ws) {
      logEvent("connection_open", { remote: ws.remoteAddress });
    },
    message(ws, message) {
      try {
        const parsed = parseMessage(message);
        handleClientMessage(ws, parsed);
      } catch (error) {
        sendError(ws, "parse_error", "Invalid JSON payload.");
        logEvent("parse_error", { error: String(error) });
      }
    },
    close(ws) {
      detachFromSession(ws);
      logEvent("connection_close", { quizId: ws.data.quizId });
    },
  },
});

logEvent("server_started", { port: PORT });
