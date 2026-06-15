import { useEffect, useState, useMemo } from 'react';
import { useDeckStore } from '@/stores/useDeckStore';
import { DEFAULT_DAILY_NEW_CARD_LIMIT } from '@/lib/constants';
import { fetchDueCounts, fetchDailyStats, fetchDailyStatsRange, fetchStudyTotal, todayLocal } from '@/lib/api';

export interface DailyStatRow {
  date: string;
  cards_studied: number;
  new_cards_learned: number;
}

export interface DashboardStats {
  newCount: number;          // 今日可学新卡（按牌组每日上限 - 今日已学 计算）
  dueCount: number;          // 今日待复习
  newCardRemaining: number;  // 今日剩余新卡（每日上限 - 今日已学新卡）
  streakDays: number;        // 连续打卡
  totalStudied: number;      // 累计已学卡片
  activeDays: number;        // 累计学习天数
  totalMinutes: number;      // 累计学习分钟
  activityData: DailyStatRow[]; // 完整 13 周
  loading: boolean;
}

/**
 * 计算连续打卡天数（从昨天开始往前推）。
 */
function calculateStreak(stats: DailyStatRow[]): number {
  const activeDays = new Set(stats.filter((s) => s.cards_studied > 0).map((s) => s.date));
  let streak = 0;
  const checkDate = new Date();
  checkDate.setDate(checkDate.getDate() - 1);

  while (true) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (activeDays.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * 共享仪表盘统计 hook。
 * 用于 Sidebar / Dashboard 等需要展示统计数据的组件，避免各自重复加载。
 */
export const useDashboardStats = (): DashboardStats => {
  const decks = useDeckStore((s) => s.decks);
  const [dueCount, setDueCount] = useState(0);
  const [newCardRemaining, setNewCardRemaining] = useState(DEFAULT_DAILY_NEW_CARD_LIMIT);
  const [streakDays, setStreakDays] = useState(0);
  const [totalStudied, setTotalStudied] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [activityData, setActivityData] = useState<DailyStatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setLoading(true);
      try {
        const today = todayLocal();
        const d30 = new Date();
        d30.setDate(d30.getDate() - 30);
        const thirtyDaysAgo = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
        const allFrom = '2020-01-01';

        const [dueCounts, todayStats, statsRange, allStats, studyTotal] = await Promise.all([
          fetchDueCounts(),
          fetchDailyStats(today),
          fetchDailyStatsRange(thirtyDaysAgo, today),
          fetchDailyStatsRange(allFrom, today),
          fetchStudyTotal(),
        ]);

        if (cancelled) return;

        setDueCount(dueCounts.reduce((sum, d) => sum + d.due_count, 0));
        setNewCardRemaining(Math.max(0, DEFAULT_DAILY_NEW_CARD_LIMIT - (todayStats?.new_cards_learned ?? 0)));
        setStreakDays(calculateStreak(allStats));
        setTotalStudied(allStats.reduce((s, d) => s + d.cards_studied, 0));
        setActiveDays(allStats.filter((d) => d.cards_studied > 0).length);
        setTotalMinutes(Math.round(studyTotal.total_minutes));
        setActivityData(statsRange);
      } catch (err) {
        console.error('[useDashboardStats] 加载统计失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [decks]);

  // 今日可学新卡：每个牌组 new_available_today 总和
  // （后端已按 daily_new_card_limit - 今日已学 算好，min 到 new_count）
  const newCount = useMemo(
    () => decks.reduce((sum, d) => sum + ((d as any).new_available_today ?? d.new_count ?? 0), 0),
    [decks]
  );

  return useMemo(
    () => ({ newCount, dueCount, newCardRemaining, streakDays, totalStudied, activeDays, totalMinutes, activityData, loading }),
    [newCount, dueCount, newCardRemaining, streakDays, totalStudied, activeDays, totalMinutes, activityData, loading]
  );
};
