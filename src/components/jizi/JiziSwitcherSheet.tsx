import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getImageUrl } from '@/lib/api';
import type { JiziMatchResult } from '@/types/jizi';

export interface JiziSwitcherSheetProps {
  open: boolean;
  result: JiziMatchResult | null;
  selectedIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}

/** 底部 Sheet 变体选择器 —— 横向滚动缩略图，点击即切换 */
const JiziSwitcherSheet: React.FC<JiziSwitcherSheetProps> = ({
  open,
  result,
  selectedIndex,
  onPick,
  onClose,
}) => {
  const hits = result?.hits ?? [];
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: isMobile ? '50vh' : '40vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          px: 2,
          pb: 3,
        },
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 2,
          pb: 1,
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 1,
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {result ? `「${result.char}」的 ${hits.length} 种写法` : '加载中...'}
        </Typography>
        <IconButton onClick={onClose} size="small" edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 横向滚动缩略图列表 */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          py: 1,
          // 隐藏滚动条但保持可滚动
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'divider',
            borderRadius: 2,
          },
        }}
      >
        {hits.map((hit, i) => (
          <Box
            key={hit.card_id}
            onClick={() => onPick(i)}
            sx={{
              cursor: 'pointer',
              flex: '0 0 auto',
              width: 130,
              border: i === selectedIndex ? 2 : 1,
              borderColor: i === selectedIndex ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 1,
              bgcolor: i === selectedIndex ? 'action.selected' : 'background.paper',
              transition: 'all 0.15s',
              '&:hover': { borderColor: 'primary.light' },
            }}
          >
            {/* 字图 */}
            <Box
              component="img"
              src={getImageUrl(hit.image_url)}
              alt={hit.front_text_raw}
              sx={{
                width: '100%',
                height: 100,
                objectFit: 'contain',
                bgcolor: '#fafafa',
                borderRadius: 1,
              }}
              draggable={false}
            />

            {/* 元数据 */}
            <Box sx={{ mt: 0.75 }}>
              <Typography variant="caption" display="block" noWrap sx={{ fontSize: 11, fontWeight: 500 }}>
                {hit.calligrapher || '佚名'}
              </Typography>
              <Typography variant="caption" display="block" noWrap sx={{ fontSize: 10 }} color="text.secondary">
                {hit.deck_name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                {hit.style && (
                  <Chip label={hit.style} size="small" sx={{ fontSize: 9, height: 16 }} />
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* 底部空行：点击空白处关闭 */}
      <Box
        onClick={onClose}
        sx={{ height: 16, cursor: 'default' }}
      />
    </Drawer>
  );
};

export default JiziSwitcherSheet;
