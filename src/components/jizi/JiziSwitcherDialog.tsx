import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getImageUrl } from '@/lib/api';
import type { JiziMatchResult } from '@/types/jizi';

export interface JiziSwitcherDialogProps {
  open: boolean;
  result: JiziMatchResult | null;
  selectedIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}

/** 多图切换弹窗 —— 长按触发，缩略图网格选择 */
const JiziSwitcherDialog: React.FC<JiziSwitcherDialogProps> = ({
  open,
  result,
  selectedIndex,
  onPick,
  onClose,
}) => {
  if (!result) return null;
  const hits = result.hits;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span" className="font-kai" sx={{ fontWeight: 600 }}>
            「{result.char}」的 {hits.length} 种写法
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 1.5,
            pb: 1,
          }}
        >
          {hits.map((hit, i) => (
            <Box
              key={hit.card_id}
              onClick={() => onPick(i)}
              sx={{
                cursor: 'pointer',
                border: i === selectedIndex ? 2 : 1,
                borderColor: i === selectedIndex ? 'primary.main' : 'divider',
                borderRadius: 1.5,
                p: 0.5,
                bgcolor: i === selectedIndex ? 'primary.50' : 'background.paper',
                transition: 'all 0.15s',
                '&:hover': { borderColor: 'primary.light', boxShadow: 1 },
              }}
            >
              <Box
                component="img"
                src={getImageUrl(hit.image_url)}
                alt={hit.front_text_raw}
                sx={{
                  width: '100%',
                  height: 90,
                  objectFit: 'contain',
                  bgcolor: '#fafafa',
                  borderRadius: 1,
                }}
                draggable={false}
              />
              <Box sx={{ mt: 0.5, px: 0.5 }}>
                <Typography variant="caption" display="block" noWrap sx={{ fontSize: 11 }}>
                  {hit.deck_name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                  {hit.style && (
                    <Chip label={hit.style} size="small" sx={{ fontSize: 10, height: 18 }} />
                  )}
                  {hit.calligrapher && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                      {hit.calligrapher}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default JiziSwitcherDialog;
