// ===== 学习会话状态管理（Zustand + Express API） =====

import { create } from 'zustand';
import type { Card, Rating, StudySession } from '@/types';
import { calculateNextReview } from '@/lib/sm2';
import { DEFAULT_DAILY_NEW_CARD_LIMIT, SM2_DEFAULTS } from '@/lib/constants';
import {
  fetchDueCards,
  fetchNewCards,
  fetchDailyStats,
  upsertDailyStats,
  updateCard,
  createStudySession as createStudySessionApi,
  endStudySession as endStudySessionApi,
} from '@/lib/api';

/** 学习阶段 */
type StudyPhase = 'idle' | 'loading' | 'studying' | 'complete';

interface StudyStore {
  /** 当前学习阶段 */
  phase: StudyPhase;
  /** 当前牌组 ID */
  deckId: string | null;
  /** 学习队列（待复习的卡片） */
  queue: Card[];
  /** 当前卡片索引 */
  currentIndex: number;
  /** 当前学习会话 */
  session: StudySession | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 初始化学习会话：加载到期卡片 + 新卡片 */
  startSession: (deckId: string, dailyNewCardLimit?: number) => Promise<void>;
  /** 对当前卡片评分并前进到下一张 */
  rateCard: (rating: Rating) => Promise<void>;
  /** 结束当前学习会话 */
  endSession: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 清除错误 */
  clearError: () => void;
}

const initialRatings = { again: 0, hard: 0, good: 0, easy: 0 };

export const useStudyStore = create<StudyStore>((set, get) => ({
  phase: 'idle',
  deckId: null,
  queue: [],
  currentIndex: 0,
  session: null,
  loading: false,
  error: null,

  startSession: async (deckId: string, dailyNewCardLimit?: number) => {
    set({ loading: true, error: null, deckId });

    try {
      const limit = dailyNewCardLimit ?? DEFAULT_DAILY_NEW_CARD_LIMIT;

      // 并行加载到期卡片和每日统计
      const [dueCards, todayStats] = await Promise.all([
        fetchDueCards(deckId),
        fetchDailyStats(new Date().toISOString().slice(0, 10)),
      ]);

      // 计算今天还能学多少新卡
      const newCardsLearnedToday = todayStats.new_cards_learned;
      const remainingNewCards = Math.max(0, limit - newCardsLearnedToday);

      // 加载新卡片
      let newCards: Card[] = [];
      if (remainingNewCards > 0) {
        newCards = await fetchNewCards(deckId, remainingNewCards);
      }

      // 合并队列：到期卡排在前面
      const queue = [...dueCards, ...newCards];

      if (queue.length === 0) {
        // 没有需要学习的卡片
        set({
          phase: 'complete',
          queue: [],
          currentIndex: 0,
          session: {
            id: crypto.randomUUID(),
            deck_id: deckId,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            cards_studied: 0,
            ratings: { ...initialRatings },
          },
          loading: false,
        });
        return;
      }

      // 创建学习会话
      const session = await createStudySessionApi(
        deckId,
        new Date().toISOString()
      );

      set({
        phase: 'studying',
        queue,
        currentIndex: 0,
        session,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法开始学习';
      set({ error: message, loading: false, phase: 'idle' });
    }
  },

  rateCard: async (rating: Rating) => {
    const { queue, currentIndex, session } = get();
    if (currentIndex >= queue.length || !session) return;

    const card = queue[currentIndex];
    const now = new Date().toISOString();

    try {
      // 使用 SM-2 算法计算新状态
      const sm2Input = {
        ease: card.ease || SM2_DEFAULTS.INITIAL_EASE,
        interval: card.interval,
        repetitions: card.repetitions,
      };
      const output = calculateNextReview(rating, sm2Input);

      // 更新卡片（通过 API）
      const wasNew = card.interval === 0;
      await updateCard(card.id, {
        ease: output.ease,
        interval: output.interval,
        repetitions: output.repetitions,
        next_review: output.next_review,
        last_review: now,
      });

      // 更新本地队列中的卡片（避免重新加载）
      queue[currentIndex] = {
        ...card,
        ease: output.ease,
        interval: output.interval,
        repetitions: output.repetitions,
        next_review: output.next_review,
        last_review: now,
        updated_at: now,
      };

      // 更新学习会话的评分统计
      const updatedRatings = { ...session.ratings };
      switch (rating) {
        case 1:
          updatedRatings.again += 1;
          break;
        case 2:
          updatedRatings.hard += 1;
          break;
        case 3:
          updatedRatings.good += 1;
          break;
        case 4:
          updatedRatings.easy += 1;
          break;
      }

      const updatedSession: StudySession = {
        ...session,
        cards_studied: session.cards_studied + 1,
        ratings: updatedRatings,
      };

      // 更新每日统计
      const today = now.slice(0, 10);
      const existingStats = await fetchDailyStats(today);
      await upsertDailyStats(today, {
        cards_studied: (existingStats.cards_studied ?? 0) + 1,
        new_cards_learned:
          (existingStats.new_cards_learned ?? 0) + (wasNew ? 1 : 0),
      });

      // 前进到下一张卡片
      const nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        // 队列已完成
        set({ currentIndex: nextIndex, session: updatedSession });
        await get().endSession();
      } else {
        set({ currentIndex: nextIndex, session: updatedSession });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '评分失败';
      set({ error: message });
    }
  },

  endSession: async () => {
    const { session } = get();
    if (!session) return;

    try {
      const now = new Date().toISOString();
      const finalSession = await endStudySessionApi(session.id, {
        ended_at: now,
        cards_studied: session.cards_studied,
        ratings: session.ratings,
      });
      set({ phase: 'complete', session: finalSession });
    } catch (err) {
      console.error('[useStudyStore] endSession 失败:', err);
      set({ phase: 'complete' });
    }
  },

  reset: () => {
    set({
      phase: 'idle',
      deckId: null,
      queue: [],
      currentIndex: 0,
      session: null,
      loading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
