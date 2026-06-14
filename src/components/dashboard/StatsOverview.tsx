import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import ActivityCalendar, { type ActivityDay } from './ActivityCalendar';

export interface StatsOverviewProps {
  dueCount: number;
  newCardRemaining: number;
  streakDays: number;
  activityData: ActivityDay[];
}

interface StatItemConfig {
  key: 'due' | 'new' | 'streak';
  label: string;
  icon: React.ReactNode;
  color: string;
  colorDark: string;
  bg: string;
  bgDark: string;
}

const statItems: StatItemConfig[] = [
  {
    key: 'due', label: '待复习', icon: <AutoStoriesIcon fontSize="small" />,
    color: '#ed6c02', colorDark: '#ffb74d',
    bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
    bgDark: 'linear-gradient(135deg, rgba(237,108,2,0.15) 0%, rgba(237,108,2,0.08) 100%)',
  },
  {
    key: 'new', label: '新卡剩余', icon: <LibraryAddIcon fontSize="small" />,
    color: '#1565c0', colorDark: '#64b5f6',
    bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    bgDark: 'linear-gradient(135deg, rgba(21,101,192,0.15) 0%, rgba(21,101,192,0.08) 100%)',
  },
  {
    key: 'streak', label: '连续打卡', icon: <LocalFireDepartmentIcon fontSize="small" />,
    color: '#2e7d32', colorDark: '#81c784',
    bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
    bgDark: 'linear-gradient(135deg, rgba(46,125,50,0.15) 0%, rgba(46,125,50,0.08) 100%)',
  },
];

const StatsOverview: React.FC<StatsOverviewProps> = ({ dueCount, newCardRemaining, streakDays, activityData }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const values = { due: dueCount, new: newCardRemaining, streak: streakDays };

  /** 计算日历显示的实际活动天数与总数 */
  const summary = useMemo(() => {
    const active = activityData.filter((d) => d.cards_studied > 0).length;
    const total = activityData.reduce((s, d) => s + d.cards_studied, 0);
    return { activeDays: active, totalCards: total };
  }, [activityData]);

  return (
    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
      {/* 顶部 3 张统计卡 */}
      <Box className="flex gap-3 mb-3">
        {statItems.map((item) => (
          <Box
            key={item.key}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg"
            sx={{ background: dark ? item.bgDark : item.bg }}
          >
            <Box sx={{ color: dark ? item.colorDark : item.color, display: 'flex' }}>{item.icon}</Box>
            <Box className="flex-1 min-w-0">
              <Typography variant="h5" fontWeight={700} sx={{ color: dark ? item.colorDark : item.color, lineHeight: 1.1 }}>
                {values[item.key]}
              </Typography>
              <Typography variant="caption" sx={{ color: dark ? item.colorDark : item.color, opacity: 0.75 }}>
                {item.label}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* 活动日历标题 */}
      <Box className="flex items-center justify-between mb-1.5">
        <Typography variant="subtitle2" fontWeight={600}>
          学习活动
        </Typography>
        <Typography variant="caption" color="text.secondary">
          近 3 个月 · {summary.activeDays} 天活跃 · 共 {summary.totalCards} 张
        </Typography>
      </Box>

      {/* 热力图 */}
      <ActivityCalendar data={activityData} weeks={13} />
    </Box>
  );
};

export default StatsOverview;
