import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import AddIcon from '@mui/icons-material/Add';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

export interface StatsBarProps {
  /** 待复习卡片数 */
  dueCount: number;
  /** 今日剩余新卡数 */
  newCardRemaining: number;
  /** 连续打卡天数 */
  streakDays: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  accentColor: string;
}

/** 单个统计卡片 */
const StatCard: React.FC<StatCardProps> = ({ icon, value, label, accentColor }) => (
  <Grid item xs={12} sm={4}>
    <Paper
      elevation={0}
      variant="outlined"
      className="flex items-center gap-4 p-4 rounded-xl"
    >
      <Box
        className="flex items-center justify-center w-12 h-12 rounded-full"
        sx={{ backgroundColor: `${accentColor}15` }}
      >
        <Box sx={{ color: accentColor }}>{icon}</Box>
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ color: accentColor }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  </Grid>
);

/**
 * 仪表盘统计栏。
 * 显示 3 个统计卡片：待复习（橙色）、新卡剩余（蓝色）、连续打卡（绿色）。
 * 响应式布局：xs 时堆叠，sm+ 时横向排列。
 */
const StatsBar: React.FC<StatsBarProps> = ({
  dueCount,
  newCardRemaining,
  streakDays,
}) => {
  return (
    <Grid container spacing={2}>
      <StatCard
        icon={<BadgeIcon />}
        value={dueCount}
        label="待复习"
        accentColor="#ed6c02"
      />
      <StatCard
        icon={<AddIcon />}
        value={newCardRemaining}
        label="新卡剩余"
        accentColor="#1565c0"
      />
      <StatCard
        icon={<LocalFireDepartmentIcon />}
        value={streakDays}
        label="连续打卡"
        accentColor="#2e7d32"
      />
    </Grid>
  );
};

export default StatsBar;
