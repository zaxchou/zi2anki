import React from 'react';
import OverviewPanel from './OverviewPanel';

/**
 * PC 端左侧栏"学习概览"：直接复用 OverviewPanel 的 sidebar 变体。
 * 历史保留仅为向后兼容；新代码请直接用 <OverviewPanel variant="sidebar" />。
 */
const SidebarStats: React.FC = () => {
  return <OverviewPanel variant="sidebar" />;
};

export default React.memo(SidebarStats);
