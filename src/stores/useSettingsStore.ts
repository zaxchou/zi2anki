// ===== 用户设置状态管理（Zustand + persist 中间件 → localStorage） =====

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings } from '@/types';
import { DEFAULT_DAILY_NEW_CARD_LIMIT, DEFAULT_DAILY_REVIEW_LIMIT } from '@/lib/constants';

interface SettingsStore extends UserSettings {
  /** 设置每日新卡上限 */
  setDailyNewCardLimit: (limit: number) => void;
  /** 设置每日复习上限 */
  setDailyReviewLimit: (limit: number) => void;
  /** 设置深色模式 */
  setDarkMode: (mode: 'system' | 'light' | 'dark') => void;
  /** 更新最后同步时间 */
  setLastSyncAt: (timestamp: string) => void;
  /** 重置为默认设置 */
  resetToDefaults: () => void;
}

const defaultSettings: UserSettings = {
  dailyNewCardLimit: DEFAULT_DAILY_NEW_CARD_LIMIT,
  dailyReviewLimit: DEFAULT_DAILY_REVIEW_LIMIT,
  darkMode: 'system',
  lastSyncAt: null,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setDailyNewCardLimit: (limit: number) => {
        // 限制范围：1 ~ 200
        const clamped = Math.max(1, Math.min(200, Math.round(limit)));
        set({ dailyNewCardLimit: clamped });
      },

      setDailyReviewLimit: (limit: number) => {
        // 限制范围：1 ~ 500
        const clamped = Math.max(1, Math.min(500, Math.round(limit)));
        set({ dailyReviewLimit: clamped });
      },

      setDarkMode: (mode: 'system' | 'light' | 'dark') => {
        set({ darkMode: mode });
      },

      setLastSyncAt: (timestamp: string) => {
        set({ lastSyncAt: timestamp });
      },

      resetToDefaults: () => {
        set({ ...defaultSettings });
      },
    }),
    {
      name: 'calligraphy-settings', // localStorage key
      version: 1,
    }
  )
);
