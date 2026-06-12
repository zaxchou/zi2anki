import { useState, useCallback } from 'react';
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
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useSettingsStore } from '@/stores/useSettingsStore';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const SettingsPage: React.FC = () => {
  const { darkMode, setDarkMode, resetToDefaults } = useSettingsStore();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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

  return (
    <Box className="space-y-4 py-4">
      <Typography variant="h5" className="font-kai">设置</Typography>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
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
    </Box>
  );
};

export default SettingsPage;
