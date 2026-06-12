// ===== Supabase 数据库表行类型映射 =====

/** Supabase cards 表行 */
export interface CardRow {
  id: string;
  deck_id: string;
  front_text: string;
  image_storage_path: string;
  ease: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_review: string | null;
  created_at: string;
  updated_at: string;
}

/** Supabase decks 表行 */
export interface DeckRow {
  id: string;
  name: string;
  card_count: number;
  created_at: string;
  updated_at: string;
}

/** Supabase daily_stats 表行 */
export interface DailyStatsRow {
  date: string;
  cards_studied: number;
  new_cards_learned: number;
  updated_at: string;
}
