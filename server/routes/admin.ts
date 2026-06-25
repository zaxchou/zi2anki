import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { promises as fs } from 'node:fs';
import { getDb, getUploadsDir } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { buildContentPackage } from '../services/contentPackage.js';

function toInt(value: unknown): number {
  return Number(value ?? 0);
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function countUploadFiles(): Promise<number> {
  try {
    const entries = await fs.readdir(getUploadsDir(), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
}

export const adminRouter = Router();

// 所有 admin 路由都需要管理员权限
adminRouter.use(requireAdmin);

// GET /api/admin/content/package/:deckId —— 导出单个牌组安全内容包
adminRouter.get('/admin/content/package/:deckId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { buffer, filename } = await buildContentPackage(db, req.params.deckId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.end(buffer);
  } catch (err) {
    console.error('GET /admin/content/package/:deckId error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : '导出内容包失败' });
  }
});

// GET /api/admin/dashboard —— 后台数据运营快照（只读）
adminRouter.get('/admin/dashboard', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const [
      userStats,
      newUsers,
      studyActivity,
      jiziActivity,
      totalStudy,
      totalJizi,
      contentStats,
      healthStats,
      activeTodayUsers,
      active7dUsers,
      active30dUsers,
      uploadFiles,
    ] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
          MAX(created_at) AS latest_registered_at
        FROM users
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE (created_at::timestamptz AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date)::int AS new_today,
          COUNT(*) FILTER (WHERE created_at::timestamptz >= NOW() - INTERVAL '7 days')::int AS new_7d,
          COUNT(*) FILTER (WHERE created_at::timestamptz >= NOW() - INTERVAL '30 days')::int AS new_30d
        FROM users
      `),
      db.query(`
        SELECT
          COUNT(DISTINCT user_id) FILTER (WHERE (started_at::timestamptz AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date)::int AS study_active_today,
          MAX(started_at) AS latest_study_at
        FROM study_sessions
      `),
      db.query(`
        SELECT
          COUNT(DISTINCT user_id) FILTER (WHERE (created_at::timestamptz AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date)::int AS jizi_active_today,
          MAX(created_at) AS latest_jizi_at
        FROM jizi_history
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total_study_sessions,
          COALESCE(SUM(cards_studied), 0)::int AS total_cards_studied,
          MAX(date) AS latest_daily_stat_date
        FROM daily_stats
      `),
      db.query(`SELECT COUNT(*)::int AS total_jizi_requests FROM jizi_history`),
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM decks) AS decks,
          (SELECT COUNT(*)::int FROM cards) AS cards,
          (SELECT COUNT(*)::int FROM marketplace_decks WHERE published_at IS NOT NULL) AS marketplace_decks,
          (SELECT COUNT(*)::int FROM marketplace_decks WHERE featured = 1) AS featured_decks,
          (SELECT COUNT(*)::int FROM cards WHERE image_url IS NOT NULL AND image_url != '' AND archived_at IS NULL) AS cards_with_image,
          (SELECT MAX(updated_at) FROM decks) AS latest_deck_updated_at,
          (SELECT MAX(created_at) FROM cards) AS latest_card_created_at
      `),
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM decks WHERE card_count = 0) AS empty_decks,
          (SELECT COUNT(*)::int FROM users u WHERE NOT EXISTS (SELECT 1 FROM study_sessions ss WHERE ss.user_id = u.id)) AS users_never_studied,
          (SELECT COUNT(*)::int FROM cards WHERE (image_url IS NULL OR image_url = '') AND archived_at IS NULL) AS cards_without_image,
          (
            SELECT COUNT(*)::int
            FROM decks d
            LEFT JOIN (
              SELECT deck_id, COUNT(*)::int AS actual_count
              FROM cards
              WHERE archived_at IS NULL
              GROUP BY deck_id
            ) c ON c.deck_id = d.id
            WHERE COALESCE(d.card_count, 0) != COALESCE(c.actual_count, 0)
          ) AS decks_card_count_mismatch
      `),
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT user_id FROM study_sessions
          WHERE (started_at::timestamptz AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
          UNION
          SELECT user_id FROM jizi_history
          WHERE (created_at::timestamptz AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
        ) active_users
      `),
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT user_id FROM study_sessions WHERE started_at::timestamptz >= NOW() - INTERVAL '7 days'
          UNION
          SELECT user_id FROM jizi_history WHERE created_at::timestamptz >= NOW() - INTERVAL '7 days'
        ) active_users
      `),
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT user_id FROM study_sessions WHERE started_at::timestamptz >= NOW() - INTERVAL '30 days'
          UNION
          SELECT user_id FROM jizi_history WHERE created_at::timestamptz >= NOW() - INTERVAL '30 days'
        ) active_users
      `),
      countUploadFiles(),
    ]);

    const users = userStats.rows[0] ?? {};
    const newUserCounts = newUsers.rows[0] ?? {};
    const study = studyActivity.rows[0] ?? {};
    const jizi = jiziActivity.rows[0] ?? {};
    const totalStudyStats = totalStudy.rows[0] ?? {};
    const totalJiziStats = totalJizi.rows[0] ?? {};
    const content = contentStats.rows[0] ?? {};
    const health = healthStats.rows[0] ?? {};
    const totalUsers = toInt(users.total);
    const adminUsers = toInt(users.admins);

    res.json({
      fetched_at: new Date().toISOString(),
      users: {
        total: totalUsers,
        admins: adminUsers,
        normal: Math.max(totalUsers - adminUsers, 0),
        new_today: toInt(newUserCounts.new_today),
        new_7d: toInt(newUserCounts.new_7d),
        new_30d: toInt(newUserCounts.new_30d),
        latest_registered_at: toNullableString(users.latest_registered_at),
      },
      activity: {
        dau_today: toInt(activeTodayUsers.rows[0]?.count),
        active_7d: toInt(active7dUsers.rows[0]?.count),
        mau_30d: toInt(active30dUsers.rows[0]?.count),
        study_active_today: toInt(study.study_active_today),
        jizi_active_today: toInt(jizi.jizi_active_today),
        total_study_sessions: toInt(totalStudyStats.total_study_sessions),
        total_cards_studied: toInt(totalStudyStats.total_cards_studied),
        total_jizi_requests: toInt(totalJiziStats.total_jizi_requests),
        latest_study_at: toNullableString(study.latest_study_at),
        latest_jizi_at: toNullableString(jizi.latest_jizi_at),
        latest_daily_stat_date: toNullableString(totalStudyStats.latest_daily_stat_date),
      },
      content: {
        decks: toInt(content.decks),
        cards: toInt(content.cards),
        marketplace_decks: toInt(content.marketplace_decks),
        featured_decks: toInt(content.featured_decks),
        cards_with_image: toInt(content.cards_with_image),
        upload_files: uploadFiles,
        latest_deck_updated_at: toNullableString(content.latest_deck_updated_at),
        latest_card_created_at: toNullableString(content.latest_card_created_at),
      },
      health: {
        empty_decks: toInt(health.empty_decks),
        users_never_studied: toInt(health.users_never_studied),
        cards_without_image: toInt(health.cards_without_image),
        decks_card_count_mismatch: toInt(health.decks_card_count_mismatch),
      },
    });
  } catch (err) {
    console.error('GET /admin/dashboard error:', err);
    res.status(500).json({ error: '获取后台数据失败' });
  }
});

// GET /api/admin/users —— 获取所有用户列表
adminRouter.get('/admin/users', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, username, role, created_at
       FROM users ORDER BY created_at ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// PUT /api/admin/users/:id —— 修改用户名或密码
adminRouter.put('/admin/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;
    const db = getDb();

    // 验证用户存在
    const existing = (await db.query('SELECT id, username, role FROM users WHERE id = $1', [id])).rows[0] as
      { id: string; username: string; role: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    // 禁止修改自己的角色
    if (id === req.user!.userId && (username !== undefined || password !== undefined)) {
      // 允许修改自己的信息，没问题
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      const clean = String(username).trim();
      if (clean.length < 2 || clean.length > 20) {
        res.status(400).json({ error: '用户名需要 2-20 个字符' });
        return;
      }
      // 检查唯一性（排除自己）
      const dup = (await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [clean, id])).rows[0];
      if (dup) {
        res.status(409).json({ error: '用户名已存在' });
        return;
      }
      updates.push(`username = $${paramIndex++}`);
      params.push(clean);
    }

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6 || password.length > 64) {
        res.status(400).json({ error: '密码需要 6-64 个字符' });
        return;
      }
      const hash = bcrypt.hashSync(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(hash);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: '请提供要修改的字段' });
      return;
    }

    params.push(id);
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /admin/users/:id error:', err);
    res.status(500).json({ error: '修改用户失败' });
  }
});

// DELETE /api/admin/users/:id —— 删除用户（禁止删除自己）
adminRouter.delete('/admin/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 禁止删除自己
    if (id === req.user!.userId) {
      res.status(400).json({ error: '不能删除当前登录的管理员账号' });
      return;
    }

    const existing = (await db.query('SELECT id FROM users WHERE id = $1', [id])).rows[0];
    if (!existing) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 清理用户相关数据
      await client.query('DELETE FROM user_card_progress WHERE user_id = $1', [id]);
      await client.query('DELETE FROM daily_stats WHERE user_id = $1', [id]);
      await client.query('DELETE FROM study_sessions WHERE user_id = $1', [id]);
      await client.query('DELETE FROM user_subscriptions WHERE user_id = $1', [id]);
      // 如果用户创建了牌组，转移给 admin
      await client.query('UPDATE decks SET user_id = $1 WHERE user_id = $2', [req.user!.userId, id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/users/:id error:', err);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// GET /api/admin/users/:id/stats —— 查看指定用户的学习统计
adminRouter.get('/admin/users/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // 验证用户存在
    const user = (await db.query('SELECT id, username FROM users WHERE id = $1', [id])).rows[0] as
      { id: string; username: string } | undefined;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    // 每日统计
    const dailyStats = (await db.query(
      `SELECT date, cards_studied, new_cards_learned
       FROM daily_stats WHERE user_id = $1 ORDER BY date ASC`,
      [id]
    )).rows as { date: string; cards_studied: number; new_cards_learned: number }[];

    // 汇总
    const totalStudied = dailyStats.reduce((s, d) => s + Number(d.cards_studied), 0);
    const activeDays = dailyStats.filter((d) => Number(d.cards_studied) > 0).length;
    const totalNewLearned = dailyStats.reduce((s, d) => s + Number(d.new_cards_learned), 0);

    // 学习会话统计
    const sessionStats = (await db.query(
      `SELECT COUNT(*)::int as total_sessions,
              COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at::timestamp - started_at::timestamp)) / 60.0), 0)::float as total_minutes
       FROM study_sessions
       WHERE user_id = $1 AND ended_at IS NOT NULL`,
      [id]
    )).rows[0] as { total_sessions: number; total_minutes: number };

    // 卡片进度统计
    const progressStats = (await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE interval = 0) as new_count,
         COUNT(*) FILTER (WHERE interval > 0 AND interval <= 30240) as learning_count,
         COUNT(*) FILTER (WHERE interval >= 30240) as mature_count
       FROM user_card_progress WHERE user_id = $1`,
      [id]
    )).rows[0] as { new_count: number; learning_count: number; mature_count: number };

    // 已订阅牌组
    const subscriptions = (await db.query(
      `SELECT d.id, d.name
       FROM user_subscriptions us
       JOIN decks d ON d.id = us.deck_id
       WHERE us.user_id = $1
       ORDER BY d.name`,
      [id]
    )).rows as { id: string; name: string }[];

    res.json({
      user: { id: user.id, username: user.username },
      stats: {
        total_studied: totalStudied,
        active_days: activeDays,
        total_new_learned: totalNewLearned,
        total_sessions: sessionStats.total_sessions,
        total_minutes: Math.round(sessionStats.total_minutes),
        cards: progressStats,
      },
      daily_stats: dailyStats,
      subscriptions,
    });
  } catch (err) {
    console.error('GET /admin/users/:id/stats error:', err);
    res.status(500).json({ error: '获取用户统计失败' });
  }
});
