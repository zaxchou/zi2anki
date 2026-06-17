import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';

export const analyticsRouter = Router();

// GET /api/analytics/:deckId/card-status —— 卡片状态分布
analyticsRouter.get('/analytics/:deckId/card-status', async (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组属于当前用户
    const deck = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [deckId, req.user!.userId])).rows[0];
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // New: interval = 0
    const newCount = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval = 0',
      [deckId]
    )).rows[0] as { cnt: number };

    // Learning: interval > 0 且未毕业（≤ 学习阶梯最大值）
    const learningCount = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval > 0 AND interval <= 10',
      [deckId]
    )).rows[0] as { cnt: number };

    // Review (young): 已毕业 + interval < 21 days (30240 min)
    const youngCount = (await db.query(
      `SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 
       AND interval > 10 AND interval < 30240`,
      [deckId]
    )).rows[0] as { cnt: number };

    // Mature: interval >= 21 days
    const matureCount = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval >= 30240',
      [deckId]
    )).rows[0] as { cnt: number };

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
analyticsRouter.get('/analytics/:deckId/difficulty', async (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组属于当前用户
    const deck = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [deckId, req.user!.userId])).rows[0];
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    // Hard: ease <= 1.8
    const hard = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval > 0 AND ease <= 1.8',
      [deckId]
    )).rows[0] as { cnt: number };

    // Medium: 1.8 < ease < 2.3
    const medium = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval > 0 AND ease > 1.8 AND ease < 2.3',
      [deckId]
    )).rows[0] as { cnt: number };

    // Easy: ease >= 2.3 (only reviewed cards)
    const easy = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval > 0 AND ease >= 2.3',
      [deckId]
    )).rows[0] as { cnt: number };

    // Not yet reviewed (interval = 0)
    const newCards = (await db.query(
      'SELECT COUNT(*) as cnt FROM cards WHERE deck_id = $1 AND interval = 0',
      [deckId]
    )).rows[0] as { cnt: number };

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
analyticsRouter.get('/analytics/:deckId/ratings', async (req: Request, res: Response) => {
  try {
    const { deckId } = req.params;
    const db = getDb();

    // 验证牌组属于当前用户
    const deck = (await db.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [deckId, req.user!.userId])).rows[0];
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }

    const row = (await db.query(
      `SELECT 
         COALESCE(SUM(ratings_again), 0) as again,
         COALESCE(SUM(ratings_hard), 0) as hard,
         COALESCE(SUM(ratings_good), 0) as good,
         COALESCE(SUM(ratings_easy), 0) as easy,
         COALESCE(SUM(cards_studied), 0) as total
       FROM study_sessions WHERE deck_id = $1`,
      [deckId]
    )).rows[0] as {
      again: number; hard: number; good: number; easy: number; total: number;
    };

    res.json(row);
  } catch (err) {
    console.error('GET /analytics/:deckId/ratings error:', err);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// GET /api/analytics/daily-trend —— 每日复习趋势（最近 N 天）
analyticsRouter.get('/analytics/daily-trend', async (req: Request, res: Response) => {
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
    const rows = (await db.query(
      `SELECT date, cards_studied, new_cards_learned FROM daily_stats
       WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date ASC`,
      [req.user!.userId, dates[0], dates[dates.length - 1]]
    )).rows as {
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

// GET /api/analytics/daily-extra —— 每日扩展统计（新学/复习 + 评分分布 + 学时）
// Query: days（默认 11）/ from+to（覆盖 days）/ deckId（可选；缺省=全部牌组）
// 字段：date, new_learned, reviewed, hard, medium, easy, minutes
analyticsRouter.get('/analytics/daily-extra', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.userId;
    const deckId = (req.query.deckId as string | undefined) || '';

    // 日期范围
    let dates: string[];
    if (req.query.from && req.query.to) {
      const from = String(req.query.from);
      const to = String(req.query.to);
      const start = new Date(from);
      const end = new Date(to);
      dates = [];
      const cur = new Date(start);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const days = parseInt(req.query.days as string, 10) || 11;
      dates = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
      }
    }

    const from = dates[0];
    const to = dates[dates.length - 1];

    // 1) new_learned / reviewed 来自 daily_stats（PK: date+user_id+deck_id）
    //    - 无 deckId：跨牌组 SUM
    //    - 有 deckId：按该牌组查
    const dailyRows = deckId
      ? ((await db.query(
          `SELECT date, cards_studied, new_cards_learned
           FROM daily_stats
           WHERE user_id = $1 AND date >= $2 AND date <= $3 AND deck_id = $4`,
          [userId, from, to, deckId]
        )).rows as {
          date: string; cards_studied: number; new_cards_learned: number;
        }[])
      : ((await db.query(
          `SELECT date,
                  SUM(cards_studied) as cards_studied,
                  SUM(new_cards_learned) as new_cards_learned
           FROM daily_stats
           WHERE user_id = $1 AND date >= $2 AND date <= $3
           GROUP BY date`,
          [userId, from, to]
        )).rows as {
          date: string; cards_studied: number; new_cards_learned: number;
        }[]);

    // 2) 评分按日分布 + 学时 —— 全部在 SQL 端聚合（避免 N+1）
    //    用 AT TIME ZONE 提取本地日期键
    const sessionParams: unknown[] = [userId, `${from} 00:00:00`, `${to} 23:59:59`];
    const sessionWhere = deckId
      ? `AND deck_id = $${sessionParams.length + 1}`
      : '';
    if (deckId) {
      sessionParams.push(deckId);
    }

    const sessionAgg = (await db.query(
      `SELECT (started_at::timestamp AT TIME ZONE 'Asia/Shanghai')::date as date_key,
              SUM(ratings_again + ratings_hard) as hard,
              SUM(ratings_good) as medium,
              SUM(ratings_easy) as easy,
              SUM(CASE WHEN ended_at IS NOT NULL
                       THEN EXTRACT(EPOCH FROM (ended_at::timestamp - started_at::timestamp)) / 60.0
                       ELSE 0 END) as minutes
       FROM study_sessions
       WHERE user_id = $1 AND started_at >= $2 AND started_at <= $3
         AND ended_at IS NOT NULL
         ${sessionWhere}
       GROUP BY date_key`,
      sessionParams
    )).rows as {
      date_key: string;
      hard: number | null;
      medium: number | null;
      easy: number | null;
      minutes: number | null;
    }[];

    // 聚合：daily_stats + session 聚合结果合并到 dailyMap
    const dailyMap = new Map<string, { new_learned: number; reviewed: number; hard: number; medium: number; easy: number; minutes: number }>();
    for (const date of dates) {
      dailyMap.set(date, { new_learned: 0, reviewed: 0, hard: 0, medium: 0, easy: 0, minutes: 0 });
    }
    for (const r of dailyRows) {
      const bucket = dailyMap.get(r.date);
      if (!bucket) continue;
      const reviewed = Math.max(0, r.cards_studied - r.new_cards_learned);
      bucket.new_learned += r.new_cards_learned;
      bucket.reviewed += reviewed;
    }
    for (const s of sessionAgg) {
      const bucket = dailyMap.get(s.date_key);
      if (!bucket) continue;
      bucket.hard += s.hard || 0;
      bucket.medium += s.medium || 0;
      bucket.easy += s.easy || 0;
      bucket.minutes += s.minutes || 0;
    }

    const filled = dates.map((date) => {
      const b = dailyMap.get(date)!;
      return {
        date,
        new_learned: b.new_learned,
        reviewed: b.reviewed,
        hard: b.hard,
        medium: b.medium,
        easy: b.easy,
        minutes: Math.round(b.minutes),
      };
    });

    res.json(filled);
  } catch (err) {
    console.error('GET /analytics/daily-extra error:', err);
    res.status(500).json({ error: 'Failed to fetch daily extra' });
  }
});
