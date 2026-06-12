// ===== SyncService：本地 ↔ 远程同步 =====

import type { Card, Deck, DailyStats } from '@/types';
import type { CardRow, DeckRow, DailyStatsRow } from '@/types/supabase';
import { db } from './db';
import { getSupabaseClient } from './supabase';
import { SYNC_INTERVAL, STORAGE_BUCKET } from './constants';

/**
 * 同步服务。
 *
 * 策略：先拉取远程更新（last-write-wins），再推送本地变更。
 * 后台模式：每 SYNC_INTERVAL ms 自动拉推 + 页面隐藏时触发推送。
 */
export class SyncService {
  private backgroundTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private isRunning = false;

  /**
   * 完整同步：先拉取远程更新，再推送本地变更。
   * 通常在应用启动时调用一次。
   */
  async fullSync(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.pullRemote();
      await this.pushLocal();
    } catch (err) {
      console.error('[Sync] fullSync 失败:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 从 Supabase 拉取远程更新。
   * 查询 updated_at > last_sync_at 的记录，以 last-write-wins 策略覆盖本地。
   */
  async pullRemote(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      // 获取上次同步时间
      const settings = await db.dailyStats.get('__settings__');
      const lastSyncAt = settings?.cards_studied
        ? new Date(settings.cards_studied * 1000).toISOString()
        : new Date(0).toISOString();

      // --- 拉取远程卡片 ---
      const { data: remoteCards, error: cardsError } = await client
        .from('cards')
        .select('*')
        .gt('updated_at', lastSyncAt);

      if (cardsError) {
        console.error('[Sync] 拉取远程卡片失败:', cardsError);
      } else if (remoteCards) {
        for (const row of remoteCards as CardRow[]) {
          const localCard = await db.cards.get(row.id);
          const remoteUpdatedAt = new Date(row.updated_at).getTime();
          const localUpdatedAt = localCard
            ? new Date(localCard.updated_at).getTime()
            : 0;

          if (!localCard || remoteUpdatedAt > localUpdatedAt) {
            // 远程版本更新：覆盖本地
            const card: Card = {
              id: row.id,
              deck_id: row.deck_id,
              front_text: row.front_text,
              image_url: '', // 远程图片 URL 由 storage 获取
              image_storage_path: row.image_storage_path,
              ease: row.ease,
              interval: row.interval,
              repetitions: row.repetitions,
              next_review: row.next_review,
              last_review: row.last_review,
              created_at: row.created_at,
              updated_at: row.updated_at,
              synced: true,
            };
            // 尝试生成远程图片 URL
            if (row.image_storage_path) {
              const { data: publicUrl } = client.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(row.image_storage_path);
              card.image_url = publicUrl?.publicUrl || '';
            }
            await db.cards.put(card);
          }
          // 否则保留本地版本（待 pushLocal 推送）
        }
      }

      // --- 拉取远程牌组 ---
      const { data: remoteDecks, error: decksError } = await client
        .from('decks')
        .select('*')
        .gt('updated_at', lastSyncAt);

      if (decksError) {
        console.error('[Sync] 拉取远程牌组失败:', decksError);
      } else if (remoteDecks) {
        for (const row of remoteDecks as DeckRow[]) {
          const localDeck = await db.decks.get(row.id);
          const remoteUpdatedAt = new Date(row.updated_at).getTime();
          const localUpdatedAt = localDeck
            ? new Date(localDeck.updated_at).getTime()
            : 0;

          if (!localDeck || remoteUpdatedAt > localUpdatedAt) {
            const deck: Deck = {
              id: row.id,
              name: row.name,
              card_count: row.card_count,
              created_at: row.created_at,
              updated_at: row.updated_at,
              synced: true,
            };
            await db.decks.put(deck);
          }
        }
      }

      // --- 拉取远程每日统计 ---
      const { data: remoteStats, error: statsError } = await client
        .from('daily_stats')
        .select('*')
        .gt('updated_at', lastSyncAt);

      if (statsError) {
        console.error('[Sync] 拉取远程统计失败:', statsError);
      } else if (remoteStats) {
        for (const row of remoteStats as DailyStatsRow[]) {
          const localStats = await db.dailyStats.get(row.date);
          const remoteUpdatedAt = new Date(row.updated_at).getTime();

          if (!localStats || remoteUpdatedAt > 0) {
            const stats: DailyStats = {
              date: row.date,
              cards_studied: row.cards_studied,
              new_cards_learned: row.new_cards_learned,
            };
            await db.dailyStats.put(stats);
          }
        }
      }

      // 更新 last_sync_at 标记
      const now = Date.now();
      await db.dailyStats.put({
        date: '__settings__',
        cards_studied: Math.floor(now / 1000),
        new_cards_learned: 0,
      });
    } catch (err) {
      console.error('[Sync] pullRemote 异常:', err);
    }
  }

  /**
   * 将本地未同步的变更推送到 Supabase。
   * 查询 synced=false 的记录，UPSERT 到远程，然后标记 synced=true。
   */
  async pushLocal(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      // --- 推送未同步卡片 ---
      const unsyncedCards = await db.getUnsyncedCards();
      for (const card of unsyncedCards) {
        try {
          const cardRow: CardRow = {
            id: card.id,
            deck_id: card.deck_id,
            front_text: card.front_text,
            image_storage_path: card.image_storage_path,
            ease: card.ease,
            interval: card.interval,
            repetitions: card.repetitions,
            next_review: card.next_review,
            last_review: card.last_review,
            created_at: card.created_at,
            updated_at: card.updated_at,
          };

          const { error } = await client.from('cards').upsert(cardRow, {
            onConflict: 'id',
          });

          if (error) {
            console.error(`[Sync] 推送卡片 ${card.id} 失败:`, error);
          } else {
            // 标记为已同步
            await db.cards.update(card.id, { synced: true });
          }
        } catch (err) {
          console.error(`[Sync] 推送卡片 ${card.id} 异常:`, err);
        }
      }

      // --- 推送未同步牌组 ---
      const unsyncedDecks = await db.getUnsyncedDecks();
      for (const deck of unsyncedDecks) {
        try {
          const deckRow: DeckRow = {
            id: deck.id,
            name: deck.name,
            card_count: deck.card_count,
            created_at: deck.created_at,
            updated_at: deck.updated_at,
          };

          const { error } = await client.from('decks').upsert(deckRow, {
            onConflict: 'id',
          });

          if (error) {
            console.error(`[Sync] 推送牌组 ${deck.id} 失败:`, error);
          } else {
            await db.decks.update(deck.id, { synced: true });
          }
        } catch (err) {
          console.error(`[Sync] 推送牌组 ${deck.id} 异常:`, err);
        }
      }

      // --- 推送每日统计 ---
      const allStats = await db.dailyStats
        .filter((s) => s.date !== '__settings__')
        .toArray();
      for (const stats of allStats) {
        try {
          const row: DailyStatsRow = {
            date: stats.date,
            cards_studied: stats.cards_studied,
            new_cards_learned: stats.new_cards_learned,
            updated_at: new Date().toISOString(),
          };

          const { error } = await client.from('daily_stats').upsert(row, {
            onConflict: 'date',
          });

          if (error) {
            console.error(`[Sync] 推送统计 ${stats.date} 失败:`, error);
          }
        } catch (err) {
          console.error(`[Sync] 推送统计 ${stats.date} 异常:`, err);
        }
      }
    } catch (err) {
      console.error('[Sync] pushLocal 异常:', err);
    }
  }

  /**
   * 启动后台同步。
   * - 每 SYNC_INTERVAL ms 自动执行 pushLocal
   * - 页面隐藏时（切换标签页/锁屏）触发 pushLocal
   */
  startBackgroundSync(): void {
    this.stopBackgroundSync();

    // 定时同步
    this.backgroundTimer = setInterval(() => {
      this.pushLocal().catch((err) => {
        console.error('[Sync] 后台同步失败:', err);
      });
    }, SYNC_INTERVAL);

    // 页面隐藏时同步
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.pushLocal().catch((err) => {
          console.error('[Sync] 页面隐藏同步失败:', err);
        });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * 停止后台同步。
   */
  stopBackgroundSync(): void {
    if (this.backgroundTimer !== null) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }

    if (this.visibilityHandler !== null) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

/** SyncService 单例 */
export const syncService = new SyncService();
