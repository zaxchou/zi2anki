import React from 'react';
import { Box } from '@mui/material';
import JiziCell from './JiziCell';
import type { JiziMatchResult, JiziLayout } from '@/types/jizi';

export interface JiziPreviewProps {
  results: JiziMatchResult[];
  selections: number[];
  layout: JiziLayout;
  onOpenPicker: (index: number) => void;
}

/** 预览区 —— 按方向+列字数渲染网格 */
const JiziPreview: React.FC<JiziPreviewProps> = ({
  results,
  selections,
  layout,
  onOpenPicker,
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

  // 分组：竖排每 colCount 字一列，横排每 colCount 字一行
  const groups: JiziMatchResult[][] = [];
  for (let i = 0; i < results.length; i += colCount) {
    groups.push(results.slice(i, i + colCount));
  }

  const isVertical = direction.startsWith('vertical');
  // 列/行是否需要反转（竖排RL：列从右到左；横排RL：行从下到上）
  const needsReversed = direction.endsWith('rl');
  const orderedGroups = needsReversed ? [...groups].reverse() : groups;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        bgcolor: background === 'xuan' ? '#f5ecd9' : '#ffffff',
        borderRadius: 1,
        p: 2,
        overflow: 'auto',
        minHeight: 300,
        // 宣纸纹理
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
