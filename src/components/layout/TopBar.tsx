import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';

export interface TopBarProps {
  /** 页面标题 */
  title: string;
  /** 可选：右侧操作区 */
  children?: React.ReactNode;
}

/**
 * 顶部导航栏。
 * 左侧为页面标题，右侧为可选的操作区域（通过 children 传入）。
 * 固定于顶部（sticky），底部有分隔线。
 */
const TopBar: React.FC<TopBarProps> = ({ title, children }) => {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        <Typography variant="h6" component="h1" className="font-kai" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {children && <Box>{children}</Box>}
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
