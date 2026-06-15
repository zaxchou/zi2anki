import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import crypto from 'node:crypto';

export const studyRouter = Router();

/** 生成 UUID */
function uuid(): string {
  return crypto.randomUUID();
}

/** 生成 ISO 8601 时间戳 */
function nowISO(): string {
  return new Date().toISOString();
}

/** 将数据库行转换为前端 StudySession 格式 */
function rowToSession(row: {
  id: string;
  deck_id: string;
  started_at: string;
  ended_at: string | null;
  cards_studied: number;
  ratings_again: number;
  ratings_hard: number;
  ratings_good: number;
  ratings_easy: number;
}) {
  return {
    id: row.id,
    deck_id: row.deck_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    cards_studied: row.cards_studied,
    ratings: {
      again: row.ratings_again,
      hard: row.ratings_hard,
      good: row.ratings_good,
      easy: row.ratings_easy,
    },
  };
}

// POST /api/study-sessions —— 创建学习会话
studyRouter.post('/study-sessions', (req: Request, res: Response) => {
  try {
    const { deck_id } = req.body;

    if (!deck_id || typeof deck_id !== 'string') {
      res.status(400).json({ error: 'deck_id is required' });
      return;
    }

    const db = getDb();

    // 验证牌组存在且属于当前用户
    const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deck_id, req.user!.userId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const id = uuid();
    const startedAt = req.body.started_at || nowISO();

    db.prepare(
      `INSERT INTO study_sessions (id, deck_id, started_at, ended_at, cards_studied,
                                   ratings_again, ratings_hard, ratings_good, ratings_easy, user_id)
       VALUES (?, ?, ?, NULL, 0, 0, 0, 0, 0, ?)`
    ).run(id, deck_id, startedAt, req.user!.userId);

    const row = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id) as {
      id: string;
      deck_id: string;
      started_at: string;
      ended_at: string | null;
      cards_studied: number;
      ratings_again: number;
      ratings_hard: number;
      ratings_good: number;
      ratings_easy: number;
    };

    res.status(201).json(rowToSession(row));
  } catch (err) {
    console.error('POST /study-sessions error:', err);
    res.status(500).json({ error: 'Failed to create study session' });
  }
});

// PUT /api/study-sessions/:id —— 结束学习会话
studyRouter.put('/study-sessions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM study_sessions WHERE id = ? AND user_id = ?').get(id, req.user!.userId);
    if (!existing) {
      res.status(404).json({ error: 'Study session not found' });
      return;
    }

    const { ended_at, cards_studied, ratings } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (ended_at !== undefined) {
      updates.push('ended_at = ?');
      values.push(ended_at);
    }
    if (cards_studied !== undefined) {
      updates.push('cards_studied = ?');
      values.push(cards_studied);
    }
    if (ratings !== undefined) {
      if (ratings.again !== undefined) {
        updates.push('ratings_again = ?');
        values.push(ratings.again);
      }
      if (ratings.hard !== undefined) {
        updates.push('ratings_hard = ?');
        values.push(ratings.hard);
      }
      if (ratings.good !== undefined) {
        updates.push('ratings_good = ?');
        values.push(ratings.good);
      }
      if (ratings.easy !== undefined) {
        updates.push('ratings_easy = ?');
        values.push(ratings.easy);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE study_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id) as {
      id: string;
      deck_id: string;
      started_at: string;
      ended_at: string | null;
      cards_studied: number;
      ratings_again: number;
      ratings_hard: number;
      ratings_good: number;
      ratings_easy: number;
    };

    res.json(rowToSession(row));
  } catch (err) {
    console.error('PUT /study-sessions/:id error:', err);
    res.status(500).json({ error: 'Failed to update study session' });
  }
});

// GET /api/daily-stats/range —— 获取日期范围统计（必须在 /:date 之前注册）
studyRouter.get('/daily-stats/range', (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      res.status(400).json({ error: 'from and to query params required (YYYY-MM-DD)' });
      return;
    }
    const db = getDb();
    // 跨牌组聚合（用户级查询）
    const rows = db.prepare(
      `SELECT date,
              SUM(cards_studied) as cards_studied,
              SUM(new_cards_learned) as new_cards_learned
       FROM daily_stats WHERE user_id = ? AND date >= ? AND date <= ?
       GROUP BY date ORDER BY date DESC`
    ).all(req.user!.userId, from, to);
    res.json(rows);
  } catch (err) {
    console.error('GET /daily-stats/range error:', err);
    res.status(500).json({ error: 'Failed to fetch stats range' });
  }
});

// GET /api/daily-stats/:date —— 获取指定日期的统计
studyRouter.get('/daily-stats/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const db = getDb();

    const row = db.prepare(
      `SELECT
         COALESCE(SUM(cards_studied), 0) as cards_studied,
         COALESCE(SUM(new_cards_learned), 0) as new_cards_learned
       FROM daily_stats WHERE date = ? AND user_id = ?`
    ).get(date, req.user!.userId) as { cards_studied: number; new_cards_learned: number };

    res.json({ date, cards_studied: row?.cards_studied ?? 0, new_cards_learned: row?.new_cards_learned ?? 0 });
  } catch (err) {
    console.error('GET /daily-stats/:date error:', err);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// PUT /api/daily-stats/:date —— 更新/创建每日统计
studyRouter.put('/daily-stats/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const { cards_studied, new_cards_learned } = req.body;

    const db = getDb();

    // upsert：按 (date, user_id, deck_id) 三元 PK
    const deckId = (req.body.deck_id as string | undefined) || '';
    const existing = db.prepare(
      'SELECT date FROM daily_stats WHERE date = ? AND user_id = ? AND deck_id = ?'
    ).get(date, req.user!.userId, deckId);

    if (existing) {
      db.prepare(
        'UPDATE daily_stats SET cards_studied = ?, new_cards_learned = ? WHERE date = ? AND user_id = ? AND deck_id = ?'
      ).run(cards_studied ?? 0, new_cards_learned ?? 0, date, req.user!.userId, deckId);
    } else {
      db.prepare(
        'INSERT INTO daily_stats (date, user_id, deck_id, cards_studied, new_cards_learned) VALUES (?, ?, ?, ?, ?)'
      ).run(date, req.user!.userId, deckId, cards_studied ?? 0, new_cards_learned ?? 0);
    }

    const row = db.prepare(
      'SELECT date, cards_studied, new_cards_learned FROM daily_stats WHERE date = ? AND user_id = ? AND deck_id = ?'
    ).get(date, req.user!.userId, deckId);

    res.json(row);
  } catch (err) {
    console.error('PUT /daily-stats/:date error:', err);
    res.status(500).json({ error: 'Failed to update daily stats' });
  }
});

// GET /api/due-counts —— 获取所有牌组的到期卡片计数
studyRouter.get('/due-counts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = nowISO();
    const rows = db.prepare(
      `SELECT d.id, d.name, COUNT(c.id) as due_count
       FROM decks d LEFT JOIN cards c ON c.deck_id = d.id AND c.next_review <= ? AND c.interval > 0
       WHERE d.user_id = ?
       GROUP BY d.id, d.name ORDER BY d.created_at DESC`
    ).all(now, req.user!.userId) as { id: string; name: string; due_count: number }[];
    res.json(rows);
  } catch (err) {
    console.error('GET /due-counts error:', err);
    res.status(500).json({ error: 'Failed to fetch due counts' });
  }
});

// GET /api/study-sessions/total —— 累计学习总时长与总会话数
studyRouter.get('/study-sessions/total', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare(
      `SELECT COUNT(*) as total_sessions,
              COALESCE(SUM((julianday(ended_at) - julianday(started_at)) * 24 * 60), 0) as total_minutes
       FROM study_sessions
       WHERE user_id = ? AND ended_at IS NOT NULL`
    ).get(req.user!.userId) as { total_sessions: number; total_minutes: number };
    res.json(row);
  } catch (err) {
    console.error('GET /study-sessions/total error:', err);
    res.status(500).json({ error: 'Failed to fetch study total' });
  }
});
