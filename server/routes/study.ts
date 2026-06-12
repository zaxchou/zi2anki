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

    // 验证牌组存在
    const deck = db.prepare('SELECT id FROM decks WHERE id = ?').get(deck_id);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const id = uuid();
    const startedAt = req.body.started_at || nowISO();

    db.prepare(
      `INSERT INTO study_sessions (id, deck_id, started_at, ended_at, cards_studied,
                                   ratings_again, ratings_hard, ratings_good, ratings_easy)
       VALUES (?, ?, ?, NULL, 0, 0, 0, 0, 0)`
    ).run(id, deck_id, startedAt);

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

    const existing = db.prepare('SELECT id FROM study_sessions WHERE id = ?').get(id);
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

// GET /api/daily-stats/:date —— 获取指定日期的统计
studyRouter.get('/daily-stats/:date', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const db = getDb();

    const row = db.prepare(
      'SELECT date, cards_studied, new_cards_learned FROM daily_stats WHERE date = ?'
    ).get(date) as { date: string; cards_studied: number; new_cards_learned: number } | undefined;

    if (row) {
      res.json(row);
    } else {
      // 返回空统计
      res.json({ date, cards_studied: 0, new_cards_learned: 0 });
    }
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

    db.prepare(
      `INSERT INTO daily_stats (date, cards_studied, new_cards_learned)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         cards_studied = excluded.cards_studied,
         new_cards_learned = excluded.new_cards_learned`
    ).run(date, cards_studied ?? 0, new_cards_learned ?? 0);

    const row = db.prepare(
      'SELECT date, cards_studied, new_cards_learned FROM daily_stats WHERE date = ?'
    ).get(date);

    res.json(row);
  } catch (err) {
    console.error('PUT /daily-stats/:date error:', err);
    res.status(500).json({ error: 'Failed to update daily stats' });
  }
});
