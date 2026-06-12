import React, { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

/** 路由路径 → 页面标题映射 */
const ROUTE_TITLE_MAP: Record<string, string> = {
  '/': 'Zi2Anki',
  '/dashboard': 'Zi2Anki',
  '/decks': '牌组',
  '/analytics': '数据分析',
  '/settings': '设置',
  '/study': '学习',
};

/**
 * 应用外壳布局组件。
 * 组合 TopBar + 内容区域（Outlet）+ BottomNav。
 * 页面标题根据当前路由自动映射。
 */
const AppShell: React.FC = () => {
  const location = useLocation();

  /** 根据当前路径自动匹配页面标题 */
  const title = useMemo((): string => {
    const pathname = location.pathname;

    // 精确匹配
    if (ROUTE_TITLE_MAP[pathname]) {
      return ROUTE_TITLE_MAP[pathname];
    }

    // 前缀匹配（例如 /study/:deckId）
    for (const [route, label] of Object.entries(ROUTE_TITLE_MAP)) {
      if (route !== '/' && pathname.startsWith(route)) {
        return label;
      }
    }

    // 兜底
    return '书法记忆';
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={title} />
      <main className="flex-1 px-4 py-3">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppShell;
