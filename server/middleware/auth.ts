import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT 密钥：优先环境变量，开发环境默认值
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; username: string; role: string };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
    req.user = { userId: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

/** 导出 JWT_SECRET 供 auth router 使用 */
export { JWT_SECRET };
