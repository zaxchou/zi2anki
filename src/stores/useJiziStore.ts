import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { JiziMatchResult, JiziLayout } from '@/types/jizi';
import { DEFAULT_LAYOUT } from '@/types/jizi';

interface JiziStore {
  text: string;
  results: JiziMatchResult[];
  selections: Record<number, string>;
  layout: JiziLayout;
  scope: 'mine' | 'all';
  styleFilter: string;
  calligrapherFilter: string;
  setText: (t: string) => void;
  setResults: (r: JiziMatchResult[]) => void;
  setSelections: (s: Record<number, string>) => void;
  setLayout: (l: JiziLayout) => void;
  setScope: (s: 'mine' | 'all') => void;
  setStyleFilter: (s: string) => void;
  setCalligrapherFilter: (s: string) => void;
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
      setText: (text) => set({ text }),
      setResults: (results) => set({ results }),
      setSelections: (selections) => set({ selections }),
      setLayout: (layout) => set({ layout }),
      setScope: (scope) => set({ scope }),
      setStyleFilter: (styleFilter) => set({ styleFilter }),
      setCalligrapherFilter: (calligrapherFilter) => set({ calligrapherFilter }),
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
        results: state.results,
        selections: state.selections,
        layout: state.layout,
        scope: state.scope,
        styleFilter: state.styleFilter,
        calligrapherFilter: state.calligrapherFilter,
      }),
    }
  )
);
