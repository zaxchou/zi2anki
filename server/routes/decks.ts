import { Router, Request, Response } from 'express';
import { getDb, getUploadsDir } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const decksRouter = Router();

/** 生成 ISO 8601 时间戳 */
function nowISO(): string {
  return new Date().toISOString();
}

/** 生成 UUID */
function uuid(): string {
  return crypto.randomUUID();
}

// GET /api/decks —— 获取所有牌组
decksRouter.get('/decks', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT d.id, d.name, d.card_count, d.daily_new_card_limit, d.daily_review_limit, d.created_at, d.updated_at,
        COALESCE((SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id AND c.interval = 0), 0) as new_count
        FROM decks d ORDER BY d.created_at DESC`
    ).all() as Array<{
      id: string;
      name: string;
      card_count: number;
      new_count: number;
      created_at: string;
      updated_at: string;
    }>;
    res.json(rows);
  } catch (err) {
    console.error('GET /decks error:', err);
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

// POST /api/decks —— 创建牌组
decksRouter.post('/decks', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const db = getDb();
    const id = uuid();
    const now = nowISO();

    db.prepare(
      'INSERT INTO decks (id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at) VALUES (?, ?, 0, 20, 200, ?, ?)'
    ).run(id, name.trim(), now, now);

    const deck = db.prepare('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = ?').get(id);
    res.status(201).json(deck);
  } catch (err) {
    console.error('POST /decks error:', err);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

// PUT /api/decks/:id —— 更新牌组名称
decksRouter.put('/decks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM decks WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    db.prepare('UPDATE decks SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, id);

    const deck = db.prepare('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = ?').get(id);
    res.json(deck);
  } catch (err) {
    console.error('PUT /decks/:id error:', err);
    res.status(500).json({ error: 'Failed to update deck' });
  }
});

// DELETE /api/decks/:id —— 删除牌组（级联删除卡片和图片文件）
decksRouter.delete('/decks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM decks WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // 在事务中删除：先删除卡片关联的图片文件，再删除牌组（级联删除卡片和会话）
    const deleteDeck = db.transaction(() => {
      // 获取该牌组所有有图片的卡片
      const cards = db.prepare(
        "SELECT image_url FROM cards WHERE deck_id = ? AND image_url != ''"
      ).all(id) as Array<{ image_url: string }>;

      // 删除图片文件
      const uploadsDir = getUploadsDir();
      for (const card of cards) {
        // image_url 格式：/uploads/filename
        const filename = card.image_url.replace(/^\/uploads\//, '');
        const filePath = path.join(uploadsDir, filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // 文件不存在或无法删除，忽略
        }
      }

      // 删除牌组（CASCADE 会删除 cards 和 study_sessions）
      db.prepare('DELETE FROM decks WHERE id = ?').run(id);
    });

    deleteDeck();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /decks/:id error:', err);
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

// PUT /api/decks/:id/card-count —— 更新卡片计数
decksRouter.put('/decks/:id/card-count', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { count } = req.body;

    if (typeof count !== 'number' || count < 0) {
      res.status(400).json({ error: 'Valid count is required' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM decks WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    db.prepare('UPDATE decks SET card_count = ?, updated_at = ? WHERE id = ?').run(count, now, id);

    const deck = db.prepare('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = ?').get(id);
    res.json(deck);
  } catch (err) {
    console.error('PUT /decks/:id/card-count error:', err);
    res.status(500).json({ error: 'Failed to update card count' });
  }
});

// PUT /api/decks/:id/reset-progress —— 重置牌组所有卡片到初始状态
decksRouter.put('/decks/:id/reset-progress', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM decks WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    const info = db.prepare(
      `UPDATE cards SET ease = 2.5, interval = 0, repetitions = 0,
                        next_review = ?, last_review = NULL, updated_at = ?
       WHERE deck_id = ?`
    ).run(now, now, id);

    // 同时清除今日统计（避免因旧记录导致新卡数为 0）
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    db.prepare('DELETE FROM daily_stats WHERE date = ?').run(dateStr);

    res.json({ success: true, reset_count: info.changes });
  } catch (err) {
    console.error('PUT /decks/:id/reset-progress error:', err);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
});

// PUT /api/decks/:id/limits —— 更新牌组学习上限
decksRouter.put('/decks/:id/limits', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { daily_new_card_limit, daily_review_limit } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM decks WHERE id = ?').get(id);
    if (!existing) { res.status(404).json({ error: 'Deck not found' }); return; }

    const now = nowISO();
    if (typeof daily_new_card_limit === 'number') {
      db.prepare('UPDATE decks SET daily_new_card_limit = ?, updated_at = ? WHERE id = ?')
        .run(Math.max(1, Math.round(daily_new_card_limit)), now, id);
    }
    if (typeof daily_review_limit === 'number') {
      db.prepare('UPDATE decks SET daily_review_limit = ?, updated_at = ? WHERE id = ?')
        .run(Math.max(1, Math.round(daily_review_limit)), now, id);
    }

    const deck = db.prepare(
      'SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = ?'
    ).get(id);
    res.json(deck);
  } catch (err) {
    console.error('PUT /decks/:id/limits error:', err);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});
