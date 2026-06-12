// ===== Express API 客户端 =====

import type { Card, Deck, StudySession, DailyStats } from '@/types';

const API_BASE = 'http://localhost:3001';

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
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error || res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ===== 牌组 API =====

export function fetchDecks(): Promise<Deck[]> {
  return request<Deck[]>('/api/decks');
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

export function createCard(
  deckId: string,
  frontText: string,
  imageBase64?: string
): Promise<Card> {
  return request<Card>(`/api/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify({
      front_text: frontText,
      image_url: imageBase64 || '',
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
  return fetch(`${API_BASE}/api/decks/${deckId}/cards/batch`, {
    method: 'POST',
    body: formData,
  }).then((res) => {
    if (!res.ok) {
      return res.json().then((body) => {
        throw new Error((body as { error?: string }).error || res.statusText);
      });
    }
    return res.json();
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

export function fetchDailyStats(date: string): Promise<DailyStats> {
  return request<DailyStats>(`/api/daily-stats/${date}`);
}

export function upsertDailyStats(
  date: string,
  data: { cards_studied?: number; new_cards_learned?: number }
): Promise<DailyStats> {
  return request<DailyStats>(`/api/daily-stats/${date}`, {
    method: 'PUT',
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
