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
      deck_id TEXT NOT NULL DEFAULT '',
      cards_studied INTEGER DEFAULT 0,
      new_cards_learned INTEGER DEFAULT 0,
      PRIMARY KEY (date, user_id, deck_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_decks (
      deck_id TEXT PRIMARY KEY REFERENCES decks(id) ON DELETE CASCADE,
      calligrapher TEXT DEFAULT '',
      dynasty TEXT DEFAULT '',
      style TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_card_progress (
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      ease REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review TEXT NOT NULL,
      last_review TEXT,
      PRIMARY KEY (user_id, card_id)
    );

    CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id TEXT NOT NULL,
      deck_id TEXT NOT NULL,
      subscribed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, deck_id)
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

  // 迁移：daily_stats 增加 deck_id 列（用于按牌组聚合）并把 PK 升级为三元组
  // 旧 PK 是 (date, user_id)，需要先删旧 PK、加 deck_id 默认 ''、重设 PK
  try { db.exec("UPDATE daily_stats SET user_id = '' WHERE user_id IS NULL"); } catch {}
  try {
    const hasDeckCol = db.prepare("PRAGMA table_info(daily_stats)").all().some((c: any) => c.name === 'deck_id');
    if (!hasDeckCol) {
      db.exec("ALTER TABLE daily_stats ADD COLUMN deck_id TEXT NOT NULL DEFAULT ''");
      // 旧 PK 是 (date, user_id)，需要重建表来改 PK
      db.exec(`
        CREATE TABLE daily_stats_new (
          date TEXT NOT NULL,
          user_id TEXT NOT NULL,
          deck_id TEXT NOT NULL DEFAULT '',
          cards_studied INTEGER DEFAULT 0,
          new_cards_learned INTEGER DEFAULT 0,
          PRIMARY KEY (date, user_id, deck_id)
        );
        INSERT INTO daily_stats_new (date, user_id, deck_id, cards_studied, new_cards_learned)
          SELECT date, COALESCE(user_id, ''), '', cards_studied, new_cards_learned FROM daily_stats;
        DROP TABLE daily_stats;
        ALTER TABLE daily_stats_new RENAME TO daily_stats;
      `);
    }
  } catch (e) {
    console.warn('[db] daily_stats deck_id 迁移失败（可忽略）:', e);
  }

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

  // 迁移：把所有现有 decks 自动发布到 marketplace_decks（元数据留空）
  try {
    const now = new Date().toISOString();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO marketplace_decks
        (deck_id, calligrapher, dynasty, style, description, cover_image, featured, sort_order, published_at, created_at)
       VALUES (?, '', '', '', '', '', 0, 0, ?, ?)`
    );
    const decks = db.prepare('SELECT id, created_at FROM decks').all() as Array<{ id: string; created_at: string }>;
    for (const d of decks) {
      ins.run(d.id, now, d.created_at || now);
    }
  } catch (e) {
    console.warn('[db] 自动发布 decks 到 marketplace_decks 失败（可忽略）:', e);
  }

  // 迁移：为所有用户自动订阅他们已有 user_id 的牌组
  try {
    const now = new Date().toISOString();
    const subStmt = db.prepare(
      'INSERT OR IGNORE INTO user_subscriptions (user_id, deck_id, subscribed_at) VALUES (?, ?, ?)'
    );
    const ownedDecks = db.prepare(
      'SELECT DISTINCT user_id, id FROM decks WHERE user_id IS NOT NULL'
    ).all() as Array<{ user_id: string; id: string }>;
    for (const d of ownedDecks) {
      subStmt.run(d.user_id, d.id, now);
    }
  } catch (e) {
    console.warn('[db] 自动订阅用户牌组失败（可忽略）:', e);
  }

  return db;
}

/** 上传目录的绝对路径（项目根目录下的 uploads/） */
export function getUploadsDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
}
