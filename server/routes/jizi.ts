import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';

export const jiziRouter = Router();

/** 清洗 front_text：去括号后缀、下划线数字、尾部纯数字，返回核心汉字 */
function cleanFrontText(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  s = s.replace(/\s*[(\[【（][^)\]】]*[)\]】]?$/u, '');
  s = s.replace(/[_\-]\d+$/u, '');
  s = s.replace(/(\p{Script=Han})\d{1,3}$/u, '$1');
  s = s.replace(/\s+/g, '');
  return s;
}

interface CharHit {
  card_id: string;
  image_url: string;
  deck_id: string;
  deck_name: string;
  style: string;
  calligrapher: string;
  front_text_raw: string;
  sort_key: number;
}

interface JiziMatchResult {
  char: string;
  hits: CharHit[];
}

// GET /api/jizi/match?text=春江花月夜
jiziRouter.get('/jizi/match', async (req: Request, res: Response) => {
  try {
    const text = (req.query.text as string || '').trim();
    if (!text) {
      res.json({ results: [], meta: { scanned: 0, ms: 0, unique_chars: 0 } });
      return;
    }

    const chars = Array.from(text).filter((c) => /\p{Script=Han}/u.test(c));
    if (chars.length === 0) {
      res.json({ results: [], meta: { scanned: 0, ms: 0, unique_chars: 0 } });
      return;
    }
    if (chars.length > 200) {
      res.status(400).json({ error: '单次最多 200 字' });
      return;
    }

    const db = getDb();
    const userId = req.user!.userId;
    const t0 = Date.now();

    const rows = (await db.query(
      `SELECT c.id, c.deck_id, c.front_text, c.image_url, c.created_at,
              d.name AS deck_name,
              md.style, md.calligrapher
       FROM cards c
       JOIN decks d ON d.id = c.deck_id
       LEFT JOIN marketplace_decks md ON md.deck_id = c.deck_id
       WHERE c.image_url != ''
         AND (
           d.user_id = $1
           OR EXISTS (
             SELECT 1 FROM user_subscriptions us
             WHERE us.user_id = $2 AND us.deck_id = c.deck_id
           )
         )
       ORDER BY c.created_at ASC`,
      [userId, userId]
    )).rows as Array<{
      id: string;
      deck_id: string;
      front_text: string;
      image_url: string;
      created_at: string;
      deck_name: string;
      style: string | null;
      calligrapher: string | null;
    }>;

    const map = new Map<string, CharHit[]>();
    for (const r of rows) {
      const cleaned = cleanFrontText(r.front_text);
      if (!cleaned) continue;
      // 只使用单字卡片（字组如"江月"的图片包含多个字，用于集字会错误）
      const singleChars = Array.from(cleaned).filter((c) => /\p{Script=Han}/u.test(c));
      if (singleChars.length !== 1) continue;
      const ch = singleChars[0];
      let arr = map.get(ch);
      if (!arr) {
        arr = [];
        map.set(ch, arr);
      }
      arr.push({
        card_id: r.id,
        image_url: r.image_url,
        deck_id: r.deck_id,
        deck_name: r.deck_name,
        style: r.style || '',
        calligrapher: r.calligrapher || '',
        front_text_raw: r.front_text,
        sort_key: new Date(r.created_at).getTime(),
      });
    }

    const results: JiziMatchResult[] = chars.map((ch) => ({
      char: ch,
      hits: (map.get(ch) || []).sort((a, b) => a.sort_key - b.sort_key),
    }));

    res.json({
      results,
      meta: {
        scanned: rows.length,
        ms: Date.now() - t0,
        unique_chars: map.size,
      },
    });
  } catch (err) {
    console.error('GET /api/jizi/match error:', err);
    res.status(500).json({ error: 'Failed to match chars' });
  }
});
