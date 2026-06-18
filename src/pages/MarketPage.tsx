import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  CircularProgress,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
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
  updateMarketDeck,
  uploadMarketCover,
  getImageUrl,
  updateDeckName,
} from '@/lib/api';
import type { MarketplaceDeck } from '@/types';
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
      fontSize: 32,
      fontWeight: 600,
    }}
  >
    {name?.charAt(0) || '?'}
  </Box>
);

/** 编辑弹窗（仅 admin） */
const STYLE_OPTIONS_FULL = ['', '楷', '行', '草', '隶', '篆'];

const EditDeckDialog: React.FC<{
  deck: MarketplaceDeck | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ deck, open, onClose, onSaved }) => {
  const [form, setForm] = useState({ calligrapher: '', dynasty: '', style: '', description: '', featured: 0 });
  const [deckName, setDeckName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (deck) {
      setForm({
        calligrapher: deck.calligrapher || '',
        dynasty: deck.dynasty || '',
        style: deck.style || '',
        description: deck.description || '',
        featured: deck.featured ?? 0,
      });
      setDeckName(deck.name || '');
    }
  }, [deck]);

  const handleSave = async () => {
    if (!deck) return;
    setSaving(true);
    setError(null);
    try {
      // 如果名称有变化，先更新牌组名称
      if (deckName.trim() !== (deck.name || '').trim()) {
        await updateDeckName(deck.deck_id, deckName.trim());
      }
      await updateMarketDeck(deck.deck_id, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!deck) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMarketCover(deck.deck_id, file);
      onSaved();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000); // 2 秒后自动消失
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>编辑字帖信息</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>封面图上传成功</Alert>}
        {deck && (
          <Box className="space-y-3" sx={{ mt: 1 }}>
            {/* 封面预览 + 换图 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Box
                sx={{
                  width: 100, height: 70, borderRadius: 1, overflow: 'hidden',
                  bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {deck.cover_image ? (
                  <Box component="img" src={getImageUrl(deck.cover_image)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Typography fontSize={11} color="text.disabled">无封面</Typography>
                )}
              </Box>
              <Box component="label" sx={{ cursor: 'pointer', fontSize: 13, color: 'primary.main' }}>
                {uploading ? '上传中...' : '上传封面图'}
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverUpload(f);
                }} />
              </Box>
            </Box>

            <TextField
              fullWidth size="small" label="牌组名称"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              sx={{ mb: 1 }}
            />

            <TextField
              fullWidth size="small" label="书家"
              value={form.calligrapher}
              onChange={(e) => setForm({ ...form, calligrapher: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="朝代"
              value={form.dynasty}
              onChange={(e) => setForm({ ...form, dynasty: e.target.value })}
            />
            <FormControl fullWidth size="small">
              <InputLabel>书体</InputLabel>
              <Select
                value={form.style}
                label="书体"
                onChange={(e) => setForm({ ...form, style: e.target.value })}
              >
                {STYLE_OPTIONS_FULL.map((s) => <MenuItem key={s} value={s}>{s || '无'}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              fullWidth size="small" label="描述" multiline rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <FormControl fullWidth size="small">
              <InputLabel>推荐状态</InputLabel>
              <Select
                value={form.featured}
                label="推荐状态"
                onChange={(e) => setForm({ ...form, featured: Number(e.target.value) as 0 | 1 })}
              >
                <MenuItem value={0}>普通</MenuItem>
                <MenuItem value={1}>推荐</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={16} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * 市场页面。
 * 路由 /market
 * 支持书体分类、书家筛选、关键词搜索、订阅/退订。
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
          d.dynasty.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [decks, styleFilter, calligrapherFilter, searchKeyword]);

  /** 订阅/退订 */
  const handleToggleSubscribe = useCallback(
    async (deck: MarketplaceDeck) => {
      setActionError(null);
      setPendingId(deck.deck_id);
      try {
        if (deck.is_subscribed) {
          await unsubscribeDeck(deck.deck_id);
        } else {
          await subscribeDeck(deck.deck_id);
        }
        setDecks((prev) =>
          prev.map((d) =>
            d.deck_id === deck.deck_id
              ? { ...d, is_subscribed: !d.is_subscribed }
              : d
          )
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : '操作失败');
      } finally {
        setPendingId(null);
      }
    },
    []
  );

  return (
    <Box className="space-y-4 py-4">
      {/* 顶部 */}
      <Box className="flex items-center gap-2 flex-wrap">
        <StoreIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" className="font-kai" sx={{ fontWeight: 600 }}>
          市场
        </Typography>
        <Typography variant="body2" color="text.secondary">
          浏览并订阅书法牌组
        </Typography>
      </Box>

      {/* 搜索 */}
      <TextField
        fullWidth size="small" variant="outlined"
        placeholder="搜索牌组 / 书家 / 朝代..."
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
          ),
          endAdornment: searchKeyword ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchKeyword('')} edge="end" aria-label="清空">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
      />

      {/* 书体分类 */}
      <Box className="flex items-center gap-1 flex-wrap">
        {STYLE_OPTIONS.map((s) => (
          <Chip
            key={s} label={s} size="small"
            color={styleFilter === s ? 'primary' : 'default'}
            variant={styleFilter === s ? 'filled' : 'outlined'}
            onClick={() => setStyleFilter(s)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      {/* 书家筛选 */}
      <Box className="flex items-center gap-2">
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>书家</Typography>
        <TextField
          select size="small"
          value={calligrapherFilter}
          onChange={(e) => setCalligrapherFilter(e.target.value)}
          sx={{ minWidth: 160, '& .MuiInputBase-input': { fontSize: 13, py: 0.5 } }}
        >
          {calligrapherOptions.map((c) => (
            <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
          ))}
        </TextField>
      </Box>

      {/* 错误提示 */}
      {error && <Alert severity="error">{error}</Alert>}
      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      {/* 内容区 */}
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
        <Grid container spacing={2}>
          {filteredDecks.map((deck) => (
            <Grid item xs={12} md={4} key={deck.deck_id}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 },
                }}
              >
                {/* 封面图 */}
                <Box
                  sx={{
                    width: '100%', aspectRatio: '16 / 9', bgcolor: 'grey.50',
                    overflow: 'hidden', position: 'relative', borderBottom: 1, borderColor: 'divider',
                  }}
                >
                  {deck.cover_image ? (
                    <Box
                      component="img"
                      src={getImageUrl(deck.cover_image)}
                      alt={deck.name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <CoverPlaceholder name={deck.name} />
                  )}
                  {deck.featured === 1 && (
                    <Chip
                      label="推荐" size="small" color="primary"
                      sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 600, bgcolor: 'primary.main', color: '#fff' }}
                    />
                  )}
                </Box>

                <CardContent sx={{ flex: 1, pb: 1 }}>
                  <Box className="flex items-start justify-between gap-1 mb-1">
                    <Typography variant="subtitle1" className="font-kai" sx={{ fontWeight: 600 }} noWrap>
                      {deck.name}
                    </Typography>
                    <Chip label={`${deck.card_count} 张`} size="small" variant="outlined" sx={{ fontSize: 11, height: 20, shrink: 0 }} />
                  </Box>
                  <Box className="flex items-center gap-1 mb-1 flex-wrap">
                    {deck.style && <Chip label={deck.style} size="small" color="primary" variant="outlined" sx={{ fontSize: 11, height: 20 }} />}
                    {deck.calligrapher && <Typography variant="caption" color="text.secondary">{deck.calligrapher}</Typography>}
                    {deck.dynasty && <Typography variant="caption" color="text.secondary">· {deck.dynasty}</Typography>}
                  </Box>
                  {deck.description && (
                    <Typography
                      variant="body2" color="text.secondary"
                      sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, minHeight: 40 }}
                    >
                      {deck.description}
                    </Typography>
                  )}
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
                  {/* admin：编辑图标按钮 */}
                  {isAdmin && (
                    <IconButton
                      size="small" color="inherit"
                      onClick={() => setEditDeck(deck)}
                      aria-label="编辑字帖"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  {/* 订阅/退订按钮 */}
                  <Button
                    fullWidth size="small"
                    variant={deck.is_subscribed ? 'outlined' : 'contained'}
                    color={deck.is_subscribed ? 'inherit' : 'primary'}
                    startIcon={
                      pendingId === deck.deck_id ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : deck.is_subscribed ? (
                        <CheckCircleIcon fontSize="small" />
                      ) : (
                        <AddCircleOutlineIcon fontSize="small" />
                      )
                    }
                    onClick={() => handleToggleSubscribe(deck)}
                    disabled={pendingId === deck.deck_id}
                    sx={{ textTransform: 'none' }}
                  >
                    {deck.is_subscribed ? '已订阅' : '订阅'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 编辑弹窗 */}
      <EditDeckDialog
        deck={editDeck}
        open={!!editDeck}
        onClose={() => setEditDeck(null)}
        onSaved={loadDecks}
      />
    </Box>
  );
};

export default MarketPage;
