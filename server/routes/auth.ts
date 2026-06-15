import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';

export const authRouter = Router();

function uuid(): string { return crypto.randomUUID(); }

// POST /api/auth/register
authRouter.post('/register', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // 校验
    if (!username || typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 20) {
      res.status(400).json({ error: '用户名需要 2-20 个字符' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 64) {
      res.status(400).json({ error: '密码需要 6-64 个字符' });
      return;
    }

    const db = getDb();
    const cleanUsername = username.trim();

    // 检查用户名唯一性
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }

    // 创建用户
    const id = uuid();
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, cleanUsername, passwordHash, 'user', now);

    // 签发 JWT
    const token = jwt.sign({ userId: id, username: cleanUsername, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id, username: cleanUsername, role: 'user' } });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, password_hash, role FROM users WHERE username = ?'
    ).get(username.trim()) as { id: string; username: string; password_hash: string; role: string } | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});
