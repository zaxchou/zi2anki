import React, { useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { getImageUrl } from '@/lib/api';
import type { CharHit } from '@/types/jizi';

export interface JiziCellProps {
  char: string;
  hits: CharHit[];
  selectedIndex: number;
  fontSize: number;
  onSelect: () => void;      // 单击：循环切换
  onLongPress: () => void;   // 长按：弹窗选择
}

/** 单字单元 —— 显示图片或空方框，单击切换，长按弹窗 */
const JiziCell: React.FC<JiziCellProps> = ({
  char,
  hits,
  selectedIndex,
  fontSize,
  onSelect,
  onLongPress,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const current = hits.length > 0 ? hits[selectedIndex % hits.length] : null;

  const handleMouseDown = () => {
    longPressed.current = false;
    timerRef.current = setTimeout(() => {
      longPressed.current = true;
      onLongPress();
    }, 500);
  };

  const handleMouseUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!longPressed.current && hits.length > 0) {
      onSelect();
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // 防止触摸事件后触发模拟鼠标事件
    handleMouseDown();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  return (
    <Box
      sx={{
        width: fontSize,
        height: fontSize,
        position: 'relative',
        cursor: hits.length > 0 ? 'pointer' : 'default',
        bgcolor: current ? 'transparent' : 'rgba(0,0,0,0.02)',
        border: current ? 'none' : '1px dashed',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {current ? (
        <Box
          component="img"
          src={getImageUrl(current.image_url)}
          alt={char}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
          draggable={false}
        />
      ) : (
        <Typography
          sx={{
            fontSize: fontSize * 0.4,
            color: 'text.disabled',
            fontFamily: 'serif',
          }}
        >
          {char}
        </Typography>
      )}

      {/* 角标：n/N */}
      {hits.length > 1 && (
        <Typography
          sx={{
            position: 'absolute',
            bottom: 1,
            right: 2,
            fontSize: 9,
            color: 'rgba(0,0,0,0.4)',
            bgcolor: 'rgba(255,255,255,0.7)',
            px: 0.3,
            borderRadius: 0.5,
            lineHeight: 1.2,
            pointerEvents: 'none',
          }}
        >
          {(selectedIndex % hits.length) + 1}/{hits.length}
        </Typography>
      )}
    </Box>
  );
};

export default JiziCell;
