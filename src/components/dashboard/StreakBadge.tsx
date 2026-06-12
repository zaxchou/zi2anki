import React from 'react';
import { Chip } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

export interface StreakBadgeProps {
  /** 连续打卡天数 */
  days: number;
}

/**
 * 连续打卡徽章。
 * - days > 0：火焰图标 + "{days} 天连续打卡"
 * - days = 0：灰色 "尚未开始"
 */
const StreakBadge: React.FC<StreakBadgeProps> = ({ days }) => {
  if (days > 0) {
    return (
      <Chip
        icon={<LocalFireDepartmentIcon />}
        label={`${days} 天连续打卡`}
        color="warning"
        variant="filled"
        size="medium"
      />
    );
  }

  // days = 0：不显示徽章，避免干扰
  return null;
};

export default StreakBadge;
