import React, { useEffect } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import JiziPreview from './JiziPreview';
import type { JiziMatchResult, JiziLayout } from '@/types/jizi';

export interface JiziFullscreenPreviewProps {
  open: boolean;
  onClose: () => void;
  results: JiziMatchResult[];
  selections: number[];
  layout: JiziLayout;
  onOpenPicker: (index: number) => void;
  onExport: () => void;
  exporting: boolean;
  text?: string;
}

/** 全屏预览模式 —— 沉浸式查看集字作品 */
const JiziFullscreenPreview: React.FC<JiziFullscreenPreviewProps> = ({
  open,
  onClose,
  results,
  selections,
  layout,
  onOpenPicker,
  onExport,
  exporting,
  text,
}) => {
  // ESC 退出
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          backgroundImage: 'none',
        },
      }}
    >
      {/* 顶部工具栏 */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar variant="dense">
          <IconButton
            edge="start"
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <FullscreenExitIcon />
          </IconButton>
          <Typography
            sx={{ flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}
          >
            集字预览 · {results.length} 字
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* 中间预览区 —— 居中、可滚动 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          p: 3,
        }}
      >
        <JiziPreview
          results={results}
          selections={selections}
          layout={layout}
          onOpenPicker={onOpenPicker}
          text={text}
        />
      </Box>

      {/* 底部工具栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          py: 1.5,
          px: 2,
          bgcolor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={onExport}
          disabled={exporting || results.length === 0}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          {exporting ? '导出中...' : '导出 PNG'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default JiziFullscreenPreview;
