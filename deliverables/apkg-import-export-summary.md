# APKG 导入/导出功能 — 交付总结

## 交付概览

| 维度 | 状态 |
|------|------|
| 后端路由 | ✅ 导出: GET /api/export/:deckId + GET /api/export |
| 后端路由 | ✅ 导入: POST /api/import (multipart) |
| 前端 API | ✅ exportDeck / exportAllDecks / importApkgFile |
| 设置页面 UI | ✅ 牌组选择 + 导出按钮 + 文件选择导入 |
| TypeScript 编译 | ✅ 零错误 |
| Vite 构建 | ✅ 零错误 |

## 关键设计决策

- **技术路线**: Node.js 原生（JSZip + better-sqlite3），不加 Python 依赖
- **导出模型**: "Basic" 模型 + Front/Back 字段，图片以内嵌 `<img>` 引用
- **导入策略**: 解析 Anki `col.models` → 启发式判断图片/文本字段（模板正则 + 字段名启发）
- **三段式架构**: 解析 ZIP(异步) → 预处理媒体(异步+文件) → 事务写入数据库(同步)
- **同名牌组**: 合并策略（同名追加，不新建）

## 修正的 Bug（编译前）

1. **uuid→numeric 转换**: JS `<<` 运算符截断到 32 位 → 用乘法修复
2. **col.conf 空对象**: 可能导致 Anki 解析失败 → 添加最小合法配置
3. **ESM 中使用 require**: 项目用 "type": "module" → 改用 import
4. **await 在 db.transaction 内**: better-sqlite3 事务是同步的 → 三段式重构
5. **图片字段值为 HTML**: `{{BackFile}}` 实际存的是 `<img src="uuid.jpg">` → 正则提取 src

## 文件清单

| 文件 | 操作 | 行数 |
|------|------|------|
| `server/routes/export.ts` | 新增 | ~315 行 |
| `server/routes/import.ts` | 新增 | ~310 行 |
| `server/index.ts` | 修改（+2 行 import +2 行 app.use） |
| `src/lib/api.ts` | 修改（新增 ~35 行） |
| `src/pages/SettingsPage.tsx` | 修改（新增导入导出 UI 卡片） |
| `package.json` | 修改（新增 jszip 依赖） |

## 用户下一步

1. **本地测试**: 启动本地服务器 → 设置页面 → 选择一个牌组 → 点击"导出"
2. **导入验证**: 用已有的 `春江花月夜_书法记忆卡_v4.apkg` 测试导入
3. **部署**: `npm run build` → 运行部署脚本到服务器
4. **Anki 验证**: 导出的 APKG 可在 Anki 桌面版中导入验证图片和数据完整性
