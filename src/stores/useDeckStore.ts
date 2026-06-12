// ===== 牌组状态管理（Zustand + Express API） =====

import { create } from 'zustand';
import type { Deck } from '@/types';
import { DECK_NAME_MAX_LENGTH } from '@/lib/constants';
import {
  fetchDecks,
  createDeck as createDeckApi,
  renameDeck as renameDeckApi,
  deleteDeckApi,
  updateCardCountApi,
} from '@/lib/api';

interface DeckStore {
  /** 所有牌组列表 */
  decks: Deck[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 从服务端加载所有牌组 */
  loadDecks: () => Promise<void>;
  /** 创建新牌组 */
  createDeck: (name: string) => Promise<Deck | null>;
  /** 重命名牌组 */
  renameDeck: (id: string, name: string) => Promise<void>;
  /** 删除牌组（级联删除其中所有卡片） */
  deleteDeck: (id: string) => Promise<void>;
  /** 更新牌组卡片计数 */
  updateCardCount: (deckId: string, count: number) => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
}

export const useDeckStore = create<DeckStore>((set) => ({
  decks: [],
  loading: false,
  error: null,

  loadDecks: async () => {
    set({ loading: true, error: null });
    try {
      const decks = await fetchDecks();
      set({ decks, loading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '无法加载牌组列表';
      set({ error: message, loading: false });
    }
  },

  createDeck: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ error: '牌组名称不能为空' });
      return null;
    }
    if (trimmed.length > DECK_NAME_MAX_LENGTH) {
      set({ error: `牌组名称不能超过 ${DECK_NAME_MAX_LENGTH} 个字符` });
      return null;
    }

    try {
      const deck = await createDeckApi(trimmed);
      set((state) => ({ decks: [deck, ...state.decks], error: null }));
      return deck;
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建牌组失败';
      set({ error: message });
      return null;
    }
  },

  renameDeck: async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ error: '牌组名称不能为空' });
      return;
    }
    if (trimmed.length > DECK_NAME_MAX_LENGTH) {
      set({ error: `牌组名称不能超过 ${DECK_NAME_MAX_LENGTH} 个字符` });
      return;
    }

    try {
      const updated = await renameDeckApi(id, trimmed);
      set((state) => ({
        decks: state.decks.map((d) => (d.id === id ? updated : d)),
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '重命名失败';
      set({ error: message });
    }
  },

  deleteDeck: async (id: string) => {
    try {
      await deleteDeckApi(id);
      set((state) => ({
        decks: state.decks.filter((d) => d.id !== id),
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除牌组失败';
      set({ error: message });
    }
  },

  updateCardCount: async (deckId: string, count: number) => {
    try {
      const updated = await updateCardCountApi(deckId, count);
      set((state) => ({
        decks: state.decks.map((d) => (d.id === deckId ? updated : d)),
      }));
    } catch (err) {
      console.error('[useDeckStore] updateCardCount 失败:', err);
    }
  },

  clearError: () => set({ error: null }),
}));
