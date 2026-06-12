import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { StudySession } from '@/types';

export interface StudyCompleteProps {
  /** 本次学习会话数据 */
  session: StudySession;
  /** 返回仪表盘回调 */
  onBackToDashboard: () => void;
}

/**
 * 学习完成页。
 * 居中显示完成图标、标题、统计信息及返回按钮。
 */
const StudyComplete: React.FC<StudyCompleteProps> = ({
  session,
  onBackToDashboard,
}) => {
  return (
    <Box className="flex flex-col items-center justify-center py-12 px-4">
      {/* 完成图标 */}
      <CheckCircleIcon
        color="success"
        sx={{ fontSize: 72, mb: 2 }}
      />

      {/* 标题 */}
      <Typography variant="h4" className="font-kai mb-6">
        学习完成！
      </Typography>

      {/* 统计信息 */}
      <Box className="w-full max-w-sm mb-8">
        <Typography variant="body1" color="text.secondary" className="text-center mb-4">
          本次学习卡片数：<strong>{session.cards_studied}</strong>
        </Typography>

        {/* 各评分数量 */}
        <Box className="grid grid-cols-2 gap-x-4 gap-y-2">
          <StatRow label="Again" value={session.ratings.again} color="#d32f2f" />
          <StatRow label="Hard" value={session.ratings.hard} color="#ed6c02" />
          <StatRow label="Good" value={session.ratings.good} color="#2e7d32" />
          <StatRow label="Easy" value={session.ratings.easy} color="#1565c0" />
        </Box>
      </Box>

      {/* 返回按钮 */}
      <Button
        variant="contained"
        size="large"
        onClick={onBackToDashboard}
        sx={{ px: 4, py: 1.5 }}
      >
        返回仪表盘
      </Button>
    </Box>
  );
};

/** 单行评分统计 */
interface StatRowProps {
  label: string;
  value: number;
  color: string;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, color }) => (
  <Box className="flex justify-between items-center py-1 px-3 bg-gray-50 rounded">
    <Typography variant="body2" sx={{ color }}>
      ● {label}
    </Typography>
    <Typography variant="body2" fontWeight={600}>
      {value}
    </Typography>
  </Box>
);

export default StudyComplete;
