import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
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
      daily_new_card_limit INTEGER DEFAULT 20,
      daily_review_limit INTEGER DEFAULT 200,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front_text TEXT NOT NULL,
      back_text TEXT DEFAULT '',
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
      date TEXT NOT NULL,
      user_id TEXT NOT NULL,
      cards_studied INTEGER DEFAULT 0,
      new_cards_learned INTEGER DEFAULT 0,
      PRIMARY KEY (date, user_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL
    );
  `);

  // 迁移：为已有数据库添加 back_text 列
  try { db.exec('ALTER TABLE cards ADD COLUMN back_text TEXT DEFAULT \'\''); } catch { /* 列已存在 */ }
  // 迁移：为已有数据库添加牌组独立上限
  try { db.exec('ALTER TABLE decks ADD COLUMN daily_new_card_limit INTEGER DEFAULT 20'); } catch {}
  try { db.exec('ALTER TABLE decks ADD COLUMN daily_review_limit INTEGER DEFAULT 200'); } catch {}

  // 迁移：为已有数据库添加 user_id 列
  try { db.exec('ALTER TABLE decks ADD COLUMN user_id TEXT'); } catch { /* 列已存在 */ }
  try { db.exec('ALTER TABLE cards ADD COLUMN user_id TEXT'); } catch { /* 列已存在 */ }
  try { db.exec('ALTER TABLE study_sessions ADD COLUMN user_id TEXT'); } catch { /* 列已存在 */ }
  try { db.exec('ALTER TABLE daily_stats ADD COLUMN user_id TEXT'); } catch { /* 列已存在 */ }

  // ⚠️ 必须先创建管理员，再执行数据迁移（已有数据需要 user_id = admin.id）
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
    if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const adminId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(adminId, 'admin', hash, 'admin', now);
    console.log('🔐 已创建默认管理员账号 — 用户名: admin, 密码: admin123（请尽快修改）');
  }

  // 迁移：已有数据的 user_id 统一归管理员
  const adminCheck = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: string } | undefined;
  if (adminCheck) {
    for (const table of ['decks', 'cards', 'study_sessions', 'daily_stats']) {
      db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(adminCheck.id);
    }
  }

  return db;
}

/** 上传目录的绝对路径（项目根目录下的 uploads/） */
export function getUploadsDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
}
