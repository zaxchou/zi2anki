// ===== 签到日历（GitHub 风格热力图） =====

import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  cards_studied: number;
  new_cards_learned: number;
}

export interface ActivityCalendarProps {
  /** 当日及过去的活动数据 */
  data: ActivityDay[];
  /** 显示的周数，默认 13（约 3 个月） */
  weeks?: number;
}

const DAY_LABELS = ['一', '', '三', '', '五', '', '日'];
const MONTH_LABELS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** 等级 0-4 → 颜色强度 */
function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

function getColor(level: number, dark: boolean): string {
  if (dark) {
    return ['#2d2d2d', '#1e4a3a', '#2d6e4f', '#3d9163', '#5bbf8a'][level];
  }
  return ['#ebedf0', '#c6e4d8', '#8fcfa9', '#5bbf8a', '#3d9163'][level];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ data, weeks = 13 }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  /** 构建网格：weeks 列 × 7 行，每列代表一周（周一到周日） */
  const grid = useMemo(() => {
    const dataMap = new Map<string, ActivityDay>();
    for (const d of data) dataMap.set(d.date, d);

    // 找到最近一个周日作为终点
    const today = new Date();
    const end = new Date(today);
    const endDay = end.getDay(); // 0=Sun
    // 推进到本周末（周日）
    end.setDate(end.getDate() + (7 - endDay - 1 + 7) % 7);
    // 倒推 weeks 周
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks - 1) * 7 - 6);

    const cells: { date: string; count: number; newCount: number; level: number; month: number; isToday: boolean }[][] = [];

    let cur = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col: typeof cells[number] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = formatDate(cur);
        const item = dataMap.get(dateStr);
        const count = item?.cards_studied ?? 0;
        const newCount = item?.new_cards_learned ?? 0;
        col.push({
          date: dateStr,
          count,
          newCount,
          level: getLevel(count),
          month: cur.getMonth(),
          isToday: dateStr === formatDate(today),
        });
        cur = new Date(cur);
        cur.setDate(cur.getDate() + 1);
      }
      cells.push(col);
    }
    return cells;
  }, [data, weeks, theme]);

  /** 月份标签位置 */
  const monthMarkers = useMemo(() => {
    const markers: { col: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((col, idx) => {
      const firstDay = col[0];
      if (firstDay.month !== lastMonth) {
        markers.push({ col: idx, label: MONTH_LABELS[firstDay.month].slice(0, 1) });
        lastMonth = firstDay.month;
      }
    });
    return markers;
  }, [grid]);

  const cellSize = 14;
  const gap = 3;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: `${gap}px`, ml: '24px', mb: '2px', position: 'relative', height: '14px' }}>
        {monthMarkers.map((m, i) => (
          <Typography
            key={i}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${m.col * (cellSize + gap)}px`,
              fontSize: '11px',
              color: 'text.secondary',
            }}
          >
            {MONTH_LABELS[Object.values(MONTH_LABELS).findIndex((_, idx) => MONTH_LABELS[m.col === 0 ? 0 : idx] === m.label + '月')]}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex' }}>
        {/* 周次标签 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, mr: '4px', pt: '2px' }}>
          {DAY_LABELS.map((d, i) => (
            <Box key={i} sx={{ height: `${cellSize}px`, fontSize: '10px', color: 'text.secondary', lineHeight: 1 }}>
              {d}
            </Box>
          ))}
        </Box>
        {/* 热力图 */}
        <Box sx={{ display: 'flex', gap: `${gap}px` }}>
          {grid.map((col, wIdx) => (
            <Box key={wIdx} sx={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
              {col.map((cell, dIdx) => (
                <Tooltip
                  key={dIdx}
                  title={
                    <Box sx={{ fontSize: '12px' }}>
                      <div>{cell.date}</div>
                      <div>复习 {cell.count} 张</div>
                      <div>新学 {cell.newCount} 张</div>
                    </Box>
                  }
                  arrow
                >
                  <Box
                    sx={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: '3px',
                      bgcolor: getColor(cell.level, dark),
                      outline: cell.isToday ? '2px solid' : 'none',
                      outlineColor: 'primary.main',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                      '&:hover': { transform: 'scale(1.2)' },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
      {/* 图例 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mt: '8px', justifyContent: 'flex-end' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>少</Typography>
        {[0, 1, 2, 3, 4].map((lv) => (
          <Box key={lv} sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: getColor(lv, dark) }} />
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>多</Typography>
      </Box>
    </Box>
  );
};

export default ActivityCalendar;
