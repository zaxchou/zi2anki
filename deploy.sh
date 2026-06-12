#!/bin/bash
set -e
echo "=== Zi2Anki 部署脚本 ==="

cd "$(dirname "$0")"

# 1. 构建前端
echo "[1/3] 构建前端..."
npm run build 2>/dev/null || (npx vite build)

# 2. 安装生产依赖
echo "[2/3] 安装依赖..."
npm install --omit=dev 2>/dev/null || true

# 3. 创建必要的目录
mkdir -p uploads server/data

# 4. 启动服务
echo "[3/3] 启动服务 (port 3001)..."
echo "前端由 Express 托管，后端 API 也在 3001"

# 用 pm2 或直接启动
if command -v pm2 &>/dev/null; then
  pm2 delete zi2anki 2>/dev/null || true
  pm2 start server/index.ts --name zi2anki --interpreter npx -- tsx
  pm2 save
  echo "已通过 PM2 启动，访问 http://你的服务器IP:3001"
else
  echo "PM2 未安装，直接启动..."
  npx tsx server/index.ts
fi
