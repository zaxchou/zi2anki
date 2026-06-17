import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getDb, getUploadsDir } from '../db.js';

export const cardsRouter = Router();

/** 生成 ISO 8601 时间戳 */
function nowISO(): string {
  return new Date().toISOString();
}

/** 生成 UUID */
function uuid(): string {
  return crypto.randomUUID();
}

/** 判断是否为 base64 data URL */
function isBase64DataUrl(value: string): boolean {
  return value.startsWith('data:');
}

/** 从 base64 data URL 提取扩展名，如 "png" */
function getExtFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
  return match ? match[1].replace('+', '') : 'png';
}

/** 将 base64 data URL 保存为文件，返回 /uploads/filename */
function saveBase64Image(dataUrl: string): string {
  const uploadsDir = getUploadsDir();
  const ext = getExtFromDataUrl(dataUrl);
  const filename = `${uuid()}.${ext}`;
  const filePath = path.join(uploadsDir, filename);

  // 提取 base64 数据部分
  const base64Data = dataUrl.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${filename}`;
}

/** 删除卡片关联的图片文件（如果 image_url 不为空） */
function deleteImageFile(imageUrl: string): void {
  if (!imageUrl || imageUrl.trim() === '') return;
  const uploadsDir = getUploadsDir();
  const filename = imageUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(uploadsDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // 文件不存在或无法删除，忽略
  }
}

// ---- Multer 配置（批量导入用） ----
const batchUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, getUploadsDir());
    },
    filename: (_req, file, cb) => {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const uniqueName = `${uuid()}-${originalName}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

// GET /api/decks/:deckId/cards —— 获取牌组下所有卡片
cardsRouter.get('/decks/:deckId/cards', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组存在且当前用户有权访问（通过订阅或所有权）
    const isOwner = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
    const isSubscribed = db.prepare(
      'SELECT 1 FROM user_subscriptions WHERE user_id = ? AND deck_id = ?'
    ).get(req.user!.userId, deckId);
    if (!isOwner && !isSubscribed) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const cards = db.prepare(
      `SELECT id, deck_id, front_text, back_text, image_url, ease, interval, repetitions,
              next_review, last_review, created_at, updated_at
       FROM cards WHERE deck_id = ? ORDER BY created_at DESC`
    ).all(deckId);

    res.json(cards);
  } catch (err) {
    console.error('GET /decks/:deckId/cards error:', err);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// POST /api/decks/:deckId/cards —— 创建单张卡片
cardsRouter.post('/decks/:deckId/cards', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const { front_text, back_text, image_url } = req.body;

    if (!front_text || typeof front_text !== 'string' || front_text.trim().length === 0) {
      res.status(400).json({ error: 'front_text is required' });
      return;
    }

    const db = getDb();

    // 验证牌组存在且属于当前用户
    const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // 处理图片：base64 data URL → 文件
    let finalImageUrl = '';
    if (image_url && typeof image_url === 'string' && image_url.trim() !== '') {
      if (isBase64DataUrl(image_url)) {
        finalImageUrl = saveBase64Image(image_url);
      } else {
        finalImageUrl = image_url; // 已经是 URL 路径
      }
    }

    const id = uuid();
    const now = nowISO();
    const nextReview = now; // 新卡片立即到期

    const createCard = db.transaction(() => {
      db.prepare(
        `INSERT INTO cards (id, deck_id, front_text, back_text, image_url, ease, interval, repetitions,
                            next_review, last_review, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 2.5, 0, 0, ?, NULL, ?, ?)`
      ).run(id, deckId, front_text.trim(), (back_text || '').trim(), finalImageUrl, nextReview, now, now);

      // 更新牌组卡片计数
      const count = db.prepare('SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ?').get(deckId) as { cnt: number };
      db.prepare('UPDATE decks SET card_count = ?, updated_at = ? WHERE id = ?').run(count.cnt, now, deckId);
    });

    createCard();

    const card = db.prepare(
      `SELECT id, deck_id, front_text, back_text, image_url, ease, interval, repetitions,
              next_review, last_review, created_at, updated_at
       FROM cards WHERE id = ?`
    ).get(id);

    res.status(201).json(card);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('POST /decks/:deckId/cards error:', msg, stack);
    res.status(500).json({ error: `Failed to create card: ${msg}` });
  }
});

// POST /api/decks/:deckId/cards/batch —— 批量导入卡片
cardsRouter.post(
  '/decks/:deckId/cards/batch',
  batchUpload.array('images', 500),
  (req: Request, res: Response) => {
    try {
      const { deckId } = req.params as { deckId: string };
      const db = getDb();

      // 验证牌组存在且属于当前用户
      const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
      if (!deck) {
        // 清理已上传的文件
        const files = req.files as Express.Multer.File[] | undefined;
        if (files) {
          for (const f of files) {
            try { fs.unlinkSync(f.path); } catch { /* ignore */ }
          }
        }
        res.status(404).json({ error: 'Deck not found' });
        return;
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No images uploaded. Use field name "images".' });
        return;
      }

      const now = nowISO();
      const nextReview = now;
      const createdCards: Array<{
        id: string;
        deck_id: string;
        front_text: string;
        image_url: string;
        ease: number;
        interval: number;
        repetitions: number;
        next_review: string;
        last_review: string | null;
        created_at: string;
        updated_at: string;
      }> = [];

      // 在事务中批量创建
      const batchCreate = db.transaction(() => {
        const stmt = db.prepare(
          `INSERT INTO cards (id, deck_id, front_text, back_text, image_url, ease, interval, repetitions,
                              next_review, last_review, created_at, updated_at)
           VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, NULL, ?, ?)`
        );

        for (const file of files) {
          // 文件名去扩展名 → front_text
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const ext = path.extname(originalName);
          const frontText = originalName.slice(0, -ext.length) || originalName;
          const filename = path.basename(file.path);
          const imageUrl = `/uploads/${filename}`;

          const cardId = uuid();
          stmt.run(cardId, deckId, frontText, imageUrl, nextReview, now, now);

          createdCards.push({
            id: cardId,
            deck_id: deckId,
            front_text: frontText,
            image_url: imageUrl,
            ease: 2.5,
            interval: 0,
            repetitions: 0,
            next_review: nextReview,
            last_review: null,
            created_at: now,
            updated_at: now,
          });
        }

        // 更新牌组卡片计数
        const count = db.prepare('SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ?').get(deckId) as { cnt: number };
        db.prepare('UPDATE decks SET card_count = ?, updated_at = ? WHERE id = ?').run(count.cnt, now, deckId);
      });

      batchCreate();

      res.status(201).json({ created: createdCards.length, cards: createdCards });
    } catch (err) {
      console.error('POST /decks/:deckId/cards/batch error:', err);
      res.status(500).json({ error: 'Failed to import cards' });
    }
  }
);

// POST /api/decks/:deckId/cards/batch-text —— 文字批量导入
// 格式：每两行为一张卡片（正面 / 背面），空行分隔
cardsRouter.post('/decks/:deckId/cards/batch-text', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const db = getDb();
    const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // 解析文本：按行分割，过滤空行，每两行为一组
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const created: Array<{ front: string; back: string }> = [];
    const now = nowISO();
    const nextReview = now;

    const batchCreate = db.transaction(() => {
      const stmt = db.prepare(
        `INSERT INTO cards (id, deck_id, front_text, back_text, image_url, ease, interval, repetitions,
                            next_review, last_review, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', 2.5, 0, 0, ?, NULL, ?, ?)`
      );

      for (let i = 0; i < lines.length - 1; i += 2) {
        const front = lines[i];
        const back = lines[i + 1];
        if (!front) continue;
        stmt.run(uuid(), deckId, front, back || '', nextReview, now, now);
        created.push({ front, back: back || '' });
      }

      // 更新计数
      const count = db.prepare('SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ?').get(deckId) as { cnt: number };
      db.prepare('UPDATE decks SET card_count = ?, updated_at = ? WHERE id = ?').run(count.cnt, now, deckId);
    });

    batchCreate();
    res.status(201).json({ created: created.length, cards: created });
  } catch (err) {
    console.error('POST /decks/:deckId/cards/batch-text error:', err);
    res.status(500).json({ error: 'Failed to import text cards' });
  }
});

// PUT /api/cards/:id —— 更新卡片
cardsRouter.put('/cards/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = getDb();
    const userId = req.user!.userId;
    const existing = db.prepare(
      'SELECT c.id, c.image_url, c.deck_id FROM cards c WHERE c.id = ?'
    ).get(id) as { id: string; image_url: string; deck_id: string } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    // 验证权限：所有者（admin）可修改所有字段，订阅用户仅可更新 SM-2 进度
    const isOwner = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(existing.deck_id, userId);
    const isSubscribed = db.prepare(
      'SELECT 1 FROM user_subscriptions WHERE user_id = ? AND deck_id = ?'
    ).get(userId, existing.deck_id);

    if (!isOwner && !isSubscribed) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    // 订阅用户仅可更新 SM-2 进度字段，不能修改卡片内容
    const isSubscribedOnly = !isOwner && isSubscribed;

    const {
      front_text,
      back_text,
      image_url,
      ease,
      interval,
      repetitions,
      next_review,
      last_review,
    } = req.body;

    const now = nowISO();

    // 构建动态更新（仅更新 cards 表的内容字段，SM-2 进度改写到 user_card_progress）
    const updates: string[] = [];
    const values: unknown[] = [];

    // 订阅用户不能修改卡片内容
    if (front_text !== undefined && !isSubscribedOnly) {
      updates.push('front_text = ?');
      values.push(front_text);
    }

    if (back_text !== undefined && !isSubscribedOnly) {
      updates.push('back_text = ?');
      values.push(back_text);
    }

    // 处理图片更新
    if (image_url !== undefined && !isSubscribedOnly) {
      if (typeof image_url === 'string' && image_url.trim() !== '') {
        if (isBase64DataUrl(image_url)) {
          // 删除旧图片
          deleteImageFile(existing.image_url);
          const newUrl = saveBase64Image(image_url);
          updates.push('image_url = ?');
          values.push(newUrl);
        } else if (image_url !== existing.image_url) {
          // 路径变了
          deleteImageFile(existing.image_url);
          updates.push('image_url = ?');
          values.push(image_url);
        }
      } else if (image_url === '' || image_url === null) {
        // 清空图片
        deleteImageFile(existing.image_url);
        updates.push('image_url = ?');
        values.push('');
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(id);
      db.prepare(`UPDATE cards SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // SM-2 进度字段：UPSERT 到 user_card_progress（不再写入 cards 表）
    const hasSM2Fields =
      ease !== undefined ||
      interval !== undefined ||
      repetitions !== undefined ||
      next_review !== undefined ||
      last_review !== undefined;

    if (hasSM2Fields) {
      db.prepare(
        `INSERT INTO user_card_progress (user_id, card_id, ease, interval, repetitions, next_review, last_review)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, card_id) DO UPDATE SET
           ease = COALESCE(excluded.ease, user_card_progress.ease),
           interval = COALESCE(excluded.interval, user_card_progress.interval),
           repetitions = COALESCE(excluded.repetitions, user_card_progress.repetitions),
           next_review = COALESCE(excluded.next_review, user_card_progress.next_review),
           last_review = COALESCE(excluded.last_review, user_card_progress.last_review)`
      ).run(
        req.user!.userId,
        id,
        ease ?? null,
        interval ?? null,
        repetitions ?? null,
        next_review ?? null,
        last_review ?? null
      );
    }

    const card = db.prepare(
      `SELECT c.id, c.deck_id, c.front_text, c.back_text, c.image_url,
              COALESCE(ucp.ease, 2.5) AS ease,
              COALESCE(ucp.interval, 0) AS interval,
              COALESCE(ucp.repetitions, 0) AS repetitions,
              COALESCE(ucp.next_review, c.next_review) AS next_review,
              ucp.last_review AS last_review,
              c.created_at, c.updated_at
       FROM cards c
       LEFT JOIN user_card_progress ucp ON ucp.user_id = ? AND ucp.card_id = c.id
       WHERE c.id = ?`
    ).get(req.user!.userId, id);

    res.json(card);
  } catch (err) {
    console.error('PUT /cards/:id error:', err);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE /api/cards/:id —— 删除卡片
cardsRouter.delete('/cards/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const card = db.prepare(
      'SELECT c.id, c.image_url, c.deck_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = ? AND d.user_id = ?'
    ).get(id, req.user!.userId) as {
      id: string;
      image_url: string;
      deck_id: string;
    } | undefined;

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    const deleteCard = db.transaction(() => {
      // 删除图片文件
      deleteImageFile(card.image_url);

      // 删除卡片记录
      db.prepare('DELETE FROM cards WHERE id = ?').run(id);

      // 更新牌组卡片计数
      const count = db.prepare('SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ?').get(card.deck_id) as { cnt: number };
      const now = nowISO();
      db.prepare('UPDATE decks SET card_count = ?, updated_at = ? WHERE id = ?').run(count.cnt, now, card.deck_id);
    });

    deleteCard();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /cards/:id error:', err);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// GET /api/decks/:deckId/due-cards —— 获取到期卡片
cardsRouter.get('/decks/:deckId/due-cards', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const db = getDb();
    const userId = req.user!.userId;

    // 验证牌组存在且当前用户已订阅（或 admin 直接放行）
    const isOwner = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, userId);
    const isSubscribed = db.prepare(
      'SELECT 1 FROM user_subscriptions WHERE user_id = ? AND deck_id = ?'
    ).get(userId, deckId);
    if (!isOwner && !isSubscribed && req.user!.role !== 'admin') {
      res.status(404).json({ error: 'Deck not found or not subscribed' });
      return;
    }

    const now = nowISO();
    let sql = `SELECT c.id, c.deck_id, c.front_text, c.back_text, c.image_url,
                      COALESCE(ucp.ease, 2.5) AS ease,
                      ucp.interval AS interval,
                      ucp.repetitions AS repetitions,
                      ucp.next_review AS next_review,
                      ucp.last_review AS last_review,
                      c.created_at, c.updated_at
               FROM cards c
               INNER JOIN user_card_progress ucp
                  ON ucp.user_id = ? AND ucp.card_id = c.id
               WHERE c.deck_id = ? AND ucp.interval > 0 AND ucp.next_review <= ?
               ORDER BY ucp.next_review ASC`;
    const params: unknown[] = [userId, deckId, now];

    if (limit && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const cards = db.prepare(sql).all(...params);
    res.json(cards);
  } catch (err) {
    console.error('GET /decks/:deckId/due-cards error:', err);
    res.status(500).json({ error: 'Failed to fetch due cards' });
  }
});

// GET /api/decks/:deckId/new-cards —— 获取新卡片
cardsRouter.get('/decks/:deckId/new-cards', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const db = getDb();
    const userId = req.user!.userId;

    // 验证牌组存在且当前用户已订阅（或 admin 直接放行）
    const isOwner = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, userId);
    const isSubscribed = db.prepare(
      'SELECT 1 FROM user_subscriptions WHERE user_id = ? AND deck_id = ?'
    ).get(userId, deckId);
    if (!isOwner && !isSubscribed && req.user!.role !== 'admin') {
      res.status(404).json({ error: 'Deck not found or not subscribed' });
      return;
    }

    let sql = `SELECT c.id, c.deck_id, c.front_text, c.back_text, c.image_url,
                      COALESCE(ucp.ease, 2.5) AS ease,
                      COALESCE(ucp.interval, 0) AS interval,
                      COALESCE(ucp.repetitions, 0) AS repetitions,
                      COALESCE(ucp.next_review, c.next_review) AS next_review,
                      ucp.last_review AS last_review,
                      c.created_at, c.updated_at
               FROM cards c
               LEFT JOIN user_card_progress ucp
                  ON ucp.user_id = ? AND ucp.card_id = c.id
               WHERE c.deck_id = ? AND (ucp.card_id IS NULL OR ucp.interval = 0)
               ORDER BY c.created_at ASC`;
    const params: unknown[] = [userId, deckId];

    if (limit && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const cards = db.prepare(sql).all(...params);
    res.json(cards);
  } catch (err) {
    console.error('GET /decks/:deckId/new-cards error:', err);
    res.status(500).json({ error: 'Failed to fetch new cards' });
  }
});
