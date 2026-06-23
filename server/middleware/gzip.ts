import { createGzip, createBrotliCompress } from 'node:zlib';
import type { Request, Response, NextFunction } from 'express';

/** Express 5 兼容的 gzip 中间件（替代已不兼容的 compression 包） */
export function gzipMiddleware(req: Request, res: Response, next: NextFunction) {
  const accept = req.headers['accept-encoding'] as string | undefined;
  if (!accept || req.method === 'HEAD') return next();

  // 只压缩 JSON 和 JS/CSS 文本响应
  const ct = res.getHeader('content-type') as string | undefined;
  if (!ct || !/json|javascript|css|text|svg|xml/.test(ct)) return next();

  // 小响应跳过（< 1KB 压缩意义不大）
  const cl = parseInt(res.getHeader('content-length') as string, 10);
  if (!isNaN(cl) && cl < 1024) return next();

  const useBrotli = accept.includes('br');
  const encoding = useBrotli ? 'br' : 'gzip';
  const compressor = useBrotli ? createBrotliCompress({ level: 4 }) : createGzip({ level: 4 });

  res.setHeader('content-encoding', encoding);
  res.removeHeader('content-length');
  compressor.pipe(res);

  // 拦截 write/end 写入压缩流
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  res.write = (chunk: any, ...args: any[]) => compressor.write(chunk, ...args);
  res.end = (chunk?: any, ...args: any[]) => compressor.end(chunk, ...args);

  next();
}
