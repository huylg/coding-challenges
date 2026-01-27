import { Database } from "bun:sqlite";

const DEFAULT_DB_PATH = "quiz.sqlite";

export interface DbConfig {
  dbPath?: string;
}

export const createDatabase = (config: DbConfig = {}) => {
  const db = new Database(config.dbPath ?? DEFAULT_DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      quiz_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id TEXT NOT NULL,
      username TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      UNIQUE (quiz_id, username),
      FOREIGN KEY (quiz_id) REFERENCES sessions(quiz_id)
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id TEXT NOT NULL,
      username TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES sessions(quiz_id)
    );
  `);
  return db;
};

export const ensureSession = (db: Database, quizId: string) => {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO sessions (quiz_id, created_at) VALUES (?, ?)"
  );
  stmt.run(quizId, new Date().toISOString());
};

export const ensureParticipant = (
  db: Database,
  quizId: string,
  username: string
) => {
  const stmt = db.prepare(
    `
      INSERT OR IGNORE INTO participants
        (quiz_id, username, score, joined_at)
      VALUES
        (?, ?, 0, ?)
    `
  );
  stmt.run(quizId, username, new Date().toISOString());
};

export const incrementScore = (
  db: Database,
  quizId: string,
  username: string,
  delta: number
) => {
  const update = db.prepare(
    "UPDATE participants SET score = score + ? WHERE quiz_id = ? AND username = ?"
  );
  update.run(delta, quizId, username);
  const select = db.prepare(
    "SELECT score FROM participants WHERE quiz_id = ? AND username = ?"
  );
  const row = select.get(quizId, username) as { score: number } | undefined;
  return row?.score ?? 0;
};

export const insertAnswer = (
  db: Database,
  quizId: string,
  username: string,
  questionId: string,
  answer: string,
  isCorrect: boolean
) => {
  const stmt = db.prepare(
    `
      INSERT INTO answers
        (quiz_id, username, question_id, answer_text, is_correct, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `
  );
  stmt.run(
    quizId,
    username,
    questionId,
    answer,
    isCorrect ? 1 : 0,
    new Date().toISOString()
  );
};

export interface LeaderboardRow {
  username: string;
  score: number;
}

export const getLeaderboard = (
  db: Database,
  quizId: string
): LeaderboardRow[] => {
  const stmt = db.prepare(
    `
      SELECT username, score
      FROM participants
      WHERE quiz_id = ?
      ORDER BY score DESC, joined_at ASC
    `
  );
  return stmt.all(quizId) as LeaderboardRow[];
};
