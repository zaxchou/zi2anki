# 集字功能全面改进计划

> 基于中华珍宝馆（g2.ltfc.net）调研 + 现有 JiziPage 代码审查
> 日期：2026-06-19

---

## 一、调研总结：中华珍宝馆 vs 我们的差距

### 1.1 前端展示差距（用户指出的重点）

| 方面 | 我们的现状 | 中华珍宝馆 | 差距评级 |
|------|-----------|-----------|---------|
| **单字信息展示** | 只有图片 + 小角标 "n/N" | 每字下方显示：书家名、字帖来源 | 🔴 大 |
| **预览布局** | 嵌入页面内，左侧控制面板占空间 | 独立全屏预览页，沉浸式 | 🔴 大 |
| **排版方向** | 竖排/横排 2 种 | 竖排RL/竖排LR/横排RL/横排LR 4 种 | 🟡 中 |
| **间距控制** | ToggleButton 三档预设 | 滑块（Slider）连续调节 | 🟡 中 |
| **颜色/风格** | 宣纸纹理 / 纯白 2 种 | 原色/黑色/朱砂色 + 自定义 | 🟡 中 |
| **背景模版** | CSS radial-gradient 模拟宣纸 | 多种预设模版 | 🟢 小 |
| **变体切换** | Dialog 弹窗选图 | 行内展开 + 底部 sheet | 🟡 中 |
| **字符来源标注** | 无 | 每字标注书家+字帖 | 🔴 大 |
| **空状态** | 简单文字提示 | 精美引导图 | 🟢 小 |

### 1.2 功能差距

| 功能 | 我们有 | 他们有 | 优先级 |
|------|--------|--------|--------|
| 诗文预设 | ❌ | ✅ 诗文/对联/书论 | 🟡 中 |
| 清除标点 | ❌ | ✅ | 🟢 小 |
| 手动分行 | ❌ | ✅ | 🟡 中 |
| 简繁转换 | ❌ | ✅ | 🟢 小 |
| 书家/书体筛选 | ❌ | ✅ 全局风格选择 | 🔴 高 |
| 单字独立选风格 | ❌ | ✅ 每字可来自不同书家 | 🔴 高 |
| 相似书家推荐 | ❌ | ✅ association 关联 | 🟢 小 |
| 字库范围 | 已订阅牌组 | 全平台 | 🔴 高（受限于数据量） |

### 1.3 技术架构差距

| 方面 | 我们 | 他们 |
|------|------|------|
| 图片存储 | 本地文件系统 | CDN + auth_key 签名 |
| 字库规模 | 已订阅牌组的单字卡片 | 全平台 MongoDB 字帖库 |
| 单字元数据 | 基础（style, calligrapher） | 丰富（charBound, particle, age, traditional, pinyin） |
| 前端框架 | React + MUI | Next.js 14 + MUI |
| 导出方式 | Canvas 前端渲染 → toBlob 下载 | 推测后端渲染 |

---

## 二、改进计划（分 3 个阶段）

### 阶段一：前端展示优化（本次重点，不依赖后端改动）

#### P1-1 单字信息卡片增强

**现状**：JiziCell 只显示图片，角标 "1/3" 表示变体数。

**改进**：
- 每字下方显示 **书家名**（如"王羲之"）+ **字帖来源**（如"戏鸿堂法帖"）
- 小字显示，灰色，类似中华珍宝馆的 `春 / 王羲之` 标签
- 如果多个变体来自不同书家，角标可点击弹出快速切换

**涉及文件**：`src/components/jizi/JiziCell.tsx`

**效果示意**：
```
┌──────────┐
│   [字图]  │
│          │
└──────────┘
  王羲之
  戏鸿堂法帖
  [1/3] ▸
```

#### P1-2 预览区全屏模式

**现状**：JiziPreview 嵌入页面 Grid 中，左边是控制面板。

**改进**：
- 增加"全屏预览"按钮（类似中华珍宝馆的"预览"链接）
- 全屏模式下：隐藏控制面板，只显示集字作品 + 底部工具栏
- 底部工具栏：颜色 / 背景 / 微调 / 导出
- 点击空白处或 ESC 退出全屏

**涉及文件**：新增 `src/components/jizi/JiziFullscreenPreview.tsx`

#### P1-3 间距改为滑块（Slider）

**现状**：字距和行距用 ToggleButton 三档（紧凑/标准/宽松）。

**改进**：
- 改为 MUI Slider，连续调节
- 字距范围：0 ~ fontSize*0.4
- 行距范围：0 ~ fontSize*0.6
- 实时预览（debounced）

**涉及文件**：`src/components/jizi/JiziInputPanel.tsx`

#### P1-4 排版方向扩展为 4 种

**现状**：竖排（从右到左）/ 横排（从左到右）2 种。

**改进**：
- 竖排·从右到左（默认）
- 竖排·从左到右
- 横排·从右到左
- 横排·从左到右

**涉及文件**：
- `src/types/jizi.ts` — 扩展 `JiziDirection` 类型
- `src/components/jizi/JiziInputPanel.tsx` — UI
- `src/components/jizi/JiziPreview.tsx` — 渲染逻辑
- `src/lib/jiziExport.ts` — Canvas 导出

#### P1-5 颜色预设扩展

**现状**：宣纸纹理 / 纯白 2 种。

**改进**：
- 原色（保持图片原始颜色）
- 墨色（纯黑 #1a1a1a 背景，白色文字）
- 朱砂色（#8b0000 背景）
- 宣纸（现有纹理）
- 纯白（现有）

> 注意：这只是预览区/导出时的背景色变化，不影响字图本身。

**涉及文件**：
- `src/types/jizi.ts` — 扩展 `JiziBackground`
- `src/components/jizi/JiziInputPanel.tsx`
- `src/components/jizi/JiziPreview.tsx`
- `src/lib/jiziExport.ts`

#### P1-6 变体切换改为底部 Sheet

**现状**：Dialog 弹窗选择变体。

**改进**：
- 改为底部 Drawer / BottomSheet 样式
- 横向滚动缩略图列表
- 每个缩略图下方标注书家+字帖
- 点击即切换，无需确认按钮

**涉及文件**：
- `src/components/jizi/JiziSwitcherDialog.tsx` → 改为 `JiziSwitcherSheet.tsx`
- `src/pages/JiziPage.tsx` — 替换引用

---

### 阶段二：功能增强（需要后端配合）

#### P2-1 字库查询范围扩展

**现状**：`jiziRouter` 只查已订阅牌组（`user_subscriptions`）+ 自己创建的牌组。

**改进**：
- 新增可选查询参数 `?scope=all` 查询所有公开牌组
- 默认仍查已订阅（兼容现有行为）
- 前端加 Toggle："仅已订阅" / "全部公开"

**涉及文件**：
- `server/routes/jizi.ts`
- `src/components/jizi/JiziInputPanel.tsx`
- `src/lib/api.ts`

#### P2-2 书家/书体全局筛选

**现状**：无筛选，所有匹配结果混在一起。

**改进**：
- 在 JiziInputPanel 增加筛选行：
  - 书体 Chip 筛选（全部 / 楷 / 行 / 草 / 隶 / 篆）
  - 书家 Dropdown（从匹配结果中提取）
- 筛选后只显示符合条件的结果
- 如果某个字在筛选条件下无匹配，显示"缺字"提示

**涉及文件**：
- `src/components/jizi/JiziInputPanel.tsx`
- `src/pages/JiziPage.tsx` — 筛选状态管理
- `server/routes/jizi.ts` — 可选：后端筛选提高性能

#### P2-3 诗文预设

**现状**：手动输入文字。

**改进**：
- 在输入区上方增加"预设"按钮
- 点击弹出预设列表（分类：诗文 / 对联 / 名言）
- 预设内容来自前端常量（无需后端）
- 示例：
  - 诗文：春江花月夜、静夜思、登鹳雀楼...
  - 对联：海纳百川、厚德载物...
  - 名言：天道酬勤、宁静致远...

**涉及文件**：
- 新增 `src/components/jizi/JiziPresetDialog.tsx`
- `src/components/jizi/JiziInputPanel.tsx`

#### P2-4 手动分行

**现状**：自动按 colCount 分行。

**改进**：
- 输入框中用空行表示分行
- 或增加"插入分行标记"按钮
- 预览/导出时按标记分行而非 colCount

**涉及文件**：
- `src/components/jizi/JiziInputPanel.tsx`
- `src/components/jizi/JiziPreview.tsx`
- `src/lib/jiziExport.ts`

---

### 阶段三：长期优化（依赖字库增长）

#### P3-1 单字元数据扩展
- 数据库加 `charBound`、`particle` 字段，支持智能裁剪
- 预计算去色图（`decolorizeImg`）

#### P3-2 相似书家推荐
- 利用 marketplace_decks 的 calligrapher 数据
- 同书体/同时代 → 推荐

#### P3-3 智能排版
- 自动检测文字内容（诗句 vs 短语）
- 推荐最佳方向 + 列字数

---

## 三、实施优先级矩阵

```
影响力 ↑
  高  │ P1-1 来源标注    │ P2-1 全字库查询
      │ P1-2 全屏预览    │ P2-2 书家筛选
      │ P1-4 四向排版    │
      │ P1-6 底部Sheet   │
      │                  │
  低  │ P1-3 滑块间距    │ P2-3 诗文预设
      │ P1-5 颜色预设    │ P2-4 手动分行
      │                  │ P3-X 长期优化
      └──────────────────┴─────────────
         低 ← 实现成本 → 高
```

**建议顺序**：P1-1 → P1-2 → P1-4 → P1-6 → P1-3 → P1-5 → P2-2 → P2-1 → P2-3 → P2-4

---

## 四、涉及文件汇总

| 文件 | 阶段 | 改动类型 |
|------|------|---------|
| `src/types/jizi.ts` | P1-3, P1-4, P1-5 | 类型扩展 |
| `src/components/jizi/JiziCell.tsx` | P1-1 | 增强显示 |
| `src/components/jizi/JiziPreview.tsx` | P1-2, P1-4 | 全屏模式 + 四向排版 |
| `src/components/jizi/JiziInputPanel.tsx` | P1-3, P1-4, P1-5, P2-2, P2-3, P2-4 | 控件升级 |
| `src/components/jizi/JiziSwitcherDialog.tsx` | P1-6 | 改为 Sheet |
| `src/pages/JiziPage.tsx` | P1-2, P2-2 | 状态管理 |
| `src/lib/jiziExport.ts` | P1-4, P1-5 | 导出适配 |
| `src/lib/api.ts` | P2-1 | 新增 API |
| `server/routes/jizi.ts` | P2-1 | 扩展查询 |
| **新建** `src/components/jizi/JiziFullscreenPreview.tsx` | P1-2 | 全屏预览 |
| **新建** `src/components/jizi/JiziPresetDialog.tsx` | P2-3 | 预设选择 |
| **新建** `src/components/jizi/JiziSwitcherSheet.tsx` | P1-6 | 底部变体选择 |

---

## 五、风险与注意事项

1. **字库数据量**：当前只查已订阅牌组，即使扩展到全部公开牌组，字库也有限。P2-1 需要先确认数据库中有多少可用单字卡片。
2. **全屏预览的移动端适配**：需要处理 iOS Safari 的全屏 API 限制。
3. **Canvas 导出兼容四向排版**：P1-4 的四种方向都需要在导出逻辑中正确处理。
4. **不要引入额外依赖**：所有 UI 组件用 MUI 内置（Slider, Drawer, Chip 等），不新增第三方库。
