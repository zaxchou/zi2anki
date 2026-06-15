// ===== 用户认证状态管理（Zustand + persist 中间件 → localStorage） =====

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

const API_BASE = '';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || '登录失败');
          }
          set({ user: data.user, token: data.token, isLoading: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '登录失败';
          set({ error: msg, isLoading: false });
          throw err;
        }
      },

      register: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || '注册失败');
          }
          set({ user: data.user, token: data.token, isLoading: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '注册失败';
          set({ error: msg, isLoading: false });
          throw err;
        }
      },

      logout: () => {
        set({ user: null, token: null, error: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'zi2anki-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
