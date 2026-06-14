import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';

/** 导航项定义 */
export interface NavItem {
  /** 图标组件 */
  icon: React.ReactNode;
  /** 显示标签 */
  label: string;
  /** 对应的路由路径 */
  value: string;
}

const navItems: NavItem[] = [
  { icon: <DashboardIcon />, label: '仪表盘', value: '/dashboard' },
  { icon: <PhotoLibraryIcon />, label: '牌组', value: '/decks' },
  { icon: <BarChartIcon />, label: '统计', value: '/analytics' },
  { icon: <SettingsIcon />, label: '设置', value: '/settings' },
];

export interface SideMenuProps {
  width?: number;
  children?: React.ReactNode;
}

const SideMenu: React.FC<SideMenuProps> = ({ width = 280, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isPc = useMediaQuery(theme.breakpoints.up('md'));

  if (!isPc) return null;

  /** 根据当前路径匹配高亮项 */
  const currentValue = navItems.find((item) => {
    if (item.value === '/dashboard') {
      return location.pathname === '/' || location.pathname.startsWith('/dashboard');
    }
    return location.pathname.startsWith(item.value);
  })?.value ?? '/dashboard';

  const handleClick = (value: string) => () => navigate(value);

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          top: 64,
          height: 'calc(100% - 64px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 导航列表（顶部：5 项） */}
        <List sx={{ flexShrink: 0, pt: 0.5, pb: 0.5 }}>
          {navItems.map((item) => {
            const selected = currentValue === item.value;
            return (
              <ListItem key={item.value} disablePadding sx={{ py: 0.25 }}>
                <ListItemButton
                  selected={selected}
                  onClick={handleClick(item.value)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    py: 0.75,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: selected ? 'inherit' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: selected ? 600 : 500, fontSize: 14 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Divider sx={{ mx: 2, my: 0.5 }} />

        {/* 学习概览（子内容：含日历） */}
        {children ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: 1.5,
              pb: 1.5,
            }}
          >
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ px: 1, display: 'block', lineHeight: '2', fontSize: 11 }}
            >
              学习概览
            </Typography>
            {children}
          </Box>
        ) : null}

        <Box sx={{ p: 1.5, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
            Zi2Anki · v1.0
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SideMenu;
