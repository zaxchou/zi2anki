import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { JiziMatchResult, JiziLayout } from '@/types/jizi';
import { DEFAULT_LAYOUT } from '@/types/jizi';
import type { JiziHistoryItem } from '@/lib/api';

interface JiziStore {
  text: string;
  results: JiziMatchResult[];
  selections: Record<number, string>;
  layout: JiziLayout;
  scope: 'mine' | 'all';
  styleFilter: string;
  calligrapherFilter: string;
  history: JiziHistoryItem[];
  setText: (t: string) => void;
  setResults: (r: JiziMatchResult[]) => void;
  setSelections: (s: Record<number, string>) => void;
  setLayout: (l: JiziLayout) => void;
  setScope: (s: 'mine' | 'all') => void;
  setStyleFilter: (s: string) => void;
  setCalligrapherFilter: (s: string) => void;
  setHistory: (h: JiziHistoryItem[]) => void;
  clearAll: () => void;
}

export const useJiziStore = create<JiziStore>()(
  persist(
    (set) => ({
      text: '',
      results: [],
      selections: {},
      layout: { ...DEFAULT_LAYOUT },
      scope: 'all',
      styleFilter: '',
      calligrapherFilter: '',
      history: [],
      setText: (text) => set({ text }),
      setResults: (results) => set({ results }),
      setSelections: (selections) => set({ selections }),
      setLayout: (layout) => set({ layout }),
      setScope: (scope) => set({ scope }),
      setStyleFilter: (styleFilter) => set({ styleFilter }),
      setCalligrapherFilter: (calligrapherFilter) => set({ calligrapherFilter }),
      setHistory: (history) => set({ history }),
      clearAll: () => set({
        text: '',
        results: [],
        selections: {},
        layout: { ...DEFAULT_LAYOUT },
      }),
    }),
    {
      name: '背字帖-jizi',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        text: state.text,
        selections: state.selections,
        layout: state.layout,
        scope: state.scope,
        styleFilter: state.styleFilter,
        calligrapherFilter: state.calligrapherFilter,
        // history 不持久化，每次加载重新拉取
      }),
    }
  )
);
