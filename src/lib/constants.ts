// ===== 全局常量 =====

/** SM-2 算法默认参数 */
export const SM2_DEFAULTS = {
  INITIAL_EASE: 2.5,
  MIN_EASE: 1.3,
  EASY_BONUS: 1.3,
  AGAIN_EASE_DELTA: -0.20,
  HARD_EASE_DELTA: -0.15,
  EASY_EASE_DELTA: +0.15,
  GRADUATING_INTERVAL: 24 * 60, // 1 天（分钟）
  EASY_GRADUATING_INTERVAL: 4 * 24 * 60, // 4 天
  INITIAL_STEPS: [1, 10], // [1 分钟, 10 分钟] 学习阶梯
} as const;

/** Supabase Storage 存储桶名称 */
export const STORAGE_BUCKET = 'calligraphy-images';

/** 最大图片大小：10 MB */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** 允许的图片 MIME 类型 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 每日新卡学习上限默认值 */
export const DEFAULT_DAILY_NEW_CARD_LIMIT = 20;

/** 后台同步间隔：30 秒 */
export const SYNC_INTERVAL = 30_000;

/** 牌组名称最大长度 */
export const DECK_NAME_MAX_LENGTH = 50;

/** Dexie 数据库名称 */
export const DB_NAME = 'calligraphy-memory';

/** 数据库版本 */
export const DB_VERSION = 1;

/** 每页卡片数量 */
export const CARDS_PER_PAGE = 50;
