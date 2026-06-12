import React, { useEffect, useCallback } from 'react';
import { Button, Grid } from '@mui/material';
import type { Rating } from '@/types';

export interface RatingButtonsProps {
  /** 评分回调 */
  onRate: (rating: Rating) => void;
  /** 是否禁用按钮 */
  disabled?: boolean;
}

/** 按钮配置：标签、颜色、评分值、快捷键 */
interface ButtonConfig {
  label: string;
  color: 'error' | 'warning' | 'success' | 'primary';
  rating: Rating;
  shortcut: string;
}

const buttonConfigs: ButtonConfig[] = [
  { label: '重来', color: 'error', rating: 1, shortcut: '1' },
  { label: '困难', color: 'warning', rating: 2, shortcut: '2' },
  { label: '良好', color: 'success', rating: 3, shortcut: '3' },
  { label: '简单', color: 'primary', rating: 4, shortcut: '4' },
];

/**
 * 评分按钮组。
 *
 * 4 个并排按钮，分别对应 Again(1) / Hard(2) / Good(3) / Easy(4)。
 * 支持键盘快捷键 1-4。
 */
const RatingButtons: React.FC<RatingButtonsProps> = ({ onRate, disabled = false }) => {
  // 键盘快捷键监听
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      // 忽略在输入框内的按键
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const config = buttonConfigs.find((c) => c.shortcut === e.key);
      if (config) {
        e.preventDefault();
        onRate(config.rating);
      }
    },
    [disabled, onRate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <Grid container spacing={1}>
      {buttonConfigs.map((config) => (
        <Grid item xs={3} key={config.rating}>
          <Button
            variant="contained"
            color={config.color}
            fullWidth
            disabled={disabled}
            onClick={() => onRate(config.rating)}
            sx={{ py: 1.5 }}
          >
            <span className="flex flex-col items-center">
              <span>{config.label}</span>
              <span className="text-xs opacity-70">({config.shortcut})</span>
            </span>
          </Button>
        </Grid>
      ))}
    </Grid>
  );
};

export default RatingButtons;
