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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import StoreIcon from '@mui/icons-material/Store';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
import DeckDetailDialog from '@/components/market/DeckDetailDialog';
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
      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
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

  // 详情弹窗
  const [detailDeck, setDetailDeck] = useState<MarketplaceDeck | null>(null);

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
  const featuredDecks = useMemo(() => {
    return decks.filter((d) => d.featured === 1);
  }, [decks]);

  const regularDecks = useMemo(() => {
    let list = decks.filter((d) => d.featured !== 1);
    if (styleFilter !== '全部') {
      list = list.filter((d) => d.style.includes(styleFilter));
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
    return list;
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

  /** 渲染单张牌组卡片 */
  const renderDeckCard = useCallback((deck: MarketplaceDeck) => (
    <Box
      key={deck.deck_id}
      onClick={() => setDetailDeck(deck)}
      sx={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: (t: any) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'grey.100',
          boxShadow: (t: any) => t.palette.mode === 'dark' ? '0px 0px 0px 1px rgba(255,255,255,0.12)' : '0px 0px 0px 1px rgba(0,0,0,0.08)',
        }}
      >
        {deck.cover_image ? (
          <Box component="img" src={getImageUrl(deck.cover_image)} alt={deck.name}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <CoverPlaceholder name={deck.name} />
        )}
      </Box>
      <Typography variant="caption" noWrap
        sx={{ mt: 0.5, textAlign: 'center', fontSize: { xs: 10, sm: 11 }, fontWeight: 500 }}>
        {deck.name}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.25 }}>
        {pendingId === deck.deck_id ? (
          <CircularProgress size={12} />
        ) : (
          <Typography component="span"
            onClick={(e) => { e.stopPropagation(); handleToggleSubscribe(deck); }}
            sx={{
              fontSize: 10, fontWeight: 600,
              color: deck.is_subscribed ? 'success.main' : 'primary.main',
              cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, userSelect: 'none',
            }}
          >
            {deck.is_subscribed ? '已订阅' : '+ 订阅'}
          </Typography>
        )}
        {isAdmin && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditDeck(deck); }}
            sx={{ width: 16, height: 16, ml: 0.25, opacity: 0.35, '&:hover': { opacity: 1 } }}>
            <EditIcon sx={{ fontSize: 10 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  ), [pendingId, isAdmin, setDetailDeck, handleToggleSubscribe, setEditDeck]);

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

      {/* 内容区 */}
      {loading ? (
        <LoadingState message="正在加载市场..." />
      ) : (featuredDecks.length === 0 && regularDecks.length === 0) ? (
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
        <>
          {/* 推荐专区：渐变背景 + 大标题 + 装饰边框 */}
          {featuredDecks.length > 0 && (
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                bgcolor: 'background.paper',
                boxShadow: (t: any) => t.palette.mode === 'dark' ? '0px 0px 0px 1px rgba(255,255,255,0.12)' : '0px 0px 0px 1px rgba(0,0,0,0.08)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5 }}>
                <Typography
                  className="font-kai"
                  sx={{
                    fontSize: { xs: 18, sm: 20 },
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #1976d2 0%, #9c27b0 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  ✦ 编辑精选
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  最值得收藏的书法字帖
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(4, 1fr)',
                    sm: 'repeat(4, 1fr)',
                    md: 'repeat(5, 1fr)',
                    lg: 'repeat(6, 1fr)',
                    xl: 'repeat(7, 1fr)',
                  },
                  gap: { xs: 1, sm: 1.25 },
                }}
              >
                {featuredDecks.map((deck) => renderDeckCard(deck))}
              </Box>
            </Box>
          )}

          {/* 全部牌组：朴素分隔线 + 小标题 */}
          <Box sx={{ mt: featuredDecks.length > 0 ? 3 : 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 1.5,
                '&::before, &::after': {
                  content: '""',
                  flex: 1,
                  height: '1px',
                  bgcolor: 'divider',
                },
              }}
            >
              <Typography
                className="font-kai"
                sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}
              >
                全部字帖
              </Typography>
            </Box>
            <Box
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(4, 1fr)',
                    sm: 'repeat(4, 1fr)',
                    md: 'repeat(5, 1fr)',
                    lg: 'repeat(6, 1fr)',
                    xl: 'repeat(7, 1fr)',
                  },
                  gap: { xs: 1, sm: 1.25 },
                }}
              >
                {regularDecks.map((deck) => renderDeckCard(deck))}
              </Box>
            </Box>
          </Box>
        </>
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

      {/* 详情弹窗 */}
      <DeckDetailDialog
        open={!!detailDeck}
        deck={detailDeck}
        onClose={() => setDetailDeck(null)}
        onSubscribed={loadDecks}
      />
    </Box>
  );
};

export default MarketPage;
