import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Card,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { useDeckStore } from '@/stores/useDeckStore';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { LoadingState, EmptyState } from '@/components/common/LoadingState';

/**
 * 牌组管理页面。
 * 支持创建、重命名、删除牌组。
 */
const DecksPage: React.FC = () => {
  const navigate = useNavigate();
  const { decks, loading, error, loadDecks, createDeck, renameDeck, deleteDeck, clearError } =
    useDeckStore();

  const [newDeckName, setNewDeckName] = useState('');
  const [creating, setCreating] = useState(false);

  // 重命名对话框状态
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameNewName, setRenameNewName] = useState('');

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  /** 创建新牌组 */
  const handleCreate = useCallback(async () => {
    if (!newDeckName.trim() || creating) return;
    setCreating(true);
    await createDeck(newDeckName.trim());
    setNewDeckName('');
    setCreating(false);
  }, [newDeckName, creating, createDeck]);

  /** 按回车创建 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreate();
      }
    },
    [handleCreate]
  );

  /** 打开重命名对话框 */
  const handleOpenRename = useCallback((id: string, currentName: string) => {
    setRenameTargetId(id);
    setRenameNewName(currentName);
    setRenameDialogOpen(true);
  }, []);

  /** 确认重命名 */
  const handleConfirmRename = useCallback(async () => {
    if (renameTargetId && renameNewName.trim()) {
      await renameDeck(renameTargetId, renameNewName.trim());
    }
    setRenameDialogOpen(false);
    setRenameTargetId(null);
    setRenameNewName('');
  }, [renameTargetId, renameNewName, renameDeck]);

  /** 取消重命名 */
  const handleCancelRename = useCallback(() => {
    setRenameDialogOpen(false);
    setRenameTargetId(null);
    setRenameNewName('');
  }, []);

  /** 打开删除确认对话框 */
  const handleOpenDelete = useCallback((id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setDeleteDialogOpen(true);
  }, []);

  /** 确认删除 */
  const handleConfirmDelete = useCallback(async () => {
    if (deleteTargetId) {
      await deleteDeck(deleteTargetId);
    }
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
    setDeleteTargetName('');
  }, [deleteTargetId, deleteDeck]);

  /** 取消删除 */
  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
    setDeleteTargetName('');
  }, []);

  // 加载状态
  if (loading) {
    return <LoadingState message="正在加载牌组列表..." />;
  }

  return (
    <Box className="space-y-4 py-4">
      <Typography variant="h5" className="font-kai">
        牌组管理
      </Typography>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" onClose={() => clearError()}>
          {error}
        </Alert>
      )}

      {/* 创建牌组输入区 */}
      <Card variant="outlined" className="p-4" sx={{ borderRadius: 2 }}>
        <Box className="flex gap-2">
          <TextField
            label="新牌组名称"
            size="medium"
            fullWidth
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入牌组名称..."
            disabled={creating}
            inputProps={{ maxLength: 50 }}
          />
          <Button
            variant="contained"
            startIcon={creating ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
            onClick={handleCreate}
            disabled={!newDeckName.trim() || creating}
            className="shrink-0"
          >
            创建
          </Button>
        </Box>
      </Card>

      {/* 牌组列表或空状态 */}
      {!decks || decks.length === 0 ? (
        <EmptyState
          icon={<LibraryBooksIcon />}
          title="还没有牌组"
          description="点击上方按钮创建你的第一个书法记忆牌组"
        />
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <List disablePadding>
            {decks.map((deck, index) => (
              <ListItem
                key={deck.id}
                divider={index < decks.length - 1}
                disablePadding
                secondaryAction={
                  <Box className="flex items-center">
                    <IconButton
                      edge="end"
                      aria-label={`重命名 ${deck.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRename(deck.id, deck.name);
                      }}
                      size="small"
                      className="mr-1"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label={`删除 ${deck.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDelete(deck.id, deck.name);
                      }}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemButton
                  onClick={() => navigate(`/decks/${deck.id}/cards`)}
                  className="px-4 py-3"
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" className="font-kai">
                        {deck.name}
                      </Typography>
                    }
                    secondary={`${deck.card_count} 张卡片`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Card>
      )}

      {/* 重命名对话框 */}
      <Dialog
        open={renameDialogOpen}
        onClose={handleCancelRename}
        aria-labelledby="rename-dialog-title"
      >
        <DialogTitle id="rename-dialog-title">重命名牌组</DialogTitle>
        <DialogContent>
          <DialogContentText className="mb-3">
            请输入新的牌组名称：
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            value={renameNewName}
            onChange={(e) => setRenameNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmRename();
              else if (e.key === 'Escape') handleCancelRename();
            }}
            placeholder="牌组名称"
            inputProps={{ maxLength: 50 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRename} color="inherit">
            取消
          </Button>
          <Button
            onClick={handleConfirmRename}
            variant="contained"
            disabled={!renameNewName.trim()}
          >
            确认
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除牌组"
        message={`确定要删除「${deleteTargetName}」吗？牌组中的所有卡片将被永久删除，此操作不可撤销。`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </Box>
  );
};

export default DecksPage;
