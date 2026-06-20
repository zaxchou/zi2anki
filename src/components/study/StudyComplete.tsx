import React from 'react';
import { Box, Typography, Button, LinearProgress, Paper, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { StudySession } from '@/types';

export interface StudyCompleteProps {
  session: StudySession;
  onBackToDashboard: () => void;
}

const ratingConfig = [
  { key: 'again' as const, label: '重来', color: '#d32f2f', bg: '#fce4e4' },
  { key: 'hard' as const, label: '困难', color: '#ed6c02', bg: '#fff3e0' },
  { key: 'good' as const, label: '良好', color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'easy' as const, label: '简单', color: '#1565c0', bg: '#e3f2fd' },
];

const StudyComplete: React.FC<StudyCompleteProps> = ({ session, onBackToDashboard }) => {
  const theme = useTheme();
  const total = session.cards_studied || 1;

  return (
    <Box className="flex flex-col items-center justify-center py-6 px-4">
      <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 2 }} />

      <Typography variant="h4" className="font-kai mb-1">
        学习完成！
      </Typography>

      <Typography variant="body2" color="text.secondary" className="mb-4">
        你太棒了，继续保持！
      </Typography>

      {/* 总卡片数 */}
      <Typography variant="h3" fontWeight={700} color="primary" className="mb-1">
        {session.cards_studied}
      </Typography>
      <Typography variant="caption" color="text.secondary" className="mb-4">
        本次学习卡片
      </Typography>

      {/* 评分分布 */}
      <Box className="w-full max-w-sm mb-5 space-y-2">
        {ratingConfig.map((item) => {
          const count = session.ratings[item.key];
          const pct = Math.round((count / total) * 100);
          return (
            <Paper
              key={item.key}
              elevation={0}
              className="flex items-center gap-3 px-3 py-2"
              sx={{ bgcolor: item.bg, borderRadius: 2 }}
            >
              <Typography variant="body2" fontWeight={600} sx={{ color: item.color, minWidth: 36 }}>
                {item.label}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  flex: 1,
                  height: 10,
                  borderRadius: 5,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: item.color },
                }}
              />
              <Typography variant="body2" fontWeight={600} sx={{ color: item.color, minWidth: 24, textAlign: 'right' }}>
                {count}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      <Button
        variant="contained"
        size="large"
        onClick={onBackToDashboard}
        sx={{ px: 6, py: 1.5, borderRadius: 2, fontSize: 16 }}
      >
        返回 背字帖
      </Button>
    </Box>
  );
};

export default StudyComplete;
