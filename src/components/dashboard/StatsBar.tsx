import React from 'react';
import { Box, Typography } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';

export interface StatsBarProps {
  dueCount: number;
  newCardRemaining: number;
  streakDays: number;
}

const statItems = [
  { key: 'due', label: '待复习', icon: <AutoStoriesIcon />, color: '#ed6c02', bg: '#fff3e0' },
  { key: 'new', label: '新卡剩余', icon: <LibraryAddIcon />, color: '#1565c0', bg: '#e3f2fd' },
  { key: 'streak', label: '连续打卡', icon: <LocalFireDepartmentIcon />, color: '#2e7d32', bg: '#e8f5e9' },
] as const;

const StatsBar: React.FC<StatsBarProps> = ({ dueCount, newCardRemaining, streakDays }) => {
  const values = { due: dueCount, new: newCardRemaining, streak: streakDays };

  return (
    <Box className="flex gap-3">
      {statItems.map((item) => (
        <Box
          key={item.key}
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
          sx={{ bgcolor: item.bg }}
        >
          <Box sx={{ color: item.color }}>{item.icon}</Box>
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: item.color, lineHeight: 1.2 }}>
              {values[item.key]}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {item.label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default StatsBar;
