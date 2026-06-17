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

/** 排版方向 */
export type JiziDirection = 'vertical' | 'horizontal';

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
  direction: 'vertical',
  fontSize: 120,
  colCount: 6,
  charGap: 0.15,
  lineGap: 0.25,
  background: 'xuan',
};
