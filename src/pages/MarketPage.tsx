import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import StoreIcon from '@mui/icons-material/Store';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  fetchMarketplaceDecks,
  subscribeDeck,
  unsubscribeDeck,
  getImageUrl,
} from '@/lib/api';
import type { MarketplaceDeck } from '@/types';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EditDeckDialog from '@/components/market/EditDeckDialog';
import { LoadingState, EmptyState } from '@/components/common/LoadingState';
import { useAuthStore } from '@/stores/useAuthStore';

/** 书体筛选选项 */
const STYLE_OPTIONS = ['全部', '楷', '行', '草', '隶', '篆'] as const;

/** 封面占位组件 */
const CoverPlaceholder: React.FC<{ name: string }> = ({ name }) => (
  <Box
    sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'grey.100',
      color: 'grey.400',
      fontSize: 28,
      fontWeight: 600,
    }}
  >
    {name?.charAt(0) || '?'}
  </Box>
);

/**
 * 市场页面。
 * 路由 /market
 * 密集网格布局：封面图 + 标题 + 悬浮订阅按钮。
 * admin 用户每张字帖可编辑元数据 + 上传封面。
 */
const MarketPage: React.FC = () => {
  const [decks, setDecks] = useState<MarketplaceDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // 筛选条件
  const [searchKeyword, setSearchKeyword] = useState('');
  const [styleFilter, setStyleFilter] = useState<string>('全部');
  const [calligrapherFilter, setCalligrapherFilter] = useState<string>('全部');

  // 操作中状态
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unsubConfirmDeck, setUnsubConfirmDeck] = useState<MarketplaceDeck | null>(null);
  const [showSubscribedOnly, setShowSubscribedOnly] = useState(false);

  // 编辑弹窗
  const [editDeck, setEditDeck] = useState<MarketplaceDeck | null>(null);

  /** 加载市场牌组 */
  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketplaceDecks();
      setDecks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载市场失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  /** 从全部牌组中提取书家列表（去重） */
  const calligrapherOptions = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => {
      if (d.calligrapher) set.add(d.calligrapher);
    });
    return ['全部', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))];
  }, [decks]);

  /** 客户端筛选 */
  const filteredDecks = useMemo(() => {
    let list = decks;
    if (styleFilter !== '全部') {
      list = list.filter((d) => d.style === styleFilter);
    }
    if (calligrapherFilter !== '全部') {
      list = list.filter((d) => d.calligrapher === calligrapherFilter);
    }
    const kw = searchKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(kw) ||
          d.calligrapher.toLowerCase().includes(kw) ||
          d.description.toLowerCase().includes(kw) ||
          d.dynasty.toLowerCase().includes(kw),
      );
    }
    if (showSubscribedOnly) {
      list = list.filter((d) => d.is_subscribed);
    }
    // 推荐排最前
    return [...list].sort((a, b) => (b.featured ?? 0) - (a.featured ?? 0));
  }, [decks, styleFilter, calligrapherFilter, searchKeyword, showSubscribedOnly]);

  /** 订阅/退订 */
  const handleToggleSubscribe = useCallback(
    async (deck: MarketplaceDeck) => {
      if (deck.is_subscribed) {
        setUnsubConfirmDeck(deck);
        return;
      }
      setActionError(null);
      setPendingId(deck.deck_id);
      try {
        await subscribeDeck(deck.deck_id);
        setDecks((prev) =>
          prev.map((d) =>
            d.deck_id === deck.deck_id ? { ...d, is_subscribed: true } : d,
          ),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : '订阅失败');
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  /** 确认退订 */
  const handleConfirmUnsubscribe = useCallback(async () => {
    if (!unsubConfirmDeck) return;
    setActionError(null);
    setPendingId(unsubConfirmDeck.deck_id);
    try {
      await unsubscribeDeck(unsubConfirmDeck.deck_id);
      setDecks((prev) =>
        prev.map((d) =>
          d.deck_id === unsubConfirmDeck.deck_id
            ? { ...d, is_subscribed: false }
            : d,
        ),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '退订失败');
    } finally {
      setPendingId(null);
      setUnsubConfirmDeck(null);
    }
  }, [unsubConfirmDeck]);

  return (
    <Box className="space-y-3 py-4">
      {/* 顶部 */}
      <Box className="flex items-center gap-2 flex-wrap">
        <StoreIcon sx={{ color: 'primary.main', fontSize: 24 }} />
        <Typography variant="h5" className="font-kai" sx={{ fontWeight: 600 }}>
          市场
        </Typography>
        <Typography variant="body2" color="text.secondary">
          浏览并订阅书法牌组
        </Typography>
      </Box>

      {/* 搜索 + 筛选栏（紧凑单行） */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small" variant="outlined"
          placeholder="搜索牌组 / 书家 / 朝代..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          sx={{ minWidth: 220, flex: { xs: '1 1 100%', sm: '0 1 260px' }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon color="action" fontSize="small" /></InputAdornment>
            ),
            endAdornment: searchKeyword ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchKeyword('')} edge="end" aria-label="清空">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {STYLE_OPTIONS.map((s) => (
          <Chip
            key={s} label={s} size="small"
            color={styleFilter === s ? 'primary' : 'default'}
            variant={styleFilter === s ? 'filled' : 'outlined'}
            onClick={() => setStyleFilter(s)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
        <Chip
          label="已订阅"
          size="small"
          icon={showSubscribedOnly ? <CheckCircleIcon fontSize="small" /> : undefined}
          color={showSubscribedOnly ? 'primary' : 'default'}
          variant={showSubscribedOnly ? 'filled' : 'outlined'}
          onClick={() => setShowSubscribedOnly((v) => !v)}
          sx={{ cursor: 'pointer' }}
        />

        <TextField
          select size="small"
          value={calligrapherFilter}
          onChange={(e) => setCalligrapherFilter(e.target.value)}
          sx={{ minWidth: 120, '& .MuiInputBase-input': { fontSize: 13, py: 0.5 } }}
        >
          {calligrapherOptions.map((c) => (
            <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
          ))}
        </TextField>
      </Box>

      {/* 错误提示 */}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {actionError && <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 1 }}>{actionError}</Alert>}

      {/* 内容区：密集网格 */}
      {loading ? (
        <LoadingState message="正在加载市场..." />
      ) : filteredDecks.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title="没有找到匹配的牌组"
          description={
            searchKeyword.trim() || styleFilter !== '全部' || calligrapherFilter !== '全部'
              ? '换个筛选条件或关键词试试'
              : '市场暂无牌组'
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(3, 1fr)',
              sm: 'repeat(4, 1fr)',
              md: 'repeat(5, 1fr)',
              lg: 'repeat(6, 1fr)',
              xl: 'repeat(8, 1fr)',
            },
            gap: 1,
          }}
        >
          {filteredDecks.map((deck) => (
            <Box
              key={deck.deck_id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                transition: 'box-shadow 0.15s, transform 0.15s',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {/* 封面图区域 */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '3/4',
                  bgcolor: 'grey.50',
                  overflow: 'hidden',
                }}
              >
                {deck.cover_image ? (
                  <Box
                    component="img"
                    src={getImageUrl(deck.cover_image)}
                    alt={deck.name}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    loading="lazy"
                  />
                ) : (
                  <CoverPlaceholder name={deck.name} />
                )}

                {/* 推荐标记 */}
                {deck.featured === 1 && (
                  <Chip
                    label="荐"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      fontWeight: 700,
                      fontSize: 11,
                      height: 20,
                      bgcolor: 'primary.main',
                      color: '#fff',
                    }}
                  />
                )}

                {/* 订阅按钮（右下角悬浮） */}
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleToggleSubscribe(deck); }}
                  disabled={pendingId === deck.deck_id}
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    bgcolor: 'rgba(0,0,0,0.35)',
                    color: deck.is_subscribed ? '#4caf50' : 'rgba(255,255,255,0.85)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.55)',
                      color: deck.is_subscribed ? '#4caf50' : '#fff',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(0,0,0,0.2)',
                      color: 'rgba(255,255,255,0.4)',
                    },
                    width: 28,
                    height: 28,
                  }}
                >
                  {pendingId === deck.deck_id ? (
                    <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.7)' }} />
                  ) : deck.is_subscribed ? (
                    <CheckCircleIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <AddCircleOutlineIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Box>

              {/* 标题栏：牌组名 + admin 编辑 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 0.75,
                  py: 0.5,
                  gap: 0.25,
                  minHeight: 32,
                }}
              >
                <Tooltip title={`${deck.name}${deck.calligrapher ? ` · ${deck.calligrapher}` : ''}${deck.dynasty ? ` · ${deck.dynasty}` : ''}`}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontSize: { xs: 11, sm: 12 }, fontWeight: 500, flex: 1, minWidth: 0 }}
                  >
                    {deck.name}
                  </Typography>
                </Tooltip>
                {isAdmin && (
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setEditDeck(deck); }}
                    sx={{ width: 22, height: 22, opacity: 0.5, '&:hover': { opacity: 1 } }}
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* 退订确认对话框 */}
      <ConfirmDialog
        open={!!unsubConfirmDeck}
        title="退订牌组"
        message={`确定要退订「${unsubConfirmDeck?.name ?? ''}」吗？退订后该牌组的所有学习进度将被永久删除，此操作不可撤销。`}
        onConfirm={handleConfirmUnsubscribe}
        onCancel={() => setUnsubConfirmDeck(null)}
      />

      {/* 编辑弹窗 */}
      <EditDeckDialog
        deckId={editDeck?.deck_id ?? null}
        deckName={editDeck?.name ?? ''}
        open={!!editDeck}
        publishMode={false}
        onClose={() => setEditDeck(null)}
        onSaved={() => { setEditDeck(null); loadDecks(); }}
      />
    </Box>
  );
};

export default MarketPage;
