import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StoreIcon from '@mui/icons-material/Store';
import { fetchMarketplaceDecks, updateMarketDeck, unpublishDeck, getImageUrl, uploadMarketCover } from '@/lib/api';
import type { MarketplaceDeck } from '@/types';
import { LoadingState } from '@/components/common/LoadingState';

const STYLE_OPTIONS = ['', '楷', '行', '草', '隶', '篆'];

/** 字帖元数据管理页面（仅 admin） */
const MarketAdminPage: React.FC = () => {
  const [decks, setDecks] = useState<MarketplaceDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDeck, setEditDeck] = useState<MarketplaceDeck | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMarketplaceDecks();
      setDecks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  /** 编辑元数据 */
  const handleEdit = (deck: MarketplaceDeck) => setEditDeck({ ...deck });

  const handleSave = async () => {
    if (!editDeck) return;
    setSaving(true);
    try {
      await updateMarketDeck(editDeck.deck_id, {
        calligrapher: editDeck.calligrapher,
        dynasty: editDeck.dynasty,
        style: editDeck.style,
        description: editDeck.description,
        featured: editDeck.featured,
      });
      setEditDeck(null);
      await loadDecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 上传封面 */
  const handleCoverUpload = async (deckId: string, file: File) => {
    try {
      const result = await uploadMarketCover(deckId, file);
      setDecks((prev) => prev.map((d) => d.deck_id === deckId ? { ...d, cover_image: result.cover_image } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    }
  };

  /** 下架 */
  const handleUnpublish = async (deck: MarketplaceDeck) => {
    if (!window.confirm(`确定下架「${deck.name}」？`)) return;
    try {
      await unpublishDeck(deck.deck_id);
      setDecks((prev) => prev.filter((d) => d.deck_id !== deck.deck_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '下架失败');
    }
  };

  return (
    <Box className="space-y-4 py-4">
      <Box className="flex items-center gap-2">
        <StoreIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" className="font-kai" sx={{ fontWeight: 600 }}>
          字帖管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          管理市场牌组的元数据、封面图、上下架
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <LoadingState message="加载中..." />
      ) : decks.length === 0 ? (
        <Typography color="text.secondary">暂无已发布的字帖</Typography>
      ) : (
        <Grid container spacing={2}>
          {decks.map((deck) => (
            <Grid item xs={12} md={6} key={deck.deck_id}>
              <Card variant="outlined" sx={{ borderRadius: 2, display: 'flex' }}>
                <Box
                  sx={{
                    width: 160,
                    minHeight: 140,
                    bgcolor: 'grey.50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
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
                    <Typography color="text.disabled" fontSize={12}>无封面</Typography>
                  )}
                  <Box
                    component="label"
                    sx={{
                      position: 'absolute', bottom: 4, right: 4,
                      bgcolor: 'rgba(0,0,0,0.5)', color: '#fff',
                      fontSize: 11, px: 0.5, py: 0.25, borderRadius: 0.5,
                      cursor: 'pointer',
                    }}
                  >
                    换图
                    <input type="file" accept="image/*" hidden onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCoverUpload(deck.deck_id, f);
                    }} />
                  </Box>
                </Box>
                <CardContent sx={{ flex: 1, py: 1.5, px: 2 }}>
                  <Box className="flex items-start justify-between">
                    <Box>
                      <Typography variant="subtitle1" className="font-kai" sx={{ fontWeight: 600 }}>
                        {deck.name}
                      </Typography>
                      <Box className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <Chip label={`${deck.card_count} 张`} size="small" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
                        {deck.style && <Chip label={deck.style} size="small" color="primary" variant="outlined" sx={{ fontSize: 11, height: 20 }} />}
                        {deck.featured === 1 && <Chip label="推荐" size="small" color="warning" sx={{ fontSize: 11, height: 20 }} />}
                      </Box>
                    </Box>
                    <Box className="flex gap-0.5">
                      <IconButton size="small" onClick={() => handleEdit(deck)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleUnpublish(deck)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>
                    {deck.calligrapher && <div>书家：{deck.calligrapher}</div>}
                    {deck.dynasty && <div>朝代：{deck.dynasty}</div>}
                    {deck.description && <div className="line-clamp-2">{deck.description}</div>}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 编辑弹窗 */}
      <Dialog open={!!editDeck} onClose={() => setEditDeck(null)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑字帖信息</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {editDeck && (
            <Box className="space-y-3" sx={{ mt: 1 }}>
              <TextField
                fullWidth size="small" label="书家"
                value={editDeck.calligrapher || ''}
                onChange={(e) => setEditDeck({ ...editDeck, calligrapher: e.target.value })}
              />
              <TextField
                fullWidth size="small" label="朝代"
                value={editDeck.dynasty || ''}
                onChange={(e) => setEditDeck({ ...editDeck, dynasty: e.target.value })}
              />
              <FormControl fullWidth size="small">
                <InputLabel>书体</InputLabel>
                <Select
                  value={editDeck.style || ''}
                  label="书体"
                  onChange={(e) => setEditDeck({ ...editDeck, style: e.target.value })}
                >
                  {STYLE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s || '无'}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                fullWidth size="small" label="描述" multiline rows={3}
                value={editDeck.description || ''}
                onChange={(e) => setEditDeck({ ...editDeck, description: e.target.value })}
              />
              <FormControl fullWidth size="small">
                <InputLabel>推荐状态</InputLabel>
                <Select
                  value={editDeck.featured ?? 0}
                  label="推荐状态"
                  onChange={(e) => setEditDeck({ ...editDeck, featured: Number(e.target.value) as 0 | 1 })}
                >
                  <MenuItem value={0}>普通</MenuItem>
                  <MenuItem value={1}>推荐</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDeck(null)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={16} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketAdminPage;
