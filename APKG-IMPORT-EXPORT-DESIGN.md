# APKG 导入/导出功能设计方案

## 1. 实现方案选择

### 技术路线

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **Node.js 原生（JSZip + better-sqlite3）** | 无需额外运行时、与项目一致、部署简单 | 自己实现 APKG 打包/解包 | ✅ **采用** |
| Python genanki | genanki 成熟稳定 | 需 Python 运行时、部署复杂、与 PM2 配合麻烦 | ❌ 放弃 |

**决定**：后端 Node.js 直接处理，新增两个 npm 包：
- `jszip` — ZIP 打包/解包（APKG 本质是 ZIP）
- `uuid` — 生成导入后卡片/牌组的 UUID（项目已在用）

### 为什么不用 genanki

生产环境（Ubuntu 服务器）没有 Python 环境，而且 PM2 管理的是 Node 进程。引入 Python 会增加部署复杂度和故障点。APKG 就是 ZIP + SQLite，Node 侧完全能处理。

---

## 2. 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `server/routes/export.ts` | **新增** | 导出 API：查询数据 → 构建 collection.anki2 → 打包 ZIP |
| `server/routes/import.ts` | **新增** | 导入 API：解压 ZIP → 解析 collection.anki2 → 写入 calligraphy.db |
| `server/routes/cards.ts` | **修改** | 新增批量查询接口（导出时需要全量卡片数据） |
| `server/routes/decks.ts` | **修改** | 新增按名字查找牌组接口（导入时去重用） |
| `src/lib/api.ts` | **修改** | 新增前端 API 调用函数 |
| `src/pages/SettingsPage.tsx` | **修改** | 新增"导入 APKG"/"导出 APKG"按钮 |
| `server/index.ts` | **修改** | 挂载新路由 |
| `package.json` | **修改** | 新增 `jszip` 依赖 |

---

## 3. API 接口设计

### 3.1 导出

```
GET /api/export/:deckId
```

**响应**：返回 `.apkg` 文件（Content-Type: application/octet-stream）

**前端调用**：直接通过 `<a>` 标签或 `window.open` 下载，不经过 fetch。

**参数**：
- `:deckId` — 牌组 ID（必填），也可以支持 `all` 导出全部牌组

### 3.2 导入

```
POST /api/import
Content-Type: multipart/form-data
Body: file=<.apkg 文件>
```

**响应**：
```json
{
  "success": true,
  "decks": [
    { "id": "uuid", "name": "春江花月夜·书法单字", "card_count": 191 }
  ],
  "errors": []
}
```

---

## 4. 核心转换逻辑

### 4.1 导出映射（zi2anki → APKG）

| zi2anki | → | Anki | 换算 |
|---------|---|------|------|
| `decks.name` | → | `col.decks` JSON 中的 `name` | 直接复制 |
| `cards.front_text` | → | `notes.flds[0]` | 直接复制 |
| `cards.back_text` | → | `notes.flds[1]`（如果有） | 直接复制，空则放文件名 |
| `cards.image_url` | → | 媒体文件 + `notes.flds` 放文件名 | **关键**：图片复制到 ZIP，文件名写入 flds |
| `cards.ease` | → | `cards.factor` | **`ease × 1000`**（如 2.5 → 2500）|
| `cards.interval`（分钟） | → | `cards.ivl`（天） | **`Math.round(interval / 1440)`** |
| `cards.repetitions` | → | `cards.reps` | 直接复制 |
| `cards.next_review` | → | `cards.due` | **需要计算**：到期日 = 今天 + (next_review - now) 的天数 |
| `cards.id` | → | `notes.guid` | 用 UUID 去 `-` 后取前 8 位作 guid |

**⚠️ 坑 1：interval 单位差异**
- zi2anki 的 interval 是**分钟**
- Anki 的 ivl 是**天**
- 导出时：`Math.round(interval / 1440)` — 分钟转天
- 导入时：`ivl * 1440` — 天转分钟
- 边界：interval=0（新卡片）→ ivl=0；interval 在 1-1439 分钟 → 四舍五入为 1 天

**⚠️ 坑 2：due 的计算**
- Anki 的 due 对复习卡是"到期日距 1970-01-01 的天数"
- 简单做法：`due = Math.floor((next_review_timestamp - new Date(2012, 4, 8).getTime()) / 86400000)`（Anki 的 epoch 是 2012-05-08）
- 对项目来说，用当前时间为基准算相对值更安全

### 4.2 导入映射（APKG → zi2anki）

| APKG | → | zi2anki | 换算 |
|------|---|---------|------|
| `col.decks` JSON 中的牌组名 | → | `decks.name` | 同名牌组去重策略见下文 |
| `notes.flds[0]` | → | `cards.front_text` | 直接复制 |
| `notes.flds[1]` | → | `cards.back_text` | 直接复制 |
| 模板中 `<img src="...">` 引用的字段 | → | `cards.image_url` | **复杂**：需解析模板确认哪个字段是图片 |
| 媒体文件（数字 ID） | → | `uploads/` | 复制到 uploads 目录，按原文件名或 UUID 重命名 |
| `media` JSON | → | 图片路径映射 | 数字ID → 实际文件路径 |
| `cards.factor` | → | `cards.ease` | **`factor / 1000`** |
| `cards.ivl`（天） | → | `cards.interval`（分钟） | **`ivl * 1440`** |
| `cards.reps` | → | `cards.repetitions` | 直接复制 |
| `cards.due` | → | `cards.next_review` | **需要计算** |
| `cards.type` / `cards.queue` | → | SM-2 状态 | 新卡(0) → interval=0；已学习 → 用 ivl |
| `cards.lapses` | → | 暂不保留 | 项目无此字段 |

**⚠️ 坑 3：模型（Model）多样性**
- 测试 APKG 使用的是"书法单字记忆卡"模型（Front + BackFile）
- 但用户可能导入**任意模型**的 APKG（Basic、Basic (and reversed card)、Cloze 等）
- **必须**解析 `col.models` JSON，读取模板中的字段名和 HTML 模板
- 然后解析 `qfmt`/`afmt` 模板，找出哪些字段是纯文本（→ front_text/back_text）
- 哪些字段包含 `<img>` 标签（→ image_url 字段引用）

**⚠️ 坑 4：同名牌组去重**
- 导入时可能遇到同名牌组
- 策略：**同名则合并**（将 APKG 中的卡片追加到已有牌组）
- 如果用户希望新建，可在前端提供"导入到新牌组"选项
- 默认行为：同名合并，更新 card_count

**⚠️ 坑 5：媒体文件路径引用**
- APKG 中的模板写的是 `<img src="{{BackFile}}">`，字段里是文件名
- 导入后，需将图片复制到 `uploads/`，并更新 `cards.image_url` 为 `/uploads/filename`
- **注意**：图片文件名在 APKG 内是 ASCII（如 `char_0000.jpg`），但 uploads 目录可能有重名
- 策略：导入时用 UUID 重命名图片文件，避免冲突

### 4.3 模型模板解析

**解析 col.models JSON** 是导入中最复杂的部分。步骤：

1. 遍历 `models` 的每个 model，读取 `flds`（字段名列表）和 `tmpls`（模板列表）
2. 对每个模板，解析 `qfmt` 和 `afmt`：
   - 用正则匹配 `{{字段名}}` 占位符
   - 检查哪些字段在 `<img src="{{字段名}}">` 中被引用 → 标记为**图片字段**
   - 其余字段 → 标记为**文本字段**
3. 对每条 note，按字段顺序提取值：
   - 文本字段 → 拼接为 `front_text` 或 `back_text`
   - 图片字段 → 对应的字段值是文件名，在 media 中找到数字ID，从 ZIP 中提取图片

---

## 5. 程序调用流程

### 5.1 导出流程

```
用户点击"导出" → SettingsPage
  │
  ├─ GET /api/export/:deckId
  │    │
  │    ├─ 查询牌组和卡片数据
  │    │   SELECT * FROM cards WHERE deck_id = ?
  │    │
  │    ├─ 创建内存中的 collection.anki2（SQLite）
  │    │   - 写入 col 表（含 models JSON, decks JSON）
  │    │   - 逐条写入 notes 表（front_text → flds）
  │    │   - 逐条写入 cards 表（含转换后的 factor, ivl）
  │    │
  │    ├─ 复制图片到 ZIP（从 uploads/ 读取）
  │    │
  │    ├─ 生成 media JSON
  │    │
  │    └─ JSZip 打包 → 返回 .apkg 文件流
  │
  └─ 浏览器下载文件
```

### 5.2 导入流程

```
用户选择 .apkg 文件 → SettingsPage
  │
  ├─ POST /api/import (multipart: file)
  │    │
  │    ├─ JSZip 解压
  │    │   - 读取 collection.anki2
  │    │   - 读取 media JSON
  │    │   - 提取所有媒体文件到临时目录
  │    │
  │    ├─ 解析 col.models 了解模板结构
  │    │
  │    ├─ 遍历 notes 表
  │    │   ├─ 解析 flds（按 \x1f 分割）
  │    │   ├─ 识别文本字段和图片字段
  │    │   ├─ 文本 → front_text / back_text
  │    │   └─ 图片 → 复制到 uploads/ → image_url
  │    │
  │    ├─ 遍历 cards 表
  │    │   ├─ 转换 factor → ease
  │    │   ├─ 转换 ivl → interval（分钟）
  │    │   ├─ 计算 next_review
  │    │   └─ 写入 calligraphy.db
  │    │
  │    └─ 清理临时文件
  │
  └─ 前端显示导入结果
```

---

## 6. 任务列表（按实现顺序）

| # | 任务 | 依赖 | 预估复杂度 |
|---|------|------|-----------|
| 1 | 安装 `jszip` 依赖 | 无 | 简单 |
| 2 | 新增导出路由 `server/routes/export.ts` | #1 | 中（核心逻辑） |
| 3 | 新增导入路由 `server/routes/import.ts` | #1 | 高（最复杂） |
| 4 | 挂载路由到 `server/index.ts` | #2, #3 | 简单 |
| 5 | 修改 `src/lib/api.ts` 添加 API 调用 | #2, #3 | 简单 |
| 6 | 修改 `SettingsPage.tsx` 添加 UI | #5 | 中 |
| 7 | 用测试 APKG 文件验证导入 | #3 | 验证 |
| 8 | 导出后用 Anki 桌面版验证导出 | #2 | 验证 |
| 9 | 部署到生产环境 | #7, #8 | 简单 |

---

## 7. 依赖包

```json
{
  "dependencies": {
    "jszip": "^3.10.0"
  }
}
```

`uuid` 和 `better-sqlite3` 已安装，无需新增。

---

## 8. 共享知识（跨文件约定）

### 8.1 错误处理约定

所有导入/导出错误使用统一的错误格式：
```typescript
interface ImportResult {
  success: boolean;
  decks: Array<{ id: string; name: string; card_count: number }>;
  errors: Array<{ type: 'parse' | 'media' | 'db'; message: string }>;
}
```

### 8.2 数据库操作约定

- 导入使用事务包装（`db.transaction`），一张卡片失败则回滚整个导入
- 导出只读，无需事务

### 8.3 图片处理约定

- 导出时：图片路径 `/uploads/xxx.jpg` → 提取文件名 `xxx.jpg` → 从磁盘读取 → 写入 ZIP
- 导入时：ZIP 中图片 → UUID 重命名 → 写入 `uploads/` → 路径记录为 `/uploads/uuid.jpg`

### 8.4 模型模板解析约定

导入时，对模板解析走**启发式策略**：
1. 如果有字段名包含 `BackFile` 或 `图片` → 该字段是图片字段
2. 如果模板 `afmt` 中包含 `<img src="{{字段名}}">` → 该字段是图片字段
3. 默认：第一个字段是正面文本，其余字段拼接到背面文本

---

## 9. ⚠️ 全部坑点/边界情况（重点）

### 9.1 APKG 文件结构问题

| # | 坑 | 影响 | 处理 |
|---|-----|------|------|
| P1 | APKG 中可能**没有**图片（纯文本卡片） | 导入会尝试读媒体文件 → 报错 | 检查 `media` 文件是否存在，不存在则跳过图片处理 |
| P2 | APKG 可能是**旧版格式**（Anki 2.0 之前） | schema 不同 | 检查 `col.ver`，低于 11 则提示不兼容 |
| P3 | APKG 中 `collection.anki2` 可能加密（有密码） | 无法打开 SQLite | JSZip 解压时捕获密码错误 |
| P4 | media JSON 中的文件名包含中文/特殊字符 | 文件系统编码问题 | 导入时一律 UUID 重命名 |
| P5 | 一个 APKG 可能包含**多个牌组** | 需要全部导入 | 遍历 `col.decks` JSON 中所有牌组 |

### 9.2 数据转换问题

| # | 坑 | 影响 | 处理 |
|---|-----|------|------|
| P6 | **interval=0** 的卡片（新卡片） | Anki 中 type=0, ivl=0 | 直接映射，无需天数换算 |
| P7 | Anki 的 interval 最大可达 **30 年以上** | 分钟换算可能溢出 | `ivl * 1440` 正常，最大值约 15,768,000 分钟 |
| P8 | Anki factor 最小值 **1300**（1.3），最大值未知 | ease 可能低于 1.3 | 导入后 eas e 限制在 1.3-5.0 范围 |
| P9 | **填空（Cloze）类型卡片** | 字段格式完全不同 | 解析模型类型，Cloze 类型暂不支持，返回错误提示 |
| P10 | 卡片 template 可能有多张（`ord=0`, `ord=1`） | 一张 note 生成多张 card | 只导入 `ord=0`（第一张模板），忽略其他 |
| P11 | **倒序卡片（Reversed）** | ord=1 的卡片正面=背面 | 同上，只导入 ord=0 |

### 9.3 媒体文件问题

| # | 坑 | 影响 | 处理 |
|---|-----|------|------|
| P12 | APKG 中图片可能是 **PNG/SVG/GIF**，不只是 JPG | 文件扩展名不同 | 用文件头检测实际类型，保留原扩展名 |
| P13 | 图片文件可能损坏 | 导入后显示不了 | 捕获文件复制错误，记录到 errors 列表 |
| P14 | 图片可能存在**重名** | 覆盖已有文件 | UUID 重命名，保证唯一性 |
| P15 | 导入时 `uploads/` 目录不存在 | 写入失败 | `fs.mkdirSync` 确保目录存在 |
| P16 | **导出时图片文件不存在**（磁盘被清理） | 导出 ZIP 缺少文件 | 捕获 ENOENT，跳过丢失的图片，记录错误 |

### 9.4 UI/UX 问题

| # | 坑 | 影响 | 处理 |
|---|-----|------|------|
| P17 | 大 APKG 文件（>50MB）导入超时 | API 请求超时 | 设置请求超时 120s，前端显示进度 |
| P18 | 导出大量卡片（>10000）时内存占用高 | 服务器 OOM | 流式处理，不一次性加载全部数据 |
| P19 | 浏览器下载大文件时无反馈 | 用户认为没反应 | 前端先显示"正在生成..."加载状态 |
| P20 | 用户选择非 .apkg 文件上传 | 导入失败 | 前端校验文件扩展名 + 后端校验 ZIP 签名 |

### 9.5 并发与事务问题

| # | 坑 | 影响 | 处理 |
|---|-----|------|------|
| P21 | **导入中途失败**（如第 100 张卡出错） | 部分导入，数据库不完整 | 使用 `db.transaction`，任何错误回滚全部 |
| P22 | 导入时其他用户正在学习 | 数据竞争 | 写锁，导入期间禁止其他写操作 |
| P23 | 同名牌组合并时卡号计数不准确 | card_count 字段错误 | 导入完成后重新 COUNT |

### 9.6 Anki 特有数据

| # | 坑 | 影响 | 处理 |
|---|-----|------|------|
| P24 | Anki 的 `tags` 字段 | 项目没有标签系统 | 导入时忽略 tags，或存到一个新字段备用 |
| P25 | Anki 的 `revlog`（复习历史） | 项目有自己的复习历史 | 不导入 revlog，保留项目原有的学习进度 |
| P26 | 过滤牌组（Filtered Deck） | 临时牌组，数据不稳定 | 跳过 type=3 的牌组 |

---

## 10. 不做的事（明确范围）

- ❌ 不同步导入 Anki 的复习历史
- ❌ 不支持填空（Cloze）类型卡片（提示用户）
- ❌ 不同步牌组配置（每日上限、新卡顺序等）
- ❌ 不支持导入时自动映射不同模型字段（用户需手动确认）

---

## 11. 验证方案

### 导出验证
1. 导出一个牌组 → 在桌面版 Anki 中导入 → 确认卡片内容、图片、排期数据正确
2. 用 `unzip -l` 检查 ZIP 结构是否正确
3. 用 `sqlite3 collection.anki2` 检查数据完整性

### 导入验证
1. 用测试文件 `春江花月夜_书法记忆卡_v4.apkg` 导入 → 确认 191 张卡片全部导入
2. 检查图片是否正确复制到 `uploads/`
3. 检查 ease/interval/repetitions 数据是否正确转换
4. 再次导入同名文件 → 确认去重逻辑正确
5. 导入纯文本 APKG（无图片）→ 确认不报错
