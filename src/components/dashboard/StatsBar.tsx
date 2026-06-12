import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';

export interface StatsBarProps {
  dueCount: number;
  newCardRemaining: number;
  streakDays: number;
}

interface StatItemConfig {
  key: 'due' | 'new' | 'streak';
  label: string;
  icon: React.ReactNode;
  color: string;
  colorDark: string;
  gradient: string;
  gradientDark: string;
}

const statItems: StatItemConfig[] = [
  {
    key: 'due',
    label: '待复习',
    icon: <AutoStoriesIcon />,
    color: '#ed6c02',
    colorDark: '#ffb74d',
    gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(237,108,2,0.15) 0%, rgba(237,108,2,0.08) 100%)',
  },
  {
    key: 'new',
    label: '新卡剩余',
    icon: <LibraryAddIcon />,
    color: '#1565c0',
    colorDark: '#64b5f6',
    gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(21,101,192,0.15) 0%, rgba(21,101,192,0.08) 100%)',
  },
  {
    key: 'streak',
    label: '连续打卡',
    icon: <LocalFireDepartmentIcon />,
    color: '#2e7d32',
    colorDark: '#81c784',
    gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
    gradientDark: 'linear-gradient(135deg, rgba(46,125,50,0.15) 0%, rgba(46,125,50,0.08) 100%)',
  },
];

const StatsBar: React.FC<StatsBarProps> = ({ dueCount, newCardRemaining, streakDays }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const values = { due: dueCount, new: newCardRemaining, streak: streakDays };

  return (
    <Box className="flex gap-3">
      {statItems.map((item) => (
        <Box
          key={item.key}
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
          sx={{ background: isDark ? item.gradientDark : item.gradient }}
        >
          <Box sx={{ color: isDark ? item.colorDark : item.color }}>{item.icon}</Box>
          <Box>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: isDark ? item.colorDark : item.color, lineHeight: 1.2 }}
            >
              {values[item.key]}
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? item.colorDark : item.color, opacity: 0.7 }}>
              {item.label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default StatsBar;
