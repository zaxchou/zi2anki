// ===== Express API 客户端 =====

import type { Card, Deck, StudySession, DailyStats, MarketplaceDeck, PublishDeckData } from '@/types';
import { useAuthStore } from '@/stores/useAuthStore';

const API_BASE = '';

/** 获取本地日期字符串 YYYY-MM-DD（不受 UTC 时区偏移影响） */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 将服务端图片路径转为完整 URL（用于 <img src> 显示） */
export function getImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  return `${API_BASE}${imageUrl}`;
}

// ===== 通用 fetch 封装 =====

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // 自动携带认证 token
  const { token, logout } = useAuthStore.getState();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options?.headers as Record<string, string> };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    logout();
    window.location.href = '/login';
    throw new Error('认证已过期，请重新登录');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error || res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ===== 牌组 API =====

export function fetchDecks(subscribedOnly?: boolean): Promise<Deck[]> {
  const qs = subscribedOnly ? '?subscribed=1' : '';
  return request<Deck[]>(`/api/decks${qs}`);
}

export function createDeck(name: string): Promise<Deck> {
  return request<Deck>('/api/decks', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameDeck(id: string, name: string): Promise<Deck> {
  return request<Deck>(`/api/decks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deleteDeckApi(id: string): Promise<{ success: boolean }> {
  return request(`/api/decks/${id}`, { method: 'DELETE' });
}

export function resetDeckProgress(id: string): Promise<{ success: boolean; reset_count: number }> {
  return request(`/api/decks/${id}/reset-progress`, { method: 'PUT' });
}

export function updateDeckName(id: string, name: string): Promise<Deck> {
  return request<Deck>(`/api/decks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function updateDeckLimits(
  id: string,
  limits: { daily_new_card_limit?: number; daily_review_limit?: number }
): Promise<Deck> {
  return request(`/api/decks/${id}/limits`, {
    method: 'PUT',
    body: JSON.stringify(limits),
  });
}

export function updateCardCountApi(
  deckId: string,
  count: number
): Promise<Deck> {
  return request<Deck>(`/api/decks/${deckId}/card-count`, {
    method: 'PUT',
    body: JSON.stringify({ count }),
  });
}

// ===== 卡片 API =====

export function fetchCards(deckId: string): Promise<Card[]> {
  return request<Card[]>(`/api/decks/${deckId}/cards`);
}

export interface CardPreview {
  front_text: string;
  image_url: string;
}

/** 获取牌组卡片预览（公开，无需登录） */
export function fetchDeckCardPreviews(deckId: string): Promise<{ cards: CardPreview[] }> {
  return request<{ cards: CardPreview[] }>(`/api/decks/${deckId}/cards/preview`);
}

export function createCard(
  deckId: string,
  frontText: string,
  imageBase64?: string,
  backText?: string
): Promise<Card> {
  return request<Card>(`/api/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify({
      front_text: frontText,
      image_url: imageBase64 || '',
      back_text: backText || '',
    }),
  });
}

export function batchImportCards(
  deckId: string,
  files: File[]
): Promise<{ created: number; cards: Card[] }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}/api/decks/${deckId}/cards/batch`, {
    method: 'POST',
    body: formData,
    headers,
  }).then((res) => {
    if (res.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('认证已过期，请重新登录');
    }
    if (!res.ok) {
      return res.json().then((body) => {
        throw new Error((body as { error?: string }).error || res.statusText);
      });
    }
    return res.json();
  });
}

export function batchImportText(
  deckId: string,
  text: string
): Promise<{ created: number; cards: Array<{ front: string; back: string }> }> {
  return request(`/api/decks/${deckId}/cards/batch-text`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function updateCard(
  id: string,
  fields: Partial<Pick<Card, 'front_text' | 'image_url' | 'ease' | 'interval' | 'repetitions' | 'next_review' | 'last_review'>>
): Promise<Card> {
  return request<Card>(`/api/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export function deleteCardApi(id: string): Promise<{ success: boolean }> {
  return request(`/api/cards/${id}`, { method: 'DELETE' });
}

export function fetchDueCards(
  deckId: string,
  limit?: number
): Promise<Card[]> {
  const params = limit ? `?limit=${limit}` : '';
  return request<Card[]>(`/api/decks/${deckId}/due-cards${params}`);
}

export function fetchNewCards(
  deckId: string,
  limit?: number
): Promise<Card[]> {
  const params = limit ? `?limit=${limit}` : '';
  return request<Card[]>(`/api/decks/${deckId}/new-cards${params}`);
}

// ===== 学习会话 API =====

export function createStudySession(
  deckId: string,
  startedAt?: string
): Promise<StudySession> {
  return request<StudySession>('/api/study-sessions', {
    method: 'POST',
    body: JSON.stringify({
      deck_id: deckId,
      started_at: startedAt,
    }),
  });
}

export function endStudySession(
  id: string,
  data: {
    ended_at?: string;
    cards_studied?: number;
    ratings?: { again?: number; hard?: number; good?: number; easy?: number };
  }
): Promise<StudySession> {
  return request<StudySession>(`/api/study-sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ===== 每日统计 API =====

export function fetchDailyStats(date: string, deckId?: string): Promise<DailyStats> {
  const params = deckId ? `?deck_id=${encodeURIComponent(deckId)}` : '';
  return request<DailyStats>(`/api/daily-stats/${date}${params}`);
}

export function upsertDailyStats(
  date: string,
  data: { deck_id?: string; cards_studied?: number; new_cards_learned?: number }
): Promise<DailyStats> {
  return request<DailyStats>(`/api/daily-stats/${date}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** 原子增量更新每日统计（SQL 端累加，避免读后写竞态） */
export function incrementDailyStats(
  date: string,
  data: { deck_id?: string; cards_studied?: number; new_cards_learned?: number }
): Promise<DailyStats> {
  return request<DailyStats>(`/api/daily-stats/${date}/increment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** 获取日期范围内的每日统计（用于计算打卡天数） */
export function fetchDailyStatsRange(
  from: string,
  to: string
): Promise<{ date: string; cards_studied: number; new_cards_learned: number }[]> {
  return request(`/api/daily-stats/range?from=${from}&to=${to}`);
}

/** 获取所有牌组的到期卡片计数 */
export function fetchDueCounts(): Promise<
  { id: string; name: string; due_count: number }[]
> {
  return request('/api/due-counts');
}

// ===== 数据分析 API =====

export interface CardStatus {
  new: number;
  learning: number;
  young: number;
  mature: number;
}

export function fetchCardStatus(deckId: string): Promise<CardStatus> {
  return request(`/api/analytics/${deckId}/card-status`);
}

export interface Difficulty {
  hard: number;
  medium: number;
  easy: number;
  unreviewed: number;
}

export function fetchDifficulty(deckId: string): Promise<Difficulty> {
  return request(`/api/analytics/${deckId}/difficulty`);
}

export interface RatingsSummary {
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
}

export function fetchRatingsSummary(deckId: string): Promise<RatingsSummary> {
  return request(`/api/analytics/${deckId}/ratings`);
}

export interface DailyTrendPoint {
  date: string;
  cards_studied: number;
  new_cards_learned: number;
}

export function fetchDailyTrend(days?: number): Promise<DailyTrendPoint[]> {
  return request(`/api/analytics/daily-trend${days ? `?days=${days}` : ''}`);
}

/** 每日扩展统计（新学/复习/评分分布/学时），用于 AnalyticsPage 三图表 */
export interface DailyExtraPoint {
  date: string;
  new_learned: number;
  reviewed: number;
  hard: number;
  medium: number;
  easy: number;
  minutes: number;
}

export function fetchDailyExtra(
  days?: number,
  opts?: { from?: string; to?: string; deckId?: string }
): Promise<DailyExtraPoint[]> {
  const params = new URLSearchParams();
  if (opts?.from && opts?.to) {
    params.set('from', opts.from);
    params.set('to', opts.to);
  } else if (days) {
    params.set('days', String(days));
  }
  if (opts?.deckId) params.set('deckId', opts.deckId);
  const qs = params.toString();
  return request(`/api/analytics/daily-extra${qs ? `?${qs}` : ''}`);
}

/** 累计学习总时长与总会话数 */
export interface StudyTotal {
  total_sessions: number;
  total_minutes: number;
}
export function fetchStudyTotal(): Promise<StudyTotal> {
  return request('/api/study-sessions/total');
}

// ===== APKG 导入/导出 API =====

/** 导入结果类型 */
export interface ImportResult {
  success: boolean;
  decks: Array<{ id: string; name: string; card_count: number }>;
  errors: Array<{ type: 'parse' | 'media' | 'db'; message: string }>;
}

/** 导出牌组为 APKG（触发浏览器下载） */
export function exportDeck(deckId: string, deckName: string): void {
  const safeName = deckName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  const a = document.createElement('a');
  a.href = `${API_BASE}/api/export/${encodeURIComponent(deckId)}`;
  a.download = `${safeName}.apkg`;
  a.click();
}

/** 导出全部牌组为 APKG */
export function exportAllDecks(): void {
  const a = document.createElement('a');
  a.href = `${API_BASE}/api/export`;
  a.download = 'all_decks.apkg';
  a.click();
}

/** 导入 APKG 文件 */
/** 导入 APKG 文件（支持进度回调） */
export async function importApkgFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const token = useAuthStore.getState().token;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        reject(new Error('认证已过期'));
        return;
      }
      const contentType = xhr.getResponseHeader('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('解析响应失败'));
        }
      } else {
        reject(new Error(`上传失败 (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.onabort = () => reject(new Error('上传已取消'));

    xhr.open('POST', `${API_BASE}/api/import`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

/** 修改密码 */
export function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
  return request('/api/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// ===== 市场 API =====

/** 浏览市场牌组（可按书体/书家/关键词筛选） */
export function fetchMarketplaceDecks(params?: {
  style?: string;
  calligrapher?: string;
  search?: string;
}): Promise<MarketplaceDeck[]> {
  const qs = new URLSearchParams();
  if (params?.style) qs.set('style', params.style);
  if (params?.calligrapher) qs.set('calligrapher', params.calligrapher);
  if (params?.search) qs.set('search', params.search);
  const q = qs.toString();
  return request<MarketplaceDeck[]>(`/api/marketplace/decks${q ? `?${q}` : ''}`);
}

/** 获取单个市场牌组详情 */
export function fetchMarketplaceDeck(deckId: string): Promise<MarketplaceDeck> {
  return request<MarketplaceDeck>(`/api/marketplace/decks/${deckId}`);
}

/** 订阅牌组 */
export function subscribeDeck(deckId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/marketplace/decks/${deckId}/subscribe`, {
    method: 'POST',
  });
}

/** 退订牌组 */
export function unsubscribeDeck(deckId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/marketplace/decks/${deckId}/subscribe`, {
    method: 'DELETE',
  });
}

/** 获取当前用户已订阅的市场牌组 */
export function fetchSubscriptions(): Promise<MarketplaceDeck[]> {
  return request<MarketplaceDeck[]>('/api/marketplace/subscriptions');
}

/** Admin：发布牌组到市场 */
export function publishDeck(deckId: string, data: PublishDeckData): Promise<MarketplaceDeck> {
  return request<MarketplaceDeck>(`/api/marketplace/decks/${deckId}/publish`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Admin：更新市场牌组元数据 */
export function updateMarketplaceDeck(
  deckId: string,
  data: Partial<PublishDeckData>
): Promise<MarketplaceDeck> {
  return request<MarketplaceDeck>(`/api/marketplace/decks/${deckId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Admin：下架市场牌组 */
export function unpublishDeck(deckId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/marketplace/decks/${deckId}/publish`, {
    method: 'DELETE',
  });
}

// ===== 集字 API =====

import type { JiziMatchResponse } from '@/types/jizi';

/** 集字匹配：输入文字，返回每个字对应的卡片图片列表 */
export function fetchJiziMatch(text: string, scope: 'mine' | 'all' = 'mine'): Promise<JiziMatchResponse> {
  const qs = new URLSearchParams({ text, scope });
  return request<JiziMatchResponse>(`/api/jizi/match?${qs}`);
}

// ===== 字帖元数据管理 API (Admin) =====

/** 上传市场牌组封面图 */
export function uploadMarketCover(deckId: string, file: File): Promise<{ success: true; cover_image: string }> {
  const formData = new FormData();
  formData.append('cover', file);
  const token = useAuthStore.getState().token;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/marketplace/decks/${deckId}/cover`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // 不设置 Content-Type，让浏览器自动设置 multipart boundary

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('解析失败')); }
      } else {
        const msg = `上传失败 (HTTP ${xhr.status})`;
        console.error('[uploadMarketCover]', msg, xhr.responseText?.substring(0,200));
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body.error || msg));
        } catch {
          reject(new Error(msg));
        }
      }
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(formData);
  });
}

/** 更新市场牌组元数据 */
export function updateMarketDeck(deckId: string, data: {
  calligrapher?: string;
  dynasty?: string;
  style?: string;
  description?: string;
  featured?: number;
  cover_image?: string;
}): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/marketplace/decks/${deckId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
