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
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      option_text TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS participant_progress (
      quiz_id TEXT NOT NULL,
      username TEXT NOT NULL,
      question_index INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (quiz_id, username),
      FOREIGN KEY (quiz_id) REFERENCES sessions(quiz_id)
    );
  `);
  return db;
};

const QUESTION_COUNT = 100;

export interface QuestionRow {
  id: string;
  prompt: string;
  sortOrder: number;
}

export interface QuestionOptionRow {
  id: string;
  questionId: string;
  optionText: string;
  isCorrect: number;
}

export const seedQuestions = (db: Database) => {
  const row = db.prepare("SELECT COUNT(*) as count FROM questions").get() as
    | { count: number }
    | undefined;
  const count = row?.count ?? 0;
  if (count >= QUESTION_COUNT) {
    return;
  }
  const insertQuestion = db.prepare(
    "INSERT OR IGNORE INTO questions (id, prompt, sort_order) VALUES (?, ?, ?)"
  );
  const insertOption = db.prepare(
    `
      INSERT OR IGNORE INTO question_options
        (id, question_id, option_text, is_correct)
      VALUES
        (?, ?, ?, ?)
    `
  );
  const transaction = db.transaction(() => {
    for (let index = 1; index <= QUESTION_COUNT; index += 1) {
      const questionId = `q${index}`;
      const left = index;
      const right = index + 1;
      const correct = left + right;
      insertQuestion.run(
        questionId,
        `What is ${left} + ${right}?`,
        index - 1
      );
      const options = [
        { suffix: "a", value: correct + 1, isCorrect: 0 },
        { suffix: "b", value: correct, isCorrect: 1 },
        { suffix: "c", value: correct - 1, isCorrect: 0 },
        { suffix: "d", value: correct + 2, isCorrect: 0 },
      ];
      options.forEach((option) => {
        insertOption.run(
          `${questionId}_${option.suffix}`,
          questionId,
          option.value.toString(),
          option.isCorrect
        );
      });
    }
  });
  transaction();
};

export const ensureParticipantProgress = (
  db: Database,
  quizId: string,
  username: string
) => {
  const stmt = db.prepare(
    `
      INSERT OR IGNORE INTO participant_progress
        (quiz_id, username, question_index)
      VALUES
        (?, ?, 0)
    `
  );
  stmt.run(quizId, username);
};

export const getParticipantProgress = (
  db: Database,
  quizId: string,
  username: string
) => {
  const stmt = db.prepare(
    `
      SELECT question_index
      FROM participant_progress
      WHERE quiz_id = ? AND username = ?
    `
  );
  const row = stmt.get(quizId, username) as
    | { question_index: number }
    | undefined;
  return row?.question_index ?? 0;
};

export const advanceParticipantProgress = (
  db: Database,
  quizId: string,
  username: string
) => {
  const update = db.prepare(
    `
      UPDATE participant_progress
      SET question_index = question_index + 1
      WHERE quiz_id = ? AND username = ?
    `
  );
  update.run(quizId, username);
  return getParticipantProgress(db, quizId, username);
};

export const getQuestionCount = (db: Database) => {
  const row = db.prepare("SELECT COUNT(*) as count FROM questions").get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
};

export const getQuestionByIndex = (db: Database, index: number) => {
  const stmt = db.prepare(
    `
      SELECT id, prompt, sort_order
      FROM questions
      ORDER BY sort_order ASC
      LIMIT 1 OFFSET ?
    `
  );
  const row = stmt.get(index) as
    | { id: string; prompt: string; sort_order: number }
    | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    prompt: row.prompt,
    sortOrder: row.sort_order,
  } satisfies QuestionRow;
};

export const getOptionsForQuestion = (
  db: Database,
  questionId: string
): QuestionOptionRow[] => {
  const stmt = db.prepare(
    `
      SELECT id, question_id, option_text, is_correct
      FROM question_options
      WHERE question_id = ?
      ORDER BY id ASC
    `
  );
  const rows = stmt.all(questionId) as Array<{
    id: string;
    question_id: string;
    option_text: string;
    is_correct: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    questionId: row.question_id,
    optionText: row.option_text,
    isCorrect: row.is_correct,
  }));
};

export const isOptionCorrect = (
  db: Database,
  questionId: string,
  optionId: string
) => {
  const stmt = db.prepare(
    `
      SELECT is_correct
      FROM question_options
      WHERE question_id = ? AND id = ?
    `
  );
  const row = stmt.get(questionId, optionId) as
    | { is_correct: number }
    | undefined;
  return row?.is_correct === 1;
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
  const stmt = db.prepare(
    `
      UPDATE participants
      SET score = score + ?
      WHERE quiz_id = ? AND username = ?
      RETURNING score
    `
  );
  const row = stmt.get(delta, quizId, username) as
    | { score: number }
    | undefined;
  return row?.score ?? 0;
};

export const insertAnswer = (
  db: Database,
  quizId: string,
  username: string,
  questionId: string,
  optionId: string,
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
    optionId,
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
