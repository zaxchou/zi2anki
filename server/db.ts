import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool: pkg.Pool | null = null;
let initPromise: Promise<void> | null = null;

/** 获取 PG 连接池（单例），首次调用时触发异步初始化 */
export function getDb(): pkg.Pool {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'zi2anki',
    user: process.env.PG_USER || 'zi2anki',
    password: process.env.PG_PASSWORD || 'zi2anki_pg_2026',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  initPromise = initDb().catch((err) => {
    console.error('[db] 数据库初始化失败:', err);
    throw err;
  });

  return pool;
}

/** 等待数据库初始化完成（服务启动时调用） */
export async function waitForDb(): Promise<void> {
  getDb();
  if (initPromise) await initPromise;
}

/** 异步数据库初始化：建表 + 迁移 + 创建管理员 */
async function initDb(): Promise<void> {
  const db = pool!;

  // 建表
  await db.query(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      card_count INTEGER DEFAULT 0,
      daily_new_card_limit INTEGER DEFAULT 20,
      daily_review_limit INTEGER DEFAULT 200,
      user_id TEXT DEFAULT '',
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
      user_id TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      user_id TEXT DEFAULT '',
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

  // 索引
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
    CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at);
    CREATE INDEX IF NOT EXISTS idx_ucp_user_due ON user_card_progress(user_id, next_review, interval);
    CREATE INDEX IF NOT EXISTS idx_ucp_user_card ON user_card_progress(card_id);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON study_sessions(user_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_deck ON study_sessions(deck_id);
    CREATE INDEX IF NOT EXISTS idx_subs_user ON user_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subs_deck ON user_subscriptions(deck_id);
    CREATE INDEX IF NOT EXISTS idx_market_featured ON marketplace_decks(featured, sort_order);
    CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
  `);

  // 数据字典迁移：如果本地新增了列，这里用 IF NOT EXISTS 同步到线上
  // 规则：只同步结构（DDL），不同步数据（DML）。数据永远以线上为准。
  await migrateSchema(db);

  // 创建默认管理员
  const { rows: users } = await db.query('SELECT COUNT(*)::int as cnt FROM users');
  if (users[0].cnt === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const adminId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.query(
      'INSERT INTO users (id, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)',
      [adminId, 'admin', hash, 'admin', now]
    );
    console.log('🔐 已创建默认管理员账号 — 用户名: admin, 密码: admin123（请尽快修改）');
  }

  // 迁移：自动发布 decks 到 marketplace_decks
  const { rows: adminRows } = await db.query("SELECT id FROM users WHERE username = 'admin'");
  if (adminRows.length > 0) {
    const adminId = adminRows[0].id;
    const now = new Date().toISOString();
    // 统一 user_id（已有数据的 user_id 归管理员）
    for (const table of ['decks', 'cards', 'study_sessions', 'daily_stats']) {
      await db.query(`UPDATE ${table} SET user_id = $1 WHERE user_id = '' OR user_id IS NULL`, [adminId]);
    }
    // 发布到市场
    const { rows: decks } = await db.query('SELECT id, created_at FROM decks');
    for (const d of decks) {
      await db.query(
        `INSERT INTO marketplace_decks (deck_id, calligrapher, dynasty, style, description, cover_image, featured, sort_order, published_at, created_at)
         VALUES ($1, '', '', '', '', '', 0, 0, $2, $3)
         ON CONFLICT (deck_id) DO NOTHING`,
        [d.id, now, d.created_at || now]
      );
    }
    // 自动订阅
    const { rows: owned } = await db.query('SELECT DISTINCT user_id, id FROM decks WHERE user_id IS NOT NULL AND user_id != $1', ['']);
    for (const d of owned) {
      await db.query(
        'INSERT INTO user_subscriptions (user_id, deck_id, subscribed_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [d.user_id, d.id, now]
      );
    }
  }

  console.log('[db] 数据库初始化完成');
}

/**
 * 数据字典迁移。
 * 本地改了表结构（新增列等）后，通过这里同步到线上。
 * 使用 ALTER TABLE ADD COLUMN IF NOT EXISTS 确保幂等。
 * 只改 DDL，不改 DML —— 数据永远以线上为准。
 */
async function migrateSchema(db: pkg.Pool): Promise<void> {
  // 示例：如果未来要给 cards 表加列：
  // await db.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS new_column TEXT DEFAULT ''`);
  // await db.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS another_col INTEGER DEFAULT 0`);
  //
  // 把新的 ADD COLUMN 语句追加在这里，启动时自动同步到所有环境。
}

/** 上传目录的绝对路径（项目根目录下的 uploads/） */
export function getUploadsDir(): string {
  return path.join(__dirname, '..', 'uploads');
}
