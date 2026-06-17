import { Router, Request, Response } from 'express';
import { getDb, getUploadsDir } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAdmin } from '../middleware/auth.js';

export const decksRouter = Router();

/** 生成 ISO 8601 时间戳 */
function nowISO(): string {
  return new Date().toISOString();
}

/** 本地日期 YYYY-MM-DD（参考 useDashboardStats 写法） */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 生成 UUID */
function uuid(): string {
  return crypto.randomUUID();
}

// GET /api/decks —— 获取当前用户所有牌组（已订阅的市场牌组 + 自己创建的牌组）
decksRouter.get('/decks', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const today = todayLocal();
    const { rows } = await db.query(
      `SELECT DISTINCT d.id, d.name, d.card_count, d.daily_new_card_limit, d.daily_review_limit, d.created_at, d.updated_at,
        md.cover_image,
        COALESCE((
          SELECT COUNT(*) FROM cards c
            LEFT JOIN user_card_progress ucp ON ucp.user_id = $1 AND ucp.card_id = c.id
            WHERE c.deck_id = d.id AND (ucp.card_id IS NULL OR ucp.interval = 0)
        ), 0) AS new_count
        FROM decks d
        LEFT JOIN marketplace_decks md ON md.deck_id = d.id
        LEFT JOIN user_subscriptions us ON us.deck_id = d.id AND us.user_id = $2
        WHERE d.user_id = $3 OR us.user_id = $4
        ORDER BY d.created_at DESC`,
      [userId, userId, userId, userId]
    );
    const rawRows = rows as Array<{
      id: string;
      name: string;
      card_count: number;
      daily_new_card_limit: number;
      daily_review_limit: number;
      new_count: number;
      cover_image: string | null;
      created_at: string;
      updated_at: string;
    }>;

    // 今日可学新卡 = Σ min(牌组 new_count, daily_new_card_limit - 今日已学)
    const result = await Promise.all(rawRows.map(async (d) => {
      const dsResult = await db.query(
        `SELECT new_cards_learned FROM daily_stats
         WHERE user_id = $1 AND date = $2 AND deck_id = $3`,
        [userId, today, d.id]
      );
      const ds = dsResult.rows[0] as { new_cards_learned: number } | undefined;
      const learnedToday = ds?.new_cards_learned ?? 0;
      const remainingByLimit = Math.max(0, d.daily_new_card_limit - learnedToday);
      const newAvailableToday = Math.min(d.new_count, remainingByLimit);

      // 封面图：如果有 market cover_image 则用，否则取牌组第一张卡片的缩略图
      let coverImage = d.cover_image || '';
      if (!coverImage) {
        const imgResult = await db.query(
          `SELECT image_url FROM cards WHERE deck_id = $1 AND image_url != '' ORDER BY created_at ASC LIMIT 1`,
          [d.id]
        );
        if (imgResult.rows.length > 0) {
          coverImage = imgResult.rows[0].image_url;
        }
      }

      return { ...d, new_available_today: newAvailableToday, cover_image: coverImage };
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /decks error:', err);
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

// POST /api/decks —— 创建牌组
decksRouter.post('/decks', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const db = getDb();
    const id = uuid();
    const now = nowISO();

    await db.query(
      'INSERT INTO decks (id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at, user_id) VALUES ($1, $2, 0, 20, 200, $3, $4, $5)',
      [id, name.trim(), now, now, req.user!.userId]
    );

    const deckResult = await db.query('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = $1', [id]);
    res.status(201).json(deckResult.rows[0]);
  } catch (err) {
    console.error('POST /decks error:', err);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

// PUT /api/decks/:id —— 更新牌组名称
decksRouter.put('/decks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const db = getDb();
    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [id, req.user!.userId])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    await db.query('UPDATE decks SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4', [name.trim(), now, id, req.user!.userId]);

    const deckResult = await db.query('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = $1', [id]);
    res.json(deckResult.rows[0]);
  } catch (err) {
    console.error('PUT /decks/:id error:', err);
    res.status(500).json({ error: 'Failed to update deck' });
  }
});

// DELETE /api/decks/:id —— 删除牌组（级联删除卡片和图片文件）
decksRouter.delete('/decks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [id, req.user!.userId])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // 在事务中删除：先删除卡片关联的图片文件，再删除牌组（级联删除卡片和会话）
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 获取该牌组所有有图片的卡片
      const cardsResult = await client.query(
        "SELECT image_url FROM cards WHERE deck_id = $1 AND image_url != ''",
        [id]
      );
      const cards = cardsResult.rows as Array<{ image_url: string }>;

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
      await client.query('DELETE FROM decks WHERE id = $1 AND user_id = $2', [id, req.user!.userId]);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /decks/:id error:', err);
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

// PUT /api/decks/:id/card-count —— 更新卡片计数
decksRouter.put('/decks/:id/card-count', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { count } = req.body;

    if (typeof count !== 'number' || count < 0) {
      res.status(400).json({ error: 'Valid count is required' });
      return;
    }

    const db = getDb();
    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [id, req.user!.userId])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    await db.query('UPDATE decks SET card_count = $1, updated_at = $2 WHERE id = $3 AND user_id = $4', [count, now, id, req.user!.userId]);

    const deckResult = await db.query('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = $1', [id]);
    res.json(deckResult.rows[0]);
  } catch (err) {
    console.error('PUT /decks/:id/card-count error:', err);
    res.status(500).json({ error: 'Failed to update card count' });
  }
});

// PUT /api/decks/:id/reset-progress —— 重置牌组所有卡片到初始状态
decksRouter.put('/decks/:id/reset-progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [id, req.user!.userId])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    // 重置当前用户在该牌组所有卡片上的 SM-2 进度（user_card_progress）
    const deleteResult = await db.query(
      `DELETE FROM user_card_progress
       WHERE user_id = $1
         AND card_id IN (SELECT id FROM cards WHERE deck_id = $2)`,
      [req.user!.userId, id]
    );

    // 同时重置 cards 表的 SM-2 字段（向后兼容，旧字段保留）
    await db.query(
      `UPDATE cards SET ease = 2.5, interval = 0, repetitions = 0,
                        next_review = $1, last_review = NULL, updated_at = $2
       WHERE deck_id = $3`,
      [now, now, id]
    );

    // 同时清除今日统计（避免因旧记录导致新卡数为 0）
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await db.query('DELETE FROM daily_stats WHERE user_id = $1 AND date = $2 AND deck_id = $3', [req.user!.userId, dateStr, id]);

    res.json({ success: true, reset_count: deleteResult.rowCount });
  } catch (err) {
    console.error('PUT /decks/:id/reset-progress error:', err);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
});

// PUT /api/decks/:id/limits —— 更新牌组学习上限
decksRouter.put('/decks/:id/limits', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { daily_new_card_limit, daily_review_limit } = req.body;
    const db = getDb();

    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [id, req.user!.userId])).rows[0];
    if (!existing) { res.status(404).json({ error: 'Deck not found' }); return; }

    const now = nowISO();
    if (typeof daily_new_card_limit === 'number') {
      await db.query('UPDATE decks SET daily_new_card_limit = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
        [Math.max(1, Math.round(daily_new_card_limit)), now, id, req.user!.userId]);
    }
    if (typeof daily_review_limit === 'number') {
      await db.query('UPDATE decks SET daily_review_limit = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
        [Math.max(1, Math.round(daily_review_limit)), now, id, req.user!.userId]);
    }

    const deckResult = await db.query(
      'SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = $1',
      [id]
    );
    res.json(deckResult.rows[0]);
  } catch (err) {
    console.error('PUT /decks/:id/limits error:', err);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});
