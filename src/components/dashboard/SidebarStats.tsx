import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import ActivityCalendar, { type ActivityDay } from './ActivityCalendar';

export interface SidebarStatsProps {
  dueCount: number;
  newCardRemaining: number;
  streakDays: number;
  activityData: ActivityDay[];
}

interface MiniStat {
  key: 'due' | 'new' | 'streak';
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  colorDark: string;
}

const miniStats: MiniStat[] = [
  { key: 'due', label: '待复习', value: 0, icon: <AutoStoriesIcon sx={{ fontSize: 14 }} />, color: '#ed6c02', colorDark: '#ffb74d' },
  { key: 'new', label: '新卡', value: 0, icon: <LibraryAddIcon sx={{ fontSize: 14 }} />, color: '#1565c0', colorDark: '#64b5f6' },
  { key: 'streak', label: '打卡', value: 0, icon: <LocalFireDepartmentIcon sx={{ fontSize: 14 }} />, color: '#2e7d32', colorDark: '#81c784' },
];

/**
 * 侧边栏紧凑版：3 个统计数字 + 13 周热力图。
 * 顺序：日历 → 摘要 → 3 卡统计（更紧凑）。
 */
const SidebarStats: React.FC<SidebarStatsProps> = ({ dueCount, newCardRemaining, streakDays, activityData }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const values = { due: dueCount, new: newCardRemaining, streak: streakDays };

  const summary = useMemo(() => {
    const active = activityData.filter((d) => d.cards_studied > 0).length;
    const total = activityData.reduce((s, d) => s + d.cards_studied, 0);
    return { activeDays: active, totalCards: total };
  }, [activityData]);

  const enrichedStats: MiniStat[] = miniStats.map((s) => ({ ...s, value: values[s.key] }));

  return (
    <Box sx={{ pt: 0.5 }}>
      {/* 热力图在最上面 */}
      <ActivityCalendar data={activityData} weeks={13} compact />

      {/* 紧凑活动摘要（标题与数据合一行） */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1, fontSize: 11, lineHeight: 1.4 }}
      >
        近 3 个月 · <b>{summary.activeDays}</b> 天活跃 · 共 <b>{summary.totalCards}</b> 张
      </Typography>

      {/* 3 张紧凑统计卡（水平横排，更省垂直空间） */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.75, mt: 1.25 }}>
        {enrichedStats.map((s) => (
          <Box
            key={s.key}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 0.75,
              px: 0.5,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              minWidth: 0,
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ color: dark ? s.colorDark : s.color, lineHeight: 1.1, fontSize: 18 }}
            >
              {s.value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: dark ? s.colorDark : s.color }}>
              {s.icon}
              <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1 }}>
                {s.label}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default React.memo(SidebarStats);
