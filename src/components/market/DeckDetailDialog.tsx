import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  fetchMarketplaceDeck,
  fetchDeckCardPreviews,
  subscribeDeck,
  unsubscribeDeck,
  getImageUrl,
} from '@/lib/api';
import type { MarketplaceDeck } from '@/types';
import type { CardPreview } from '@/lib/api';

export interface DeckDetailDialogProps {
  open: boolean;
  deck: MarketplaceDeck | null;
  onClose: () => void;
  onSubscribed: () => void;
}

/** 封面占位 */
const CoverPlaceholder: React.FC<{ name: string; large?: boolean }> = ({ name, large }) => (
  <Box
    sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
      color: 'grey.400',
      fontSize: large ? 72 : 28,
      fontWeight: 600,
    }}
  >
    {name?.charAt(0) || '?'}
  </Box>
);

const DeckDetailDialog: React.FC<DeckDetailDialogProps> = ({ open, deck, onClose, onSubscribed }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [detail, setDetail] = useState<MarketplaceDeck | null>(null);
  const [cardPreviews, setCardPreviews] = useState<CardPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  /** 加载数据 */
  useEffect(() => {
    if (open && deck) {
      setLoading(true);
      setCardsLoading(true);
      setError(null);
      fetchMarketplaceDeck(deck.deck_id)
        .then(setDetail)
        .catch((err) => setError(err instanceof Error ? err.message : '加载详情失败'))
        .finally(() => setLoading(false));
      fetchDeckCardPreviews(deck.deck_id)
        .then((data) => setCardPreviews(data.cards))
        .catch(() => { /* 卡片预览加载失败不阻塞 */ })
        .finally(() => setCardsLoading(false));
    }
  }, [open, deck]);

  const current = detail || deck;
  const isSubscribed = current?.is_subscribed ?? false;

  /** 订阅/退订 */
  const handleToggle = useCallback(async () => {
    if (!current) return;
    setActionPending(true);
    setError(null);
    try {
      if (isSubscribed) {
        await unsubscribeDeck(current.deck_id);
        setDetail((d) => d ? { ...d, is_subscribed: false } : d);
      } else {
        await subscribeDeck(current.deck_id);
        setDetail((d) => d ? { ...d, is_subscribed: true } : d);
      }
      onSubscribed();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionPending(false);
    }
  }, [current, isSubscribed, onSubscribed]);

  if (!deck) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
    >
      {/* 标题栏 */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0 }}>
        <Typography component="span" sx={{ flex: 1, fontWeight: 600, fontSize: { xs: 16, sm: 18 } }} noWrap>
          {current?.name ?? ''}
        </Typography>
        <IconButton size="small" onClick={onClose} edge="end" aria-label="关闭">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

            {/* 主体：封面 + 元数据 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 2.5,
                mb: 2.5,
              }}
            >
              {/* 封面图 */}
              <Box
                sx={{
                  width: isMobile ? '100%' : 240,
                  flexShrink: 0,
                  aspectRatio: '3/4',
                  maxWidth: isMobile ? 200 : undefined,
                  mx: isMobile ? 'auto' : undefined,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'grey.50',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                {current?.cover_image ? (
                  <Box
                    component="img"
                    src={getImageUrl(current.cover_image)}
                    alt={current.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <CoverPlaceholder name={current?.name ?? ''} large />
                )}
              </Box>

              {/* 元数据 */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography component="span" sx={{ fontWeight: 600, fontSize: { xs: 16, sm: 18 } }}>
                  {current?.name ?? ''}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  {current?.calligrapher && (
                    <Typography variant="body2" color="text.secondary">
                      {current.calligrapher}
                    </Typography>
                  )}
                  {current?.dynasty && (
                    <Typography variant="body2" color="text.secondary">
                      {current.dynasty}
                    </Typography>
                  )}
                  {current?.style && (
                    <Chip label={current.style} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
                  )}
                  {current?.card_count != null && (
                    <Typography variant="body2" color="text.secondary">
                      {current.card_count} 张字帖
                    </Typography>
                  )}
                </Box>

                {current?.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 0.5,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 120,
                      overflow: 'auto',
                    }}
                  >
                    {current.description}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* 卡片预览网格 */}
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: 13 }}>
              字帖预览{cardPreviews.length > 0 ? `（${cardPreviews.length} 张）` : ''}
            </Typography>
            {cardsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : cardPreviews.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
                暂无预览
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  overflowX: 'auto',
                  pb: 1,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
                }}
              >
                {cardPreviews.map((card, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      flexShrink: 0,
                      width: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'grey.50',
                        border: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {card.image_url ? (
                        <Box
                          component="img"
                          src={getImageUrl(card.image_url)}
                          alt={card.front_text}
                          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          loading="lazy"
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          {card.front_text}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 100, textAlign: 'center', fontSize: 11 }}
                    >
                      {card.front_text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      {/* 底部操作栏 */}
      <DialogActions sx={{ px: 3, pb: 2, pt: 0, gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleToggle}
          disabled={actionPending || loading}
          startIcon={
            actionPending ? (
              <CircularProgress size={18} color="inherit" />
            ) : isSubscribed ? (
              <CheckCircleIcon />
            ) : (
              <AddCircleOutlineIcon />
            )
          }
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: isSubscribed ? 'success.main' : 'primary.main',
            '&:hover': {
              bgcolor: isSubscribed ? 'success.dark' : 'primary.dark',
            },
          }}
        >
          {isSubscribed ? '已订阅（点击退订）' : '订阅此牌组'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeckDetailDialog;
