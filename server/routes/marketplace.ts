import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

export const marketplaceRouter = Router();

/** 生成 ISO 8601 时间戳 */
function nowISO(): string {
  return new Date().toISOString();
}

/** 本地日期 YYYY-MM-DD */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/marketplace/decks —— 列出市场牌组
// Query: ?style=&calligrapher=&search=
marketplaceRouter.get('/marketplace/decks', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const style = (req.query.style as string | undefined) || '';
    const calligrapher = (req.query.calligrapher as string | undefined) || '';
    const search = (req.query.search as string | undefined) || '';

    let sql = `
      SELECT md.deck_id, md.calligrapher, md.dynasty, md.style, md.description, md.cover_image,
             md.featured, md.sort_order, md.published_at, md.created_at,
             d.name, d.card_count, d.daily_new_card_limit, d.daily_review_limit,
             EXISTS(SELECT 1 FROM user_subscriptions us WHERE us.user_id = ? AND us.deck_id = md.deck_id) AS is_subscribed
      FROM marketplace_decks md
      JOIN decks d ON d.id = md.deck_id
      WHERE 1=1
    `;
    const params: unknown[] = [userId];

    if (style) {
      sql += ' AND md.style = ?';
      params.push(style);
    }
    if (calligrapher) {
      sql += ' AND md.calligrapher = ?';
      params.push(calligrapher);
    }
    if (search) {
      sql += ' AND (d.name LIKE ? OR md.description LIKE ? OR md.calligrapher LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY md.featured DESC, md.sort_order ASC, md.published_at DESC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    console.error('GET /marketplace/decks error:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace decks' });
  }
});

// GET /api/marketplace/decks/:deckId —— 单个市场牌组详情
marketplaceRouter.get('/marketplace/decks/:deckId', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();
    const userId = req.user!.userId;

    const row = db.prepare(
      `SELECT md.deck_id, md.calligrapher, md.dynasty, md.style, md.description, md.cover_image,
              md.featured, md.sort_order, md.published_at, md.created_at,
              d.name, d.card_count, d.daily_new_card_limit, d.daily_review_limit,
              EXISTS(SELECT 1 FROM user_subscriptions us WHERE us.user_id = ? AND us.deck_id = md.deck_id) AS is_subscribed
       FROM marketplace_decks md
       JOIN decks d ON d.id = md.deck_id
       WHERE md.deck_id = ?`
    ).get(userId, deckId);

    if (!row) {
      res.status(404).json({ error: 'Marketplace deck not found' });
      return;
    }

    res.json(row);
  } catch (err) {
    console.error('GET /marketplace/decks/:deckId error:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace deck' });
  }
});

// POST /api/marketplace/decks/:deckId/subscribe —— 订阅
marketplaceRouter.post('/marketplace/decks/:deckId/subscribe', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();
    const userId = req.user!.userId;

    // 验证牌组在市场中存在
    const exists = db.prepare('SELECT deck_id FROM marketplace_decks WHERE deck_id = ?').get(deckId);
    if (!exists) {
      res.status(404).json({ error: 'Marketplace deck not found' });
      return;
    }

    db.prepare(
      'INSERT OR IGNORE INTO user_subscriptions (user_id, deck_id, subscribed_at) VALUES (?, ?, ?)'
    ).run(userId, deckId, nowISO());

    res.json({ success: true, deck_id: deckId });
  } catch (err) {
    console.error('POST /marketplace/decks/:deckId/subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// DELETE /api/marketplace/decks/:deckId/subscribe —— 退订（同时清理进度）
marketplaceRouter.delete('/marketplace/decks/:deckId/subscribe', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();
    const userId = req.user!.userId;

    const unsubscribe = db.transaction(() => {
      db.prepare('DELETE FROM user_subscriptions WHERE user_id = ? AND deck_id = ?').run(userId, deckId);
      db.prepare(
        `DELETE FROM user_card_progress WHERE user_id = ?
          AND card_id IN (SELECT id FROM cards WHERE deck_id = ?)`
      ).run(userId, deckId);
    });
    unsubscribe();

    res.json({ success: true, deck_id: deckId });
  } catch (err) {
    console.error('DELETE /marketplace/decks/:deckId/subscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/marketplace/subscriptions —— 当前用户已订阅的市场牌组列表
marketplaceRouter.get('/marketplace/subscriptions', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const today = todayLocal();

    const rows = db.prepare(
      `SELECT d.id, d.name, d.card_count, d.daily_new_card_limit, d.daily_review_limit,
              d.created_at, d.updated_at,
              md.calligrapher, md.dynasty, md.style, md.description, md.cover_image,
              us.subscribed_at,
              COALESCE((
                SELECT COUNT(*) FROM cards c
                  LEFT JOIN user_card_progress ucp ON ucp.user_id = ? AND ucp.card_id = c.id
                  WHERE c.deck_id = d.id AND (ucp.card_id IS NULL OR ucp.interval = 0)
              ), 0) AS new_count
       FROM user_subscriptions us
       JOIN decks d ON d.id = us.deck_id
       LEFT JOIN marketplace_decks md ON md.deck_id = us.deck_id
       WHERE us.user_id = ?
       ORDER BY us.subscribed_at DESC`
    ).all(userId, userId) as Array<{
      id: string;
      name: string;
      card_count: number;
      daily_new_card_limit: number;
      daily_review_limit: number;
      created_at: string;
      updated_at: string;
      new_count: number;
    }>;

    // 计算 new_available_today（与 GET /decks 一致的逻辑）
    const result = rows.map((d) => {
      const ds = db.prepare(
        `SELECT new_cards_learned FROM daily_stats
         WHERE user_id = ? AND date = ? AND deck_id = ?`
      ).get(userId, today, d.id) as { new_cards_learned: number } | undefined;
      const learnedToday = ds?.new_cards_learned ?? 0;
      const remainingByLimit = Math.max(0, d.daily_new_card_limit - learnedToday);
      const newAvailableToday = Math.min(d.new_count, remainingByLimit);
      return { ...d, new_available_today: newAvailableToday };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /marketplace/subscriptions error:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// POST /api/marketplace/decks/:deckId/publish —— Admin 发布牌组到市场
marketplaceRouter.post('/marketplace/decks/:deckId/publish', requireAdmin, (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组存在
    const deck = db.prepare('SELECT id FROM decks WHERE id = ?').get(deckId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const {
      calligrapher = '',
      dynasty = '',
      style = '',
      description = '',
      cover_image = '',
      featured = 0,
    } = req.body;

    const now = nowISO();
    db.prepare(
      `INSERT OR REPLACE INTO marketplace_decks
        (deck_id, calligrapher, dynasty, style, description, cover_image, featured, sort_order, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      deckId,
      typeof calligrapher === 'string' ? calligrapher : '',
      typeof dynasty === 'string' ? dynasty : '',
      typeof style === 'string' ? style : '',
      typeof description === 'string' ? description : '',
      typeof cover_image === 'string' ? cover_image : '',
      typeof featured === 'boolean' ? (featured ? 1 : 0) : (typeof featured === 'number' ? (featured ? 1 : 0) : 0),
      now,
      now
    );

    const row = db.prepare('SELECT * FROM marketplace_decks WHERE deck_id = ?').get(deckId);
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /marketplace/decks/:deckId/publish error:', err);
    res.status(500).json({ error: 'Failed to publish deck' });
  }
});

// PUT /api/marketplace/decks/:deckId —— Admin 编辑市场元数据
marketplaceRouter.put('/marketplace/decks/:deckId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    const existing = db.prepare('SELECT deck_id FROM marketplace_decks WHERE deck_id = ?').get(deckId);
    if (!existing) {
      res.status(404).json({ error: 'Marketplace deck not found' });
      return;
    }

    const {
      calligrapher,
      dynasty,
      style,
      description,
      cover_image,
      featured,
      sort_order,
    } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (calligrapher !== undefined) {
      updates.push('calligrapher = ?');
      values.push(typeof calligrapher === 'string' ? calligrapher : '');
    }
    if (dynasty !== undefined) {
      updates.push('dynasty = ?');
      values.push(typeof dynasty === 'string' ? dynasty : '');
    }
    if (style !== undefined) {
      updates.push('style = ?');
      values.push(typeof style === 'string' ? style : '');
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(typeof description === 'string' ? description : '');
    }
    if (cover_image !== undefined) {
      updates.push('cover_image = ?');
      values.push(typeof cover_image === 'string' ? cover_image : '');
    }
    if (featured !== undefined) {
      updates.push('featured = ?');
      values.push(featured ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(typeof sort_order === 'number' ? sort_order : 0);
    }

    if (updates.length > 0) {
      values.push(deckId);
      db.prepare(`UPDATE marketplace_decks SET ${updates.join(', ')} WHERE deck_id = ?`).run(...values);
    }

    const row = db.prepare('SELECT * FROM marketplace_decks WHERE deck_id = ?').get(deckId);
    res.json(row);
  } catch (err) {
    console.error('PUT /marketplace/decks/:deckId error:', err);
    res.status(500).json({ error: 'Failed to update marketplace deck' });
  }
});

// DELETE /api/marketplace/decks/:deckId/publish —— Admin 下架
marketplaceRouter.delete('/marketplace/decks/:deckId/publish', requireAdmin, (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    const info = db.prepare('DELETE FROM marketplace_decks WHERE deck_id = ?').run(deckId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Marketplace deck not found' });
      return;
    }

    res.json({ success: true, deck_id: deckId });
  } catch (err) {
    console.error('DELETE /marketplace/decks/:deckId/publish error:', err);
    res.status(500).json({ error: 'Failed to unpublish deck' });
  }
});
