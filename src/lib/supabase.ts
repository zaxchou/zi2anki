// ===== Supabase 客户端初始化 =====

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Supabase 客户端单例 */
let supabaseInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端单例。
 * 首次调用时从环境变量读取 URL 和 ANON_KEY 进行初始化。
 * 若环境变量缺失，返回一个最小可用客户端（仅本地模式）。
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        '[Supabase] 环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 未设置，' +
          '同步功能将不可用，仅使用本地模式。'
      );
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseInstance;
}

/**
 * 执行 Supabase 匿名登录。
 * 同一设备会持久化 user_id，跨设备暂不关联。
 *
 * @returns 登录成功返回 true，失败返回 false（降级到纯本地模式）
 */
export async function initSupabaseAuth(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    if (data.session) {
      return true; // 已有有效 session
    }

    // 尝试匿名登录
    const { error: signInError } = await client.auth.signInAnonymously();
    if (signInError) {
      throw signInError;
    }

    return true;
  } catch (err) {
    console.error('[Supabase] 匿名登录失败，降级到本地模式:', err);
    return false;
  }
}

/**
 * 获取当前登录用户的 ID。
 * 匿名登录成功后可用。
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    return data.session?.user?.id || null;
  } catch {
    return null;
  }
}
