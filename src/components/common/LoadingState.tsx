import React from 'react';
import { CircularProgress, Typography, Box } from '@mui/material';

export interface LoadingStateProps {
  /** 可选：加载提示文字 */
  message?: string;
}

/**
 * 加载状态组件。
 * 居中显示 CircularProgress，下方可选显示加载提示。
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message }) => {
  return (
    <Box className="flex flex-col items-center justify-center py-12">
      <CircularProgress size={48} />
      {message && (
        <Typography
          variant="body2"
          color="text.secondary"
          className="mt-3"
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export interface EmptyStateProps {
  /** 可选：自定义图标（MUI SvgIcon 组件） */
  icon?: React.ReactNode;
  /** 标题 */
  title: string;
  /** 可选：描述文字 */
  description?: string;
  /** 可选：操作按钮 */
  action?: React.ReactNode;
}

/**
 * 空状态组件。
 * 居中显示图标 + 标题 + 描述 + 可选操作按钮。
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <Box className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <Box className="mb-4 text-ink-light opacity-40" sx={{ '& svg': { fontSize: 64 } }}>
          {icon}
        </Box>
      )}
      <Typography variant="h6" color="text.primary" className="font-kai">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" className="mt-2 max-w-xs">
          {description}
        </Typography>
      )}
      {action && <Box className="mt-4">{action}</Box>}
    </Box>
  );
};

export default LoadingState;
