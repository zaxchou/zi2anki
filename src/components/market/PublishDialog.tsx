import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  fetchMarketplaceDeck,
  publishDeck,
  updateMarketplaceDeck,
} from '@/lib/api';
import type { PublishDeckData, MarketplaceDeck } from '@/types';

/** 书体选项 */
const STYLE_OPTIONS = ['楷', '行', '草', '隶', '篆'] as const;

export interface PublishDialogProps {
  open: boolean;
  deckId: string | null;
  deckName: string;
  onClose: () => void;
  onPublished: (deck: MarketplaceDeck) => void;
}

/**
 * 管理员发布牌组到市场的对话框。
 * 打开时若该牌组已发布，则加载现有元数据回填。
 */
const PublishDialog: React.FC<PublishDialogProps> = ({
  open,
  deckId,
  deckName,
  onClose,
  onPublished,
}) => {
  const [calligrapher, setCalligrapher] = useState('');
  const [dynasty, setDynasty] = useState('');
  const [style, setStyle] = useState<string>('楷');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [featured, setFeatured] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  /** 加载已发布元数据 */
  const loadExisting = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketplaceDeck(id);
      setIsPublished(true);
      setCalligrapher(data.calligrapher || '');
      setDynasty(data.dynasty || '');
      setStyle(data.style || '楷');
      setDescription(data.description || '');
      setCoverImage(data.cover_image || '');
      setFeatured(data.featured === 1);
    } catch (err) {
      // 未发布或不存在的市场牌组：视为新发布
      setIsPublished(false);
      // 静默忽略错误
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && deckId) {
      // 重置状态
      setCalligrapher('');
      setDynasty('');
      setStyle('楷');
      setDescription('');
      setCoverImage('');
      setFeatured(false);
      setError(null);
      setIsPublished(false);
      loadExisting(deckId);
    }
  }, [open, deckId, loadExisting]);

  /** 保存 */
  const handleSave = useCallback(async () => {
    if (!deckId || saving) return;
    if (!calligrapher.trim()) {
      setError('请填写书家');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: PublishDeckData = {
      calligrapher: calligrapher.trim(),
      dynasty: dynasty.trim(),
      style,
      description: description.trim(),
      cover_image: coverImage.trim(),
      featured,
    };
    try {
      let result: MarketplaceDeck;
      if (isPublished) {
        result = await updateMarketplaceDeck(deckId, payload);
      } else {
        result = await publishDeck(deckId, payload);
      }
      setIsPublished(true);
      onPublished(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    deckId,
    saving,
    calligrapher,
    dynasty,
    style,
    description,
    coverImage,
    featured,
    isPublished,
    onPublished,
    onClose,
  ]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {isPublished ? '编辑市场信息' : '发布到市场'}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          牌组：{deckName}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {loading ? (
          <Box className="flex justify-center py-8">
            <CircularProgress />
          </Box>
        ) : (
          <Box className="space-y-3">
            {error && <Alert severity="error">{error}</Alert>}
            {isPublished && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                该牌组已发布到市场，修改将立即生效。
              </Alert>
            )}

            <TextField
              fullWidth
              required
              label="书家"
              value={calligrapher}
              onChange={(e) => setCalligrapher(e.target.value)}
              placeholder="例如：王羲之"
              disabled={saving}
            />

            <TextField
              fullWidth
              label="朝代"
              value={dynasty}
              onChange={(e) => setDynasty(e.target.value)}
              placeholder="例如：东晋"
              disabled={saving}
            />

            <FormControl fullWidth disabled={saving}>
              <InputLabel>书体</InputLabel>
              <Select
                value={style}
                label="书体"
                onChange={(e) => setStyle(e.target.value)}
              >
                {STYLE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              label="简介"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="牌组简介、内容特点等..."
              disabled={saving}
            />

            <TextField
              fullWidth
              label="封面图 URL"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://... 或留空使用默认封面"
              disabled={saving}
              helperText="可选，留空时使用牌组首张卡片图片"
            />

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  disabled={saving}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" component="span" fontWeight={500}>
                    推荐牌组
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    推荐牌组会在市场中显示"推荐"标记
                  </Typography>
                </Box>
              }
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving || !calligrapher.trim()}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? '保存中...' : isPublished ? '保存修改' : '发布'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublishDialog;
