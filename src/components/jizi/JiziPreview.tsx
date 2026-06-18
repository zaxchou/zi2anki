import React from 'react';
import { Box } from '@mui/material';
import JiziCell from './JiziCell';
import type { JiziMatchResult, JiziLayout } from '@/types/jizi';

export interface JiziPreviewProps {
  results: JiziMatchResult[];
  selections: number[];
  layout: JiziLayout;
  onOpenPicker: (index: number) => void;
  text?: string;
}

/** 将 results 按文本换行分组（有空行时手动分行，否则按 colCount 自动分行） */
function groupResults(results: JiziMatchResult[], colCount: number, text?: string): JiziMatchResult[][] {
  // 如果有手动换行（文本中含空行），按空行分组
  if (text && /\n\s*\n/.test(text)) {
    const lines = text.split(/\n\s*\n/).filter((l) => l.trim().length > 0);
    const groups: JiziMatchResult[][] = [];
    let offset = 0;
    for (const line of lines) {
      const chars = Array.from(line).filter((c) => /\p{Script=Han}/u.test(c));
      groups.push(results.slice(offset, offset + chars.length));
      offset += chars.length;
    }
    return groups.filter((g) => g.length > 0);
  }
  // 默认按 colCount 自动分行
  const groups: JiziMatchResult[][] = [];
  for (let i = 0; i < results.length; i += colCount) {
    groups.push(results.slice(i, i + colCount));
  }
  return groups;
}

/** 预览区 —— 按方向+分行渲染网格 */
const JiziPreview: React.FC<JiziPreviewProps> = ({
  results,
  selections,
  layout,
  onOpenPicker,
  text,
}) => {
  const { direction, fontSize, colCount, charGap, lineGap, background } = layout;

  if (results.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          color: 'text.secondary',
          fontSize: 14,
        }}
      >
        输入文字后这里会显示集字预览
      </Box>
    );
  }

  const cg = Math.round(fontSize * charGap);
  const lg = Math.round(fontSize * lineGap);

  // 分组：手动分行优先，否则按 colCount 自动
  const groups = groupResults(results, colCount, text);

  const isVertical = direction.startsWith('vertical');
  // 列/行是否需要反转（竖排RL：列从右到左；横排RL：行从下到上）
  const needsReversed = direction.endsWith('rl');
  const orderedGroups = needsReversed ? [...groups].reverse() : groups;

  const bgColors: Record<string, string> = {
    xuan: '#f5ecd9',
    white: '#ffffff',
    ink: '#1a1a1a',
    vermilion: '#8b0000',
  };

  const isDark = background === 'ink' || background === 'vermilion';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        bgcolor: bgColors[background] || '#ffffff',
        borderRadius: 1,
        p: 2,
        overflow: 'auto',
        minHeight: 300,
        backgroundImage:
          background === 'xuan'
            ? 'radial-gradient(ellipse at top, rgba(255,250,240,0.3), transparent 60%)'
            : 'none',
      }}
    >
      {orderedGroups.map((group, gi) => {
        const realGi = needsReversed ? groups.length - 1 - gi : gi;
        return (
          <Box
            key={gi}
            sx={{
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              mr: isVertical ? lg : 0,
              mb: isVertical ? 0 : lg,
            }}
          >
            {group.map((result, ii) => {
              const globalIndex = realGi * colCount + ii;
              return (
                <Box
                  key={globalIndex}
                  sx={{
                    mb: isVertical ? cg : 0,
                    mr: isVertical ? 0 : cg,
                  }}
                >
                  <JiziCell
                    char={result.char}
                    hits={result.hits}
                    selectedIndex={selections[globalIndex] ?? 0}
                    fontSize={fontSize}
                    onOpenPicker={() => onOpenPicker(globalIndex)}
                    darkMode={isDark}
                  />
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

export default JiziPreview;
