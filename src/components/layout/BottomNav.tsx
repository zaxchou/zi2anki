import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';

/** 导航项定义 */
interface NavItem {
  /** 图标组件 */
  icon: React.ReactNode;
  /** 显示标签 */
  label: string;
  /** 对应的路由路径 */
  value: string;
}

const navItems: NavItem[] = [
  {
    icon: <DashboardIcon />,
    label: 'Zi2Anki',
    value: '/dashboard',
  },
  {
    icon: <PhotoLibraryIcon />,
    label: '牌组',
    value: '/decks',
  },
  {
    icon: <BarChartIcon />,
    label: '数据',
    value: '/analytics',
  },
  {
    icon: <SettingsIcon />,
    label: '设置',
    value: '/settings',
  },
];

/**
 * 底部导航栏。
 * 使用 react-router 的 useNavigate + useLocation 同步当前路由。
 * 固定在底部（sticky），顶部有分隔线。
 */
const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (_event: React.SyntheticEvent, newValue: string): void => {
    navigate(newValue);
  };

  /** 根据当前路径匹配高亮项 */
  const currentValue = navItems.find((item) => {
    if (item.value === '/dashboard') {
      return location.pathname === '/' || location.pathname.startsWith('/dashboard');
    }
    return location.pathname.startsWith(item.value);
  })?.value ?? '/dashboard';

  return (
    <Paper
      sx={{
        position: 'sticky',
        bottom: 0,
        borderTop: 1,
        borderColor: 'divider',
      }}
      elevation={0}
    >
      <BottomNavigation value={currentValue} onChange={handleChange}>
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.value}
            label={item.label}
            value={item.value}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;
