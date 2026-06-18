import React from 'react';
import { Box, Typography } from '@mui/material';
import { getImageUrl } from '@/lib/api';
import type { CharHit } from '@/types/jizi';

export interface JiziCellProps {
  char: string;
  hits: CharHit[];
  selectedIndex: number;
  fontSize: number;
  onOpenPicker: () => void;  // 点击直接打开选择弹窗
}

/** 单字单元 —— 显示图片 + 来源标注（书家/字帖），点击弹窗选择写法 */
const JiziCell: React.FC<JiziCellProps> = ({
  char,
  hits,
  selectedIndex,
  fontSize,
  onOpenPicker,
}) => {
  const current = hits.length > 0 ? hits[selectedIndex % hits.length] : null;

  return (
    <Box
      sx={{
        width: fontSize,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* 字图区域 */}
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
        }}
        onClick={() => { if (hits.length > 0) onOpenPicker(); }}
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

      {/* 来源标注：书家 + 字帖 */}
      {current && (
        <Box
          sx={{
            width: '100%',
            mt: 0.3,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          <Typography
            sx={{
              fontSize: Math.max(9, fontSize * 0.085),
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {current.calligrapher || '佚名'}
          </Typography>
          <Typography
            sx={{
              fontSize: Math.max(8, fontSize * 0.075),
              color: 'text.disabled',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {current.deck_name}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default JiziCell;
