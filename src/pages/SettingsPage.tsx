import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Card,
  Divider,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { useSettingsStore } from '@/stores/useSettingsStore';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { fetchDecks, exportDeck, exportAllDecks, importApkgFile } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import LogoutIcon from '@mui/icons-material/Logout';
import type { Deck } from '@/types';

const SettingsPage: React.FC = () => {
  const { darkMode, setDarkMode, resetToDefaults } = useSettingsStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // APKG 导出
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');

  // APKG 导入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // 通知
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // 加载牌组列表
  useEffect(() => {
    fetchDecks()
      .then(setDecks)
      .catch(() => setSnackbar({ open: true, message: '加载牌组列表失败', severity: 'error' }));
  }, []);

  const handleDarkModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: 'system' | 'light' | 'dark' | null) => {
      if (newMode !== null) setDarkMode(newMode);
    },
    [setDarkMode]
  );

  const handleConfirmReset = useCallback(() => {
    resetToDefaults();
    setResetDialogOpen(false);
  }, [resetToDefaults]);

  // 导出
  const handleExport = () => {
    if (selectedDeckId === 'all') {
      exportAllDecks();
    } else {
      const deck = decks.find((d) => d.id === selectedDeckId);
      exportDeck(selectedDeckId, deck?.name || 'deck');
    }
    setSnackbar({ open: true, message: '正在导出…', severity: 'info' });
  };

  // 导入
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 校验扩展名
    if (!file.name.endsWith('.apkg')) {
      setSnackbar({ open: true, message: '请选择 .apkg 文件', severity: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const result = await importApkgFile(file);
      if (result.success) {
        const totalCards = result.decks.reduce((s, d) => s + d.card_count, 0);
        const deckNames = result.decks.map((d) => d.name).join('、');
        const errors = result.errors.length > 0
          ? `（${result.errors.length} 个警告）`
          : '';
        setSnackbar({
          open: true,
          message: `导入成功！${totalCards} 张卡片 → ${deckNames} ${errors}`,
          severity: result.errors.length > 0 ? 'info' : 'success',
        });
        // 重新加载牌组列表
        fetchDecks().then(setDecks).catch(() => {});
      } else {
        const errMsg = result.errors.map((e) => e.message).join('; ');
        setSnackbar({ open: true, message: `导入失败：${errMsg}`, severity: 'error' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: `导入出错：${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Box className="space-y-4 py-4">
      <Typography variant="h5" className="font-kai">设置</Typography>

      {/* 账号管理 */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <List disablePadding>
          <ListItem className="py-4">
            <ListItemText
              primary="账号信息"
              secondary={user?.username ? `用户名：${user.username}${user.role === 'admin' ? '（管理员）' : ''}` : ''}
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
            />
            <ListItemSecondaryAction>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={() => { logout(); navigate('/login'); }}
              >
                退出登录
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Card>

      {/* 外观设置 */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <List disablePadding>
          <ListItem className="py-4">
            <ListItemText
              primary="深色模式"
              secondary="切换界面的颜色主题"
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
            />
            <ListItemSecondaryAction>
              <ToggleButtonGroup
                value={darkMode}
                exclusive
                onChange={handleDarkModeChange}
                size="small"
              >
                <ToggleButton value="system">跟随系统</ToggleButton>
                <ToggleButton value="light">浅色</ToggleButton>
                <ToggleButton value="dark">深色</ToggleButton>
              </ToggleButtonGroup>
            </ListItemSecondaryAction>
          </ListItem>

          <Divider component="li" />

          <ListItem className="py-4">
            <ListItemText
              primary="恢复默认设置"
              secondary="重置应用偏好为默认值"
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
            />
            <ListItemSecondaryAction>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RestartAltIcon />}
                onClick={() => setResetDialogOpen(true)}
              >
                重置
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Card>

      {/* APKG 导入/导出 */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <List disablePadding>
          <ListItem className="py-4 flex-col items-start gap-2">
            <ListItemText
              primary="导出牌组"
              secondary="将牌组导出为 .apkg 格式，可在 Anki 桌面版中导入"
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
              sx={{ width: '100%' }}
            />
            <Box className="flex items-center gap-2 self-stretch justify-end">
              <Select
                size="small"
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="all">全部牌组</MenuItem>
                {decks.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                ))}
              </Select>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
              >
                导出
              </Button>
            </Box>
          </ListItem>

          <Divider component="li" />

          <ListItem className="py-4 flex-col items-start gap-2">
            <ListItemText
              primary="导入牌组"
              secondary="从 .apkg 文件导入卡片，同名牌组合并"
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
              sx={{ width: '100%' }}
            />
            <Box className="self-stretch flex justify-end">
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg"
                hidden
                onChange={handleFileChange}
              />
              <Button
                variant="outlined"
                disabled={importing}
                startIcon={importing ? <CircularProgress size={18} /> : <UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? '导入中…' : '选择文件'}
              </Button>
            </Box>
          </ListItem>
        </List>
      </Card>

      <Typography variant="body2" color="text.secondary" className="text-center">
        新卡和复习上限请在「牌组管理」中为每个牌组单独设置
      </Typography>

      <ConfirmDialog
        open={resetDialogOpen}
        title="恢复默认设置"
        message="确定要将所有设置恢复为默认值吗？"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetDialogOpen(false)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsPage;
