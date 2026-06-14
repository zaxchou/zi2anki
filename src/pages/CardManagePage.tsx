import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Card as MuiCard,
  Chip,
  LinearProgress,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CardMedia,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import UploadIcon from '@mui/icons-material/Upload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SchoolIcon from '@mui/icons-material/School';
import { useDeckStore } from '@/stores/useDeckStore';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/lib/constants';
import {
  fetchCards,
  createCard as createCardApi,
  deleteCardApi,
  batchImportCards,
  fetchDecks,
  getImageUrl,
  updateCard,
  updateDeckLimits,
} from '@/lib/api';
import type { Card, Deck } from '@/types';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { LoadingState, EmptyState } from '@/components/common/LoadingState';

/** 表单文件选择接受类型字符串 */
const ACCEPT_TYPES = ALLOWED_IMAGE_TYPES.join(',');

/** 将 File 转为 base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 卡片管理页面。
 * 路由 /decks/:deckId/cards
 * 支持查看卡片列表、添加卡片（含图片）、删除卡片、批量导入。
 */
const CardManagePage: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { updateCardCount, loadDecks } = useDeckStore();

  // 数据状态
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 添加卡片对话框
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newFrontText, setNewFrontText] = useState('');
  const [newBackText, setNewBackText] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);

  // 批量导入对话框
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchPreviews, setBatchPreviews] = useState<
    { file: File; previewUrl: string; frontText: string; valid: boolean; error?: string }[]
  >([]);

  // 文字批量导入
  const [textBatchOpen, setTextBatchOpen] = useState(false);
  const [textBatchContent, setTextBatchContent] = useState('');
  const [textBatchImporting, setTextBatchImporting] = useState(false);
  const [textBatchResult, setTextBatchResult] = useState<string | null>(null);

  // 牌组学习上限编辑
  const [deckLimitsOpen, setDeckLimitsOpen] = useState(false);
  const [editingNewLimit, setEditingNewLimit] = useState(20);
  const [editingReviewLimit, setEditingReviewLimit] = useState(200);
  const [savingLimits, setSavingLimits] = useState(false);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState(0);
  const [batchImportTotal, setBatchImportTotal] = useState(0);
  const [batchGeneralError, setBatchGeneralError] = useState<string | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // 编辑卡片
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Card | null>(null);
  const [editFrontText, setEditFrontText] = useState('');
  const [editBackText, setEditBackText] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // 预览卡片
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // 加载牌组和卡片数据
  const loadData = useCallback(async () => {
    if (!deckId) {
      setError('无效的牌组 ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [decks, cardsData] = await Promise.all([
        fetchDecks(),
        fetchCards(deckId),
      ]);

      const deckData = decks.find((d) => d.id === deckId);
      if (!deckData) {
        setError('牌组不存在');
        setLoading(false);
        return;
      }

      setDeck(deckData);
      setCards(cardsData);
      setEditingNewLimit(deckData.daily_new_card_limit ?? 20);
      setEditingReviewLimit(deckData.daily_review_limit ?? 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载卡片失败');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 刷新卡片计数 */
  const refreshCardCount = useCallback(
    async (newCards: Card[]) => {
      if (!deckId) return;
      const count = newCards.length;
      await updateCardCount(deckId, count);
      // 同步更新本地 deck 状态
      setDeck((prev) => (prev ? { ...prev, card_count: count } : prev));
      // 同步更新牌组 store
      loadDecks();
    },
    [deckId, updateCardCount, loadDecks]
  );

  /** 打开添加对话框 */
  const handleOpenAddDialog = useCallback(() => {
    setNewFrontText('');
    setNewImageFile(null);
    setNewImagePreview(null);
    setAddError(null);
    setAddDialogOpen(true);
  }, []);

  /** 关闭添加对话框 */
  const handleCloseAddDialog = useCallback(() => {
    setAddDialogOpen(false);
    setNewFrontText('');
    setNewBackText('');
    setNewImageFile(null);
    setNewImagePreview(null);
    setAddError(null);
  }, []);

  /** 处理文件选择 */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setAddError(null);

      // 验证文件类型
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        setAddError('不支持的图片格式，请选择 JPG、PNG 或 WebP 格式');
        return;
      }

      // 验证文件大小
      if (file.size > MAX_IMAGE_SIZE) {
        setAddError(`图片大小不能超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
        return;
      }

      // 释放旧的 ObjectURL
      if (newImagePreview) {
        URL.revokeObjectURL(newImagePreview);
      }

      const previewUrl = URL.createObjectURL(file);
      setNewImageFile(file);
      setNewImagePreview(previewUrl);
    },
    [newImagePreview]
  );

  /** 确认添加卡片 */
  const handleConfirmAdd = useCallback(async () => {
    if (!deckId || !newFrontText.trim() || adding) return;

    setAddError(null);
    setAdding(true);

    try {
      // 如果有图片，先转为 base64
      let imageBase64: string | undefined;
      if (newImageFile) {
        imageBase64 = await fileToBase64(newImageFile);
      }

      const newCard = await createCardApi(deckId, newFrontText.trim(), imageBase64, newBackText.trim());

      const updatedCards = [newCard, ...cards];
      setCards(updatedCards);
      await refreshCardCount(updatedCards);
      handleCloseAddDialog();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '添加卡片失败');
    } finally {
      setAdding(false);
    }
  }, [deckId, newFrontText, newBackText, newImageFile, adding, cards, refreshCardCount, handleCloseAddDialog]);

  /** 打开删除确认 */
  const handleOpenDelete = useCallback((card: Card) => {
    setDeleteTarget(card);
    setDeleteDialogOpen(true);
  }, []);

  /** 确认删除卡片 */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteCardApi(deleteTarget.id);

      // 释放 ObjectURL 内存（如果是旧 blob URL）
      if (deleteTarget.image_url && deleteTarget.image_url.startsWith('blob:')) {
        URL.revokeObjectURL(deleteTarget.image_url);
      }

      const updatedCards = cards.filter((c) => c.id !== deleteTarget.id);
      setCards(updatedCards);
      await refreshCardCount(updatedCards);
    } catch (err) {
      console.error('[CardManagePage] 删除卡片失败:', err);
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, cards, refreshCardCount]);

  /** 取消删除 */
  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  }, []);

  /** 打开编辑对话框 */
  const handleOpenEdit = useCallback((card: Card) => {
    setEditTarget(card);
    setEditFrontText(card.front_text);
    setEditBackText(card.back_text || '');
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditError(null);
    setEditDialogOpen(true);
  }, []);

  /** 关闭编辑对话框 */
  const handleCloseEdit = useCallback(() => {
    setEditDialogOpen(false);
    setEditTarget(null);
    setEditFrontText('');
    setEditBackText('');
    setEditImageFile(null);
    if (editImagePreview) {
      URL.revokeObjectURL(editImagePreview);
    }
    setEditImagePreview(null);
    setEditError(null);
  }, [editImagePreview]);

  /** 编辑状态下选择新图片 */
  const handleEditFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setEditError(null);

      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        setEditError('不支持的图片格式，请选择 JPG、PNG 或 WebP 格式');
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setEditError(`图片大小不能超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
        return;
      }

      if (editImagePreview) {
        URL.revokeObjectURL(editImagePreview);
      }

      const previewUrl = URL.createObjectURL(file);
      setEditImageFile(file);
      setEditImagePreview(previewUrl);
    },
    [editImagePreview]
  );

  /** 确认保存编辑 */
  const handleConfirmEdit = useCallback(async () => {
    if (!editTarget || !editFrontText.trim() || editing) return;

    setEditError(null);
    setEditing(true);

    try {
      const updateFields: Record<string, string> = {
        front_text: editFrontText.trim(),
        back_text: editBackText.trim(),
      };
      if (editImageFile) {
        updateFields.image_url = await fileToBase64(editImageFile);
      }
      const updated = await updateCard(editTarget.id, updateFields as any);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      handleCloseEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '保存卡片失败');
    } finally {
      setEditing(false);
    }
  }, [editTarget, editFrontText, editBackText, editImageFile, editing, handleCloseEdit]);

  /** 打开批量导入对话框 */
  const handleOpenBatchDialog = useCallback(() => {
    setBatchFiles([]);
    setBatchPreviews([]);
    setBatchGeneralError(null);
    setBatchImportProgress(0);
    setBatchImportTotal(0);
    setBatchDialogOpen(true);
  }, []);

  /** 关闭批量导入对话框，释放所有 blob URL */
  const handleCloseBatchDialog = useCallback(() => {
    setBatchDialogOpen(false);
    for (const entry of batchPreviews) {
      URL.revokeObjectURL(entry.previewUrl);
    }
    setBatchFiles([]);
    setBatchPreviews([]);
    setBatchGeneralError(null);
    setBatchImportProgress(0);
    setBatchImportTotal(0);
  }, [batchPreviews]);

  /** 处理批量文件选择 */
  const handleBatchFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setBatchGeneralError(null);

      // 释放旧预览
      for (const entry of batchPreviews) {
        URL.revokeObjectURL(entry.previewUrl);
      }

      const newPreviews: {
        file: File;
        previewUrl: string;
        frontText: string;
        valid: boolean;
        error?: string;
      }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // 验证文件类型
        if (
          !ALLOWED_IMAGE_TYPES.includes(
            file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
          )
        ) {
          newPreviews.push({
            file,
            previewUrl: '',
            frontText: file.name.replace(/\.[^.]+$/, ''),
            valid: false,
            error: `不支持的文件类型：${file.type || '未知'}`,
          });
          continue;
        }

        // 验证文件大小
        if (file.size > MAX_IMAGE_SIZE) {
          newPreviews.push({
            file,
            previewUrl: '',
            frontText: file.name.replace(/\.[^.]+$/, ''),
            valid: false,
            error: `文件过大：${(file.size / 1024 / 1024).toFixed(1)}MB（上限 ${MAX_IMAGE_SIZE / 1024 / 1024}MB）`,
          });
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        const frontText = file.name.replace(/\.[^.]+$/, '');

        newPreviews.push({
          file,
          previewUrl,
          frontText,
          valid: true,
        });
      }

      setBatchFiles(Array.from(files));
      setBatchPreviews(newPreviews);
    },
    [batchPreviews]
  );

  /** 确认批量导入 */
  const handleConfirmBatchImport = useCallback(async () => {
    if (!deckId || batchImporting) return;

    const validEntries = batchPreviews.filter((e) => e.valid);
    if (validEntries.length === 0) {
      setBatchGeneralError('没有可导入的有效图片文件');
      return;
    }

    setBatchImporting(true);
    setBatchGeneralError(null);
    setBatchImportTotal(validEntries.length);
    setBatchImportProgress(0);

    try {
      const validFiles = validEntries.map((e) => e.file);
      const result = await batchImportCards(deckId, validFiles);

      // 更新卡片列表
      const updatedCards = [...result.cards, ...cards];
      setCards(updatedCards);
      await refreshCardCount(updatedCards);

      // 释放预览 URL
      for (const entry of batchPreviews) {
        URL.revokeObjectURL(entry.previewUrl);
      }

      setBatchImporting(false);
      setBatchDialogOpen(false);
      setBatchFiles([]);
      setBatchPreviews([]);
      setBatchGeneralError(null);
      setBatchImportProgress(0);
      setBatchImportTotal(0);
    } catch (err) {
      setBatchGeneralError(
        err instanceof Error ? err.message : '批量导入失败'
      );
      setBatchImporting(false);
    }
  }, [deckId, batchImporting, batchPreviews, cards, refreshCardCount]);

  /** 文字批量导入 */
  const handleTextBatchImport = useCallback(async () => {
    if (!deckId || !textBatchContent.trim() || textBatchImporting) return;
    setTextBatchImporting(true);
    setTextBatchResult(null);
    try {
      const { batchImportText } = await import('@/lib/api');
      const result = await batchImportText(deckId, textBatchContent);
      setTextBatchResult(`成功导入 ${result.created} 张卡片`);
      setTextBatchContent('');
      const updatedCards = await fetchCards(deckId);
      setCards(updatedCards);
      await refreshCardCount(updatedCards);
    } catch (err) {
      setTextBatchResult(err instanceof Error ? err.message : '导入失败');
    } finally {
      setTextBatchImporting(false);
    }
  }, [deckId, textBatchContent, textBatchImporting, refreshCardCount]);

  /** 保存牌组学习上限 */
  const handleSaveLimits = useCallback(async () => {
    if (!deckId || savingLimits) return;
    setSavingLimits(true);
    try {
      const updated = await updateDeckLimits(deckId, {
        daily_new_card_limit: editingNewLimit,
        daily_review_limit: editingReviewLimit,
      });
      setDeck((prev) => prev ? { ...prev, ...updated } : prev);
      setDeckLimitsOpen(false);
    } catch (err) {
      console.error('保存上限失败:', err);
    } finally {
      setSavingLimits(false);
    }
  }, [deckId, editingNewLimit, editingReviewLimit, savingLimits]);

  /** 清理 ObjectURL（组件卸载时） */
  useEffect(() => {
    return () => {
      if (newImagePreview) {
        URL.revokeObjectURL(newImagePreview);
      }
      if (editImagePreview) {
        URL.revokeObjectURL(editImagePreview);
      }
      for (const entry of batchPreviews) {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      }
    };
  }, [newImagePreview, editImagePreview, batchPreviews]);

  // 加载状态
  if (loading) {
    return <LoadingState message="正在加载卡片列表..." />;
  }

  // 错误状态
  if (error) {
    return (
      <Box className="py-4">
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
        <Box className="flex gap-2">
          <Button variant="outlined" onClick={() => navigate(-1)}>
            返回
          </Button>
          <Button variant="contained" onClick={loadData}>
            重试
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="space-y-4 py-4">
      {/* 顶部：返回按钮 + 牌组名称 + 开始学习按钮 */}
      <Box className="flex items-center gap-2 flex-wrap">
        <IconButton
          edge="start"
          aria-label="返回"
          onClick={() => navigate(-1)}
          size="small"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" className="font-kai">
          {deck?.name ?? '牌组'}
        </Typography>
        {deck && (
          <Chip
            label={`${deck.card_count} 张卡片`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
        <Box sx={{ flex: 1 }} />
        {deck && (
          <Button
            variant="contained"
            startIcon={<SchoolIcon />}
            onClick={() => navigate(`/study/${deck.id}`)}
            disabled={deck.card_count === 0}
            sx={{ fontWeight: 600 }}
          >
            开始学习
          </Button>
        )}
      </Box>

      {/* 学习上限设置 */}
      <Accordion
        expanded={deckLimitsOpen}
        onChange={() => setDeckLimitsOpen(!deckLimitsOpen)}
        variant="outlined"
        sx={{ borderRadius: 2, '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" fontWeight={500}>
            每日学习上限：新卡 {editingNewLimit} · 复习 {editingReviewLimit}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box className="space-y-4">
            <Box>
              <Typography variant="body2" className="mb-1">每日新卡上限：{editingNewLimit}</Typography>
              <Slider value={editingNewLimit} onChange={(_, v) => setEditingNewLimit(v as number)} min={1} max={100} step={1} valueLabelDisplay="auto" />
            </Box>
            <Box>
              <Typography variant="body2" className="mb-1">每日复习上限：{editingReviewLimit}</Typography>
              <Slider value={editingReviewLimit} onChange={(_, v) => setEditingReviewLimit(v as number)} min={1} max={500} step={1} valueLabelDisplay="auto" />
            </Box>
            <Button variant="contained" size="small" onClick={handleSaveLimits} disabled={savingLimits}>
              {savingLimits ? '保存中...' : '保存上限'}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 添加 / 批量导入按钮 */}
      <Box className="flex gap-2">
        <Button
          variant="contained"
          fullWidth
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
        >
          添加卡片
        </Button>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<FolderOpenIcon />}
          onClick={handleOpenBatchDialog}
        >
          批量导入
        </Button>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<EditIcon />}
          onClick={() => setTextBatchOpen(true)}
        >
          文字导入
        </Button>
      </Box>

      {/* 卡片列表或空状态 */}
      {cards.length === 0 ? (
        <EmptyState
          icon={<ImageIcon />}
          title="还没有卡片"
          description="点击上方按钮添加书法记忆卡片"
        />
      ) : (
        <MuiCard variant="outlined" sx={{ borderRadius: 2 }}>
          <List disablePadding>
            {cards.map((card, index) => (
              <ListItem
                key={card.id}
                divider={index < cards.length - 1}
                className="px-4 py-3"
              >
                <ListItemAvatar
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setPreviewCard(card)}
                >
                  {card.image_url ? (
                    <Avatar
                      variant="rounded"
                      src={getImageUrl(card.image_url)}
                      alt={card.front_text}
                      sx={{ width: 48, height: 48 }}
                    />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'grey.200' }}>
                      <ImageIcon color="disabled" />
                    </Avatar>
                  )}
                </ListItemAvatar>
                <ListItemText
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setPreviewCard(card)}
                  primary={
                    <Typography variant="subtitle1" className="font-kai">
                      {card.front_text}
                    </Typography>
                  }
                  secondary={`创建于 ${new Date(card.created_at).toLocaleDateString('zh-CN')}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleOpenEdit(card)}
                    size="small"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label={`删除卡片 ${card.front_text}`}
                    onClick={() => handleOpenDelete(card)}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </MuiCard>
      )}

      {/* 卡片预览弹窗 */}
      {previewCard && (() => {
        const idx = cards.findIndex((c) => c.id === previewCard.id);
        const prevCard = idx > 0 ? cards[idx - 1] : null;
        const nextCard = idx >= 0 && idx < cards.length - 1 ? cards[idx + 1] : null;
        return (
      <Dialog
        open={!!previewCard}
        onClose={() => setPreviewCard(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" className="font-kai" fontWeight={600}>
            卡片预览
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {idx + 1} / {cards.length}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {previewCard && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 图片 */}
              {previewCard.image_url && (
                <Box
                  sx={{
                    width: '100%',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <CardMedia
                    component="img"
                    image={getImageUrl(previewCard.image_url)}
                    alt={previewCard.front_text}
                    sx={{ maxHeight: 280, objectFit: 'contain', bgcolor: 'grey.50' }}
                  />
                </Box>
              )}

              {/* 正面 */}
              <Box sx={{ px: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  正面
                </Typography>
                <Typography variant="h5" className="font-kai" fontWeight={700} sx={{ mt: 0.5 }}>
                  {previewCard.front_text}
                </Typography>
              </Box>

              {/* 反面 */}
              <Box sx={{ px: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  背面
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {previewCard.back_text || '（无释义）'}
                </Typography>
              </Box>

              {/* 元信息 */}
              <Box sx={{ px: 1, pt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  创建于 {new Date(previewCard.created_at).toLocaleDateString('zh-CN')}
                  {previewCard.interval > 0 && ` · 已学习 ${previewCard.repetitions} 次`}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            onClick={() => prevCard && setPreviewCard(prevCard)}
            disabled={!prevCard}
            startIcon={<ChevronLeftIcon />}
            sx={{ textTransform: 'none' }}
          >
            上一张
          </Button>
          <Button onClick={() => setPreviewCard(null)} variant="outlined" sx={{ textTransform: 'none' }}>
            关闭
          </Button>
          <Button
            onClick={() => nextCard && setPreviewCard(nextCard)}
            disabled={!nextCard}
            endIcon={<ChevronRightIcon />}
            sx={{ textTransform: 'none' }}
          >
            下一张
          </Button>
        </DialogActions>
      </Dialog>
        );
      })()}

      {/* 添加卡片对话框 */}
      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        aria-labelledby="add-card-dialog-title"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle id="add-card-dialog-title" sx={{ py: 1.5 }}>添加卡片</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {addError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'text.primary' }}>
                正面文字<span style={{ color: '#d32f2f', marginLeft: 2 }}>*</span>
              </Typography>
              <TextField
                autoFocus
                fullWidth
                required
                value={newFrontText}
                onChange={(e) => setNewFrontText(e.target.value)}
                placeholder="输入卡片正面的汉字..."
                multiline
                minRows={3}
                maxRows={8}
                inputProps={{ maxLength: 100 }}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'text.primary' }}>
                背面文字
              </Typography>
              <TextField
                fullWidth
                value={newBackText}
                onChange={(e) => setNewBackText(e.target.value)}
                placeholder="纯文字卡片可在此输入背面内容..."
                multiline
                minRows={4}
                maxRows={10}
                inputProps={{ maxLength: 500 }}
              />
            </Box>

            {/* 图片上传区域 */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                书法图片（可选）
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_TYPES}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
              >
                {newImageFile ? newImageFile.name : '选择图片'}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                支持 JPG、PNG、WebP 格式，最大 10MB
              </Typography>
            </Box>

            {/* 图片预览 */}
            {newImagePreview && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={newImagePreview}
                  alt="预览"
                  sx={{ maxHeight: 200, maxWidth: '100%', borderRadius: 2, border: 1, borderColor: 'divider', objectFit: 'contain' }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} color="inherit" disabled={adding}>
            取消
          </Button>
          <Button
            onClick={handleConfirmAdd}
            variant="contained"
            disabled={!newFrontText.trim() || adding}
          >
            {adding ? '添加中...' : '确认添加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 文字批量导入对话框 */}
      <Dialog
        open={textBatchOpen}
        onClose={() => { setTextBatchOpen(false); setTextBatchResult(null); }}
        maxWidth="sm" fullWidth
      >
        <DialogTitle>文字批量导入</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" className="mb-2">
            每两行为一组卡片（第一行正面，第二行背面），空行自动忽略
          </Typography>
          <TextField
            autoFocus
            multiline
            minRows={8}
            maxRows={16}
            fullWidth
            value={textBatchContent}
            onChange={(e) => setTextBatchContent(e.target.value)}
            placeholder={`天地
世界
日月
星辰`}
            className="mb-2"
            disabled={textBatchImporting}
          />
          {textBatchResult && (
            <Alert severity={textBatchResult.startsWith('成功') ? 'success' : 'error'} className="mt-2">
              {textBatchResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTextBatchOpen(false); setTextBatchResult(null); }} disabled={textBatchImporting}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleTextBatchImport}
            disabled={!textBatchContent.trim() || textBatchImporting}
          >
            {textBatchImporting ? '导入中...' : '确认导入'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除卡片"
        message={
          deleteTarget
            ? `确定要删除卡片「${deleteTarget.front_text}」吗？此操作不可撤销。`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* 编辑卡片对话框 */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEdit}
        aria-labelledby="edit-card-dialog-title"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle id="edit-card-dialog-title" sx={{ py: 1.5 }}>编辑卡片</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'text.primary' }}>
                正面文字<span style={{ color: '#d32f2f', marginLeft: 2 }}>*</span>
              </Typography>
              <TextField
                autoFocus
                fullWidth
                required
                value={editFrontText}
                onChange={(e) => setEditFrontText(e.target.value)}
                placeholder="输入卡片正面的汉字..."
                multiline
                minRows={3}
                maxRows={8}
                inputProps={{ maxLength: 100 }}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'text.primary' }}>
                背面文字
              </Typography>
              <TextField
                fullWidth
                value={editBackText}
                onChange={(e) => setEditBackText(e.target.value)}
                placeholder="纯文字卡片在此输入背面内容..."
                multiline
                minRows={4}
                maxRows={10}
                inputProps={{ maxLength: 500 }}
              />
            </Box>

            {/* 图片区域 */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                书法图片
              </Typography>

              {/* 当前图片 */}
              {editTarget?.image_url && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                  <Box
                    component="img"
                    src={getImageUrl(editTarget.image_url)}
                    alt={editTarget.front_text}
                    sx={{ maxHeight: 160, maxWidth: '100%', borderRadius: 2, border: 1, borderColor: 'divider', objectFit: 'contain' }}
                  />
                </Box>
              )}

              <input
                ref={editFileInputRef}
                type="file"
                accept={ACCEPT_TYPES}
                onChange={handleEditFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => editFileInputRef.current?.click()}
                fullWidth
                disabled={editing}
              >
                {editImageFile ? editImageFile.name : '更换图片'}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                选择新图片则替换，不选则保留原图；支持 JPG、PNG、WebP 格式，最大 10MB
              </Typography>
            </Box>

            {/* 新图片预览 */}
            {editImagePreview && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={editImagePreview}
                  alt="新图片预览"
                  sx={{ maxHeight: 200, maxWidth: '100%', borderRadius: 2, border: 1, borderColor: 'divider', objectFit: 'contain' }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} color="inherit" disabled={editing}>
            取消
          </Button>
          <Button
            onClick={handleConfirmEdit}
            variant="contained"
            disabled={!editFrontText.trim() || editing}
          >
            {editing ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 批量导入对话框 */}
      <Dialog
        open={batchDialogOpen}
        onClose={batchImporting ? undefined : handleCloseBatchDialog}
        aria-labelledby="batch-import-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="batch-import-dialog-title">
          批量导入卡片
        </DialogTitle>
        <DialogContent>
          {batchGeneralError && (
            <Alert severity="error" className="mb-3 whitespace-pre-line">
              {batchGeneralError}
            </Alert>
          )}

          {/* 文件选择区域 */}
          <Box className="mb-3 mt-1">
            <input
              ref={batchFileInputRef}
              type="file"
              multiple
              accept={ACCEPT_TYPES}
              onChange={handleBatchFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => batchFileInputRef.current?.click()}
              fullWidth
              disabled={batchImporting}
            >
              {batchFiles.length > 0
                ? `已选择 ${batchFiles.length} 个文件（点击重新选择）`
                : '选择图片文件'}
            </Button>
            <Typography variant="caption" color="text.secondary" className="mt-1 block">
              支持 JPG、PNG、WebP 格式，最大 10MB；可多选
            </Typography>
          </Box>

          {/* 导入进度条 */}
          {batchImporting && batchImportTotal > 0 && (
            <Box className="mb-3">
              <Typography variant="body2" color="text.secondary" className="mb-1">
                正在导入... {batchImportProgress} / {batchImportTotal}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(batchImportProgress / batchImportTotal) * 100}
              />
            </Box>
          )}

          {/* 文件预览列表 */}
          {batchPreviews.length > 0 && (
            <MuiCard variant="outlined" sx={{ borderRadius: 2 }}>
              <List disablePadding dense>
                {batchPreviews.map((entry, index) => (
                  <ListItem
                    key={`${entry.file.name}-${index}`}
                    divider={index < batchPreviews.length - 1}
                    className="px-3 py-2"
                  >
                    <ListItemAvatar>
                      {entry.valid && entry.previewUrl ? (
                        <Avatar
                          variant="rounded"
                          src={entry.previewUrl}
                          alt={entry.frontText}
                          sx={{ width: 40, height: 40 }}
                        />
                      ) : (
                        <Avatar
                          variant="rounded"
                          sx={{ width: 40, height: 40, bgcolor: 'grey.200' }}
                        >
                          <ImageIcon color="disabled" fontSize="small" />
                        </Avatar>
                      )}
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" className="font-kai">
                          {entry.frontText || entry.file.name}
                        </Typography>
                      }
                      secondary={
                        entry.valid
                          ? `${(entry.file.size / 1024).toFixed(1)} KB`
                          : entry.error
                      }
                      secondaryTypographyProps={{
                        color: entry.valid ? 'text.secondary' : 'error',
                      }}
                    />
                    {!entry.valid && (
                      <Chip
                        label="跳过"
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            </MuiCard>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseBatchDialog}
            color="inherit"
            disabled={batchImporting}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirmBatchImport}
            variant="contained"
            disabled={
              batchImporting ||
              batchPreviews.filter((e) => e.valid).length === 0
            }
          >
            {batchImporting
              ? `导入中...`
              : `确认导入（${batchPreviews.filter((e) => e.valid).length} 张卡片）`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CardManagePage;
