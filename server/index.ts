import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { decksRouter } from './routes/decks.js';
import { cardsRouter } from './routes/cards.js';
import { studyRouter } from './routes/study.js';
import { analyticsRouter } from './routes/analytics.js';
import { exportRouter } from './routes/export.js';
import { importRouter } from './routes/import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 静态文件服务 —— uploads 目录（项目根目录）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 挂载路由
app.use('/api', decksRouter);
app.use('/api', cardsRouter);
app.use('/api', studyRouter);
app.use('/api', analyticsRouter);
app.use('/api', exportRouter);
app.use('/api', importRouter);

// 生产模式：托管前端构建产物
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback：所有非 /api 路由返回 index.html
  app.get(/^\/(?!api|uploads)/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[生产模式] 前端托管于 ${distDir}`);
} else {
  console.log('[开发模式] 前端请用 npx vite 启动');
}

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 启动
app.listen(PORT, () => {
  // 初始化数据库（建表）
  getDb();
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
