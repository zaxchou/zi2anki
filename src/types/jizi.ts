/** 集字功能类型定义 */

/** 单个字的一次匹配命中 */
export interface CharHit {
  card_id: string;
  image_url: string;
  deck_id: string;
  deck_name: string;
  style: string;
  calligrapher: string;
  front_text_raw: string;
  sort_key: number;
}

/** 单个字的匹配结果 */
export interface JiziMatchResult {
  char: string;
  hits: CharHit[];
}

/** 匹配接口返回 */
export interface JiziMatchResponse {
  results: JiziMatchResult[];
  meta: {
    scanned: number;
    ms: number;
    unique_chars: number;
  };
}

/** 排版方向 — 4 种
 *  vertical-rl: 竖排，列从右到左（默认）
 *  vertical-lr: 竖排，列从左到右
 *  horizontal-lr: 横排，行从上到下
 *  horizontal-rl: 横排，行从下到上
 */
export type JiziDirection = 'vertical-rl' | 'vertical-lr' | 'horizontal-lr' | 'horizontal-rl';

/** 背景类型 */
export type JiziBackground = 'xuan' | 'white';

/** 排版参数 */
export interface JiziLayout {
  direction: JiziDirection;
  fontSize: number;      // 80 | 120 | 160
  colCount: number;      // 竖排每列字数 / 横排每行字数
  charGap: number;       // 字号倍数 0.05 | 0.15 | 0.30
  lineGap: number;       // 字号倍数 0.10 | 0.25 | 0.50
  background: JiziBackground;
}

/** 默认排版 */
export const DEFAULT_LAYOUT: JiziLayout = {
  direction: 'vertical-rl',
  fontSize: 120,
  colCount: 6,
  charGap: 0.15,
  lineGap: 0.25,
  background: 'xuan',
};
