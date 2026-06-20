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

// GET /api/decks —— 获取牌组列表
// ?subscribed=1 仅返回已订阅/拥有的牌组（用于仪表盘）；否则管理员看全部，普通用户看自己的 + 已订阅的
decksRouter.get('/decks', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === 'admin';
    const subscribedOnly = req.query.subscribed === '1';
    const today = todayLocal();
    const now = nowISO();

    // 参数构建辅助：push 一个值并返回其占位符（$N），避免手动维护编号
    const params: unknown[] = [];
    const p = (v: unknown) => `$${params.push(v)}`;

    // 所有每牌组派生字段（new_count / due_count / 今日已学 / 封面回退）
    // 全部用相关子查询在 SQL 端一次性算出，消除原先 Promise.all 中的 2N 次查询。
    const newCountP = p(userId);
    const dueUserP = p(userId);
    const dueNowP = p(now);
    const learnedUserP = p(userId);
    const learnedDateP = p(today);
    const usJoinP = p(userId);

    let whereClause: string;
    if (subscribedOnly) {
      whereClause = `us.user_id = ${p(userId)}`;
    } else {
      const ownerP = p(userId);
      const subP = p(userId);
      const adminP = p(isAdmin);
      whereClause = `(d.user_id = ${ownerP} OR us.user_id = ${subP} OR ${adminP})`;
    }

    const { rows } = await db.query(
      `SELECT DISTINCT d.id, d.name, d.card_count, d.daily_new_card_limit, d.daily_review_limit, d.created_at, d.updated_at,
        md.published_at,
        COALESCE(md.cover_image, (
          SELECT image_url FROM cards
            WHERE deck_id = d.id AND image_url != '' ORDER BY created_at ASC LIMIT 1
        ), '') AS cover_image,
        COALESCE((
          SELECT COUNT(*) FROM cards c
            LEFT JOIN user_card_progress ucp ON ucp.user_id = ${newCountP} AND ucp.card_id = c.id
            WHERE c.deck_id = d.id AND (ucp.card_id IS NULL OR ucp.interval = 0)
        ), 0) AS new_count,
        COALESCE((
          SELECT COUNT(*) FROM cards c
            INNER JOIN user_card_progress ucp ON ucp.card_id = c.id AND ucp.user_id = ${dueUserP}
            WHERE c.deck_id = d.id AND ucp.interval > 0 AND ucp.next_review <= ${dueNowP}
        ), 0) AS due_count,
        COALESCE((
          SELECT new_cards_learned FROM daily_stats
            WHERE user_id = ${learnedUserP} AND date = ${learnedDateP} AND deck_id = d.id
        ), 0) AS learned_today
        FROM decks d
        LEFT JOIN marketplace_decks md ON md.deck_id = d.id
        LEFT JOIN user_subscriptions us ON us.deck_id = d.id AND us.user_id = ${usJoinP}
        WHERE ${whereClause}
        ORDER BY d.created_at DESC`,
      params
    );
    const rawRows = rows as Array<{
      id: string;
      name: string;
      card_count: number;
      daily_new_card_limit: number;
      daily_review_limit: number;
      new_count: number;
      due_count: number;
      learned_today: number;
      cover_image: string | null;
      published_at: string | null;
      created_at: string;
      updated_at: string;
    }>;

    // 今日可学新卡 = min(牌组 new_count, daily_new_card_limit - 今日已学)
    const result = rawRows.map((d) => {
      const remainingByLimit = Math.max(0, d.daily_new_card_limit - (d.learned_today ?? 0));
      const newAvailableToday = Math.min(d.new_count, remainingByLimit);
      return { ...d, new_available_today: newAvailableToday, cover_image: d.cover_image || '' };
    });

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
    const isAdmin = req.user!.role === 'admin';

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const db = getDb();
    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND (user_id = $2 OR $3)', [id, req.user!.userId, isAdmin])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    await db.query('UPDATE decks SET name = $1, updated_at = $2 WHERE id = $3 AND (user_id = $4 OR $5)', [name.trim(), now, id, req.user!.userId, isAdmin]);

    const deckResult = await db.query('SELECT id, name, card_count, daily_new_card_limit, daily_review_limit, created_at, updated_at FROM decks WHERE id = $1', [id]);
    res.json(deckResult.rows[0]);
  } catch (err) {
    console.error('PUT /decks/:id error:', err);
    res.status(500).json({ error: 'Failed to update deck' });
  }
});

// DELETE /api/decks/:id —— 删除牌组（级联删除卡片和图片文件，仅管理员）
decksRouter.delete('/decks/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = (await db.query('SELECT id FROM decks WHERE id = $1', [id])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 删除图片文件
      const cards = (await client.query('SELECT image_url FROM cards WHERE deck_id = $1', [id])).rows as Array<{ image_url: string }>;
      const uploadsDir = getUploadsDir();
      for (const card of cards) {
        if (card.image_url) {
          const filename = card.image_url.replace('/uploads/', '');
          const filePath = path.join(uploadsDir, filename);
          try { fs.unlinkSync(filePath); } catch { /* 文件可能已不存在 */ }
        }
      }

      await client.query('DELETE FROM daily_stats WHERE deck_id = $1', [id]);
      await client.query('DELETE FROM marketplace_decks WHERE deck_id = $1', [id]);
      await client.query('DELETE FROM user_subscriptions WHERE deck_id = $1', [id]);
      await client.query(
        'DELETE FROM user_card_progress WHERE card_id IN (SELECT id FROM cards WHERE deck_id = $1)',
        [id]
      );
      await client.query('DELETE FROM study_sessions WHERE deck_id = $1', [id]);
      await client.query('DELETE FROM cards WHERE deck_id = $1', [id]);
      await client.query('DELETE FROM decks WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
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
    const isAdmin = req.user!.role === 'admin';
    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND (user_id = $2 OR $3)', [id, req.user!.userId, isAdmin])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    await db.query('UPDATE decks SET card_count = $1, updated_at = $2 WHERE id = $3 AND (user_id = $4 OR $5)', [count, now, id, req.user!.userId, isAdmin]);

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
    const isAdmin = req.user!.role === 'admin';

    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND (user_id = $2 OR $3)', [id, req.user!.userId, isAdmin])).rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const now = nowISO();
    const deleteResult = await db.query(
      `DELETE FROM user_card_progress
       WHERE user_id = $1
         AND card_id IN (SELECT id FROM cards WHERE deck_id = $2)`,
      [req.user!.userId, id]
    );

    await db.query(
      `UPDATE cards SET ease = 2.5, interval = 0, repetitions = 0,
                        next_review = $1, last_review = NULL, updated_at = $2
       WHERE deck_id = $3`,
      [now, now, id]
    );

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
    const isAdmin = req.user!.role === 'admin';

    const existing = (await db.query('SELECT id FROM decks WHERE id = $1 AND (user_id = $2 OR $3)', [id, req.user!.userId, isAdmin])).rows[0];
    if (!existing) { res.status(404).json({ error: 'Deck not found' }); return; }

    const now = nowISO();
    if (typeof daily_new_card_limit === 'number') {
      await db.query('UPDATE decks SET daily_new_card_limit = $1, updated_at = $2 WHERE id = $3 AND (user_id = $4 OR $5)',
        [Math.max(1, Math.round(daily_new_card_limit)), now, id, req.user!.userId, isAdmin]);
    }
    if (typeof daily_review_limit === 'number') {
      await db.query('UPDATE decks SET daily_review_limit = $1, updated_at = $2 WHERE id = $3 AND (user_id = $4 OR $5)',
        [Math.max(1, Math.round(daily_review_limit)), now, id, req.user!.userId, isAdmin]);
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

