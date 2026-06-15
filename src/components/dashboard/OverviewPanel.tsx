import React, { useState, useMemo } from 'react';
import { Box, Typography, Card, CardContent, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';
import ActivityCalendar, { ActivityDay } from './ActivityCalendar';
import { useDashboardStats } from '@/hooks/useDashboardStats';

type Range = 'all' | '30d' | '7d';

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  dark: boolean;
}
const StatCard: React.FC<StatCardProps> = ({ label, value, unit, dark }) => (
  <Box sx={{
    border: '1px solid', borderColor: 'divider', borderRadius: 2,
    p: 1.5, bgcolor: dark ? '#1a1a1a' : '#f5f5f5',
  }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 0.5, gap: 0.5 }}>
      <Typography variant="h6" fontWeight={600} sx={{ fontSize: 20 }}>
        {value}
      </Typography>
      {unit && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
          {unit}
        </Typography>
      )}
    </Box>
  </Box>
);

/**
 * 概览面板：复刻参考图的"标题 + 时间筛选 + 6 个数据卡 + 热力图 + 总结"布局。
 * 用于 DashboardPage 顶部（移动端 + 暂无 PC 端）。
 */
const OverviewPanel: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const {
    newCount, dueCount, streakDays, totalStudied, activeDays, totalMinutes, activityData, loading,
  } = useDashboardStats();
  const [range, setRange] = useState<Range>('all');

  // 根据 range 过滤 activityData：更早的 days 置 0
  const filteredActivity = useMemo<ActivityDay[]>(() => {
    if (range === 'all') return activityData;
    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return activityData.map((d) => (d.date < cutoffStr ? { ...d, cards_studied: 0, new_cards_learned: 0 } : d));
  }, [activityData, range]);

  const hours = useMemo(() => (totalMinutes / 60).toFixed(1), [totalMinutes]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {/* 顶部：标题 + 时间筛选 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>概览</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={range}
            onChange={(_, v) => v && setRange(v)}
            sx={{ '& .MuiToggleButton-root': { px: 1.5, fontSize: 12 } }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="30d">30d</ToggleButton>
            <ToggleButton value="7d">7d</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* 6 个数据卡 — 2 行 × 3 列 */}
        <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1.5} mb={2}>
          <StatCard label="待学习" value={loading ? '-' : newCount} unit="张" dark={dark} />
          <StatCard label="待复习" value={loading ? '-' : dueCount} unit="张" dark={dark} />
          <StatCard label="连续" value={loading ? '-' : streakDays} unit="天" dark={dark} />
          <StatCard label="已学" value={loading ? '-' : totalStudied} unit="张" dark={dark} />
          <StatCard label="学习" value={loading ? '-' : activeDays} unit="天" dark={dark} />
          <StatCard label="学时" value={loading ? '-' : hours} unit="h" dark={dark} />
        </Box>

        {/* 热力图 */}
        <Box mb={1.5}>
          <ActivityCalendar data={filteredActivity} weeks={13} />
        </Box>

        {/* 总结文案 */}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          你已坚持 {streakDays} 天，共学 {totalStudied} 张卡片，累计 {hours} 小时
        </Typography>
      </CardContent>
    </Card>
  );
};

export default OverviewPanel;
