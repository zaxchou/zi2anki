// ===== Dexie IndexedDB 数据库实例 =====

import Dexie, { type Table } from 'dexie';
import type { Card, Deck, StudySession, DailyStats } from '@/types';
import { DB_NAME, DB_VERSION } from './constants';

/**
 * 书法记忆 Dexie 数据库。
 *
 * 包含 4 张表：
 * - cards:      单字卡片，复合索引 [deck_id + next_review]
 * - decks:      牌组，主键 id
 * - studySessions: 学习会话，索引 deck_id
 * - dailyStats: 每日统计，主键 date
 */
class CalligraphyDB extends Dexie {
  cards!: Table<Card, string>;
  decks!: Table<Deck, string>;
  studySessions!: Table<StudySession, string>;
  dailyStats!: Table<DailyStats, string>;

  constructor() {
    super(DB_NAME);

    this.version(DB_VERSION).stores({
      cards: 'id, deck_id, next_review, [deck_id+next_review], synced',
      decks: 'id, synced',
      studySessions: 'id, deck_id',
      dailyStats: 'date',
    });
  }

  /**
   * 获取指定牌组中到期的卡片。
   *
   * @param deckId - 牌组 ID
   * @param limit - 最大返回数量，不传则不限
   * @returns 到期卡片列表
   */
  async getDueCards(deckId: string, limit?: number): Promise<Card[]> {
    const now = new Date().toISOString();
    let collection = this.cards
      .where('[deck_id+next_review]')
      .between(
        [deckId, Dexie.minKey],
        [deckId, now],
        true, // include lower bound
        true // include upper bound
      );

    if (limit !== undefined && limit > 0) {
      collection = collection.limit(limit);
    }

    return collection.toArray();
  }

  /**
   * 获取指定牌组中的新卡片（interval = 0，即未学过的卡片）。
   *
   * @param deckId - 牌组 ID
   * @param limit - 最大返回数量
   * @returns 新卡片列表
   */
  async getNewCards(deckId: string, limit?: number): Promise<Card[]> {
    let collection = this.cards
      .where('deck_id')
      .equals(deckId)
      .filter((card) => card.interval === 0);

    if (limit !== undefined && limit > 0) {
      collection = collection.limit(limit);
    }

    return collection.toArray();
  }

  /**
   * 插入或更新一张卡片。
   * 如果卡片已存在（相同 id），则更新；否则插入。
   */
  async upsertCard(card: Card): Promise<void> {
    await this.cards.put(card);
  }

  /**
   * 批量插入或更新卡片。
   */
  async upsertCards(cards: Card[]): Promise<void> {
    await this.cards.bulkPut(cards);
  }

  /**
   * 插入或更新一个牌组。
   */
  async upsertDeck(deck: Deck): Promise<void> {
    await this.decks.put(deck);
  }

  /**
   * 获取未同步的记录数量。
   */
  async getUnsyncedCount(): Promise<number> {
    const cardsCount = await this.cards.filter((card) => !card.synced).count();
    const decksCount = await this.decks.filter((deck) => !deck.synced).count();
    return cardsCount + decksCount;
  }

  /**
   * 获取所有未同步的卡片。
   */
  async getUnsyncedCards(): Promise<Card[]> {
    return this.cards.filter((card) => !card.synced).toArray();
  }

  /**
   * 获取所有未同步的牌组。
   */
  async getUnsyncedDecks(): Promise<Deck[]> {
    return this.decks.filter((deck) => !deck.synced).toArray();
  }

  /**
   * 获取所有卡片（按 deck_id 筛选）。
   */
  async getCardsByDeck(deckId: string): Promise<Card[]> {
    return this.cards.where('deck_id').equals(deckId).toArray();
  }
}

/** 数据库单例 */
export const db = new CalligraphyDB();
