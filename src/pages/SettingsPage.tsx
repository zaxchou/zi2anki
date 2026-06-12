import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Card,
  Divider,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useSettingsStore } from '@/stores/useSettingsStore';
import ConfirmDialog from '@/components/common/ConfirmDialog';

/**
 * 设置页面。
 * 管理每日新卡上限、深色模式（展示用）、同步状态、重置设置。
 */
const SettingsPage: React.FC = () => {
  const {
    dailyNewCardLimit,
    darkMode,
    lastSyncAt,
    setDailyNewCardLimit,
    setDarkMode,
    resetToDefaults,
  } = useSettingsStore();

  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  /** 格式化最后同步时间 */
  const formatSyncTime = useCallback((timestamp: string | null): string => {
    if (!timestamp) return '从未同步';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '时间格式错误';
    }
  }, []);

  /** 处理深色模式切换 */
  const handleDarkModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: 'system' | 'light' | 'dark' | null) => {
      if (newMode !== null) {
        setDarkMode(newMode);
      }
    },
    [setDarkMode]
  );

  /** 确认重置 */
  const handleConfirmReset = useCallback(() => {
    resetToDefaults();
    setResetDialogOpen(false);
  }, [resetToDefaults]);

  /** 取消重置 */
  const handleCancelReset = useCallback(() => {
    setResetDialogOpen(false);
  }, []);

  return (
    <Box className="space-y-4 py-4">
      <Typography variant="h5" className="font-kai">
        设置
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <List disablePadding>
          {/* 每日新卡上限 */}
          <ListItem className="flex-col items-start py-4">
            <Box className="w-full">
              <Box className="flex justify-between items-center mb-2">
                <ListItemText
                  primary="每日新卡上限"
                  secondary="控制每天最多学习多少张新卡片"
                  primaryTypographyProps={{ variant: 'subtitle1' as const }}
                />
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color="primary"
                  className="ml-4 shrink-0"
                >
                  {dailyNewCardLimit}
                </Typography>
              </Box>
              <Slider
                value={dailyNewCardLimit}
                onChange={(_e, value) => setDailyNewCardLimit(value as number)}
                min={1}
                max={200}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 20, label: '20' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                  { value: 200, label: '200' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
          </ListItem>

          <Divider component="li" />

          {/* 深色模式 */}
          <ListItem className="py-4">
            <ListItemText
              primary="深色模式"
              secondary="切换界面的颜色主题（当前为展示功能）"
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
            />
            <ListItemSecondaryAction>
              <ToggleButtonGroup
                value={darkMode}
                exclusive
                onChange={handleDarkModeChange}
                size="small"
                aria-label="深色模式设置"
              >
                <ToggleButton value="system">跟随系统</ToggleButton>
                <ToggleButton value="light">浅色</ToggleButton>
                <ToggleButton value="dark">深色</ToggleButton>
              </ToggleButtonGroup>
            </ListItemSecondaryAction>
          </ListItem>

          <Divider component="li" />

          {/* 同步时间 */}
          <ListItem className="py-4">
            <ListItemText
              primary="上次同步时间"
              secondary={formatSyncTime(lastSyncAt)}
              primaryTypographyProps={{ variant: 'subtitle1' as const }}
            />
          </ListItem>

          <Divider component="li" />

          {/* 重置设置 */}
          <ListItem className="py-4">
            <ListItemText
              primary="恢复默认设置"
              secondary="将所有设置重置为默认值"
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

      {/* 重置确认对话框 */}
      <ConfirmDialog
        open={resetDialogOpen}
        title="恢复默认设置"
        message="确定要将所有设置恢复为默认值吗？此操作不可撤销。"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />
    </Box>
  );
};

export default SettingsPage;
