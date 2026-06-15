import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';

export const analyticsRouter = Router();

// GET /api/analytics/:deckId/card-status —— 卡片状态分布
analyticsRouter.get('/analytics/:deckId/card-status', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组属于当前用户
    const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // New: interval = 0
    const newCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval = 0'
    ).get(deckId) as { cnt: number };

    // Learning: interval > 0 且未毕业（≤ 学习阶梯最大值）
    const learningCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval > 0 AND interval <= 10'
    ).get(deckId) as { cnt: number };

    // Review (young): 已毕业 + interval < 21 days (30240 min)
    const youngCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? 
       AND interval > 10 AND interval < 30240`
    ).get(deckId) as { cnt: number };

    // Mature: interval >= 21 days
    const matureCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval >= 30240'
    ).get(deckId) as { cnt: number };

    res.json({
      new: newCount.cnt,
      learning: learningCount.cnt,
      young: youngCount.cnt,
      mature: matureCount.cnt,
    });
  } catch (err) {
    console.error('GET /analytics/:deckId/card-status error:', err);
    res.status(500).json({ error: 'Failed to fetch card status' });
  }
});

// GET /api/analytics/:deckId/difficulty —— 难度分布（按 ease 因子）
analyticsRouter.get('/analytics/:deckId/difficulty', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组属于当前用户
    const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // Hard: ease <= 1.8
    const hard = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval > 0 AND ease <= 1.8'
    ).get(deckId) as { cnt: number };

    // Medium: 1.8 < ease < 2.3
    const medium = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval > 0 AND ease > 1.8 AND ease < 2.3'
    ).get(deckId) as { cnt: number };

    // Easy: ease >= 2.3 (only reviewed cards)
    const easy = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval > 0 AND ease >= 2.3'
    ).get(deckId) as { cnt: number };

    // Not yet reviewed (interval = 0)
    const newCards = db.prepare(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = ? AND interval = 0'
    ).get(deckId) as { cnt: number };

    res.json({
      hard: hard.cnt,
      medium: medium.cnt,
      easy: easy.cnt,
      unreviewed: newCards.cnt,
    });
  } catch (err) {
    console.error('GET /analytics/:deckId/difficulty error:', err);
    res.status(500).json({ error: 'Failed to fetch difficulty' });
  }
});

// GET /api/analytics/:deckId/ratings —— 评分分布
analyticsRouter.get('/analytics/:deckId/ratings', (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组属于当前用户
    const deck = db.prepare('SELECT id FROM decks WHERE id = ? AND user_id = ?').get(deckId, req.user!.userId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const row = db.prepare(
      `SELECT 
         COALESCE(SUM(ratings_again), 0) as again,
         COALESCE(SUM(ratings_hard), 0) as hard,
         COALESCE(SUM(ratings_good), 0) as good,
         COALESCE(SUM(ratings_easy), 0) as easy,
         COALESCE(SUM(cards_studied), 0) as total
       FROM study_sessions WHERE deck_id = ?`
    ).get(deckId) as {
      again: number; hard: number; good: number; easy: number; total: number;
    };

    res.json(row);
  } catch (err) {
    console.error('GET /analytics/:deckId/ratings error:', err);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// GET /api/analytics/daily-trend —— 每日复习趋势（最近 N 天）
analyticsRouter.get('/analytics/daily-trend', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 14;
    const db = getDb();

    // 生成最近 N 天的日期列表
    const dates: string[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }

    // 查询这些天的统计
    const rows = db.prepare(
      `SELECT date, cards_studied, new_cards_learned FROM daily_stats 
       WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`
    ).all(req.user!.userId, dates[0], dates[dates.length - 1]) as {
      date: string; cards_studied: number; new_cards_learned: number;
    }[];

    // 填充缺失日期（0 值）
    const statsMap = new Map(rows.map((r) => [r.date, r]));
    const filled = dates.map((date) => {
      const row = statsMap.get(date);
      return {
        date,
        cards_studied: row?.cards_studied ?? 0,
        new_cards_learned: row?.new_cards_learned ?? 0,
      };
    });

    res.json(filled);
  } catch (err) {
    console.error('GET /analytics/daily-trend error:', err);
    res.status(500).json({ error: 'Failed to fetch daily trend' });
  }
});
