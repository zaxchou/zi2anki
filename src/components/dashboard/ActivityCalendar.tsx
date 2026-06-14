import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';

export interface ActivityDay {
  date: string;
  cards_studied: number;
  new_cards_learned: number;
}

export interface ActivityCalendarProps {
  data: ActivityDay[];
  weeks?: number;
}

const DAY_LABELS = ['一', '', '三', '', '五', '', '日'];

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

function getColor(level: number, dark: boolean): string {
  if (dark) return ['#2d2d2d', '#1e4a3a', '#2d6e4f', '#3d9163', '#5bbf8a'][level];
  return ['#ebedf0', '#c6e4d8', '#8fcfa9', '#5bbf8a', '#3d9163'][level];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ data, weeks = 13 }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  const { grid, monthLabels } = useMemo(() => {
    const dataMap = new Map<string, ActivityDay>();
    for (const d of data) dataMap.set(d.date, d);

    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + ((13 - end.getDay()) % 7));
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks - 1) * 7 - 6);

    // 月份标签：记录每列对应的月份
    const ml: { col: number; month: number }[] = [];
    let lastMonth = -1;

    const cells: { date: string; count: number; newCount: number; level: number; isToday: boolean }[][] = [];
    let cur = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col: typeof cells[number] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = formatDate(cur);
        const item = dataMap.get(dateStr);
        const count = item?.cards_studied ?? 0;
        col.push({ date: dateStr, count, newCount: item?.new_cards_learned ?? 0, level: getLevel(count), isToday: dateStr === formatDate(today) });

        if (d === 0 && cur.getMonth() !== lastMonth) {
          ml.push({ col: w, month: cur.getMonth() });
          lastMonth = cur.getMonth();
        }
        cur = new Date(cur);
        cur.setDate(cur.getDate() + 1);
      }
      cells.push(col);
    }
    return { grid: cells, monthLabels: ml };
  }, [data, weeks]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* 月份标签行 */}
      <Box sx={{ display: 'flex', ml: '28px', mb: '4px', position: 'relative', height: '14px' }}>
        {monthLabels.map((m) => (
          <Typography
            key={m.col}
            variant="caption"
            sx={{ position: 'absolute', left: `calc(${m.col} * (100% / ${weeks}))`, fontSize: '10px', color: 'text.secondary' }}
          >
            {MONTHS[m.month]}月
          </Typography>
        ))}
      </Box>

      {/* 热力图主体 */}
      <Box sx={{ display: 'flex' }}>
        {/* 星期标签 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', mr: '4px', pt: '2px', pb: 0, width: '24px' }}>
          {DAY_LABELS.map((label, i) => (
            <Box key={i} sx={{ height: '14px', fontSize: '10px', color: 'text.secondary', lineHeight: '14px', textAlign: 'center' }}>
              {label}
            </Box>
          ))}
        </Box>

        {/* 网格 */}
        <Box sx={{ display: 'flex', gap: '3px', flex: 1 }}>
          {grid.map((col, wIdx) => (
            <Box key={wIdx} sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
              {col.map((cell, dIdx) => (
                <Tooltip
                  key={dIdx}
                  title={<Box sx={{ fontSize: '12px' }}><div>{cell.date}</div><div>复习 {cell.count} 张</div><div>新学 {cell.newCount} 张</div></Box>}
                  arrow
                >
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '3px',
                      bgcolor: getColor(cell.level, dark),
                      outline: cell.isToday ? '2px solid' : 'none',
                      outlineColor: 'primary.main',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                      '&:hover': { transform: 'scale(1.3)', zIndex: 1 },
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
        <Typography variant="caption" sx={{ fontSize: '10px', color: 'text.secondary' }}>少</Typography>
        {[0, 1, 2, 3, 4].map((lv) => (
          <Box key={lv} sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: getColor(lv, dark) }} />
        ))}
        <Typography variant="caption" sx={{ fontSize: '10px', color: 'text.secondary' }}>多</Typography>
      </Box>
    </Box>
  );
};

export default ActivityCalendar;
