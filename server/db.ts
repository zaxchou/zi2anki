import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

/** 获取数据库实例（单例），首次调用时初始化 */
export function getDb(): Database.Database {
  if (db) return db;

  // 确保 data 目录存在
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 确保 uploads 目录存在（项目根目录）
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'calligraphy.db');
  db = new Database(dbPath);

  // 启用 WAL 模式和外键约束
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      card_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front_text TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      ease REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      last_review TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      cards_studied INTEGER DEFAULT 0,
      ratings_again INTEGER DEFAULT 0,
      ratings_hard INTEGER DEFAULT 0,
      ratings_good INTEGER DEFAULT 0,
      ratings_easy INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      cards_studied INTEGER DEFAULT 0,
      new_cards_learned INTEGER DEFAULT 0
    );
  `);

  return db;
}

/** 上传目录的绝对路径（项目根目录下的 uploads/） */
export function getUploadsDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
}
