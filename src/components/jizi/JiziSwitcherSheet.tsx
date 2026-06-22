import React, { useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getImageUrl } from '@/lib/api';
import type { JiziMatchResult } from '@/types/jizi';

export interface JiziSwitcherSheetProps {
  open: boolean;
  result: JiziMatchResult | null;
  selectedIndex: number;
  onPick: (index: number) => void;
  onClose: () => void;
}

/** 按 style 分组，每组内按 calligrapher 聚合 */
function groupHits(hits: JiziMatchResult['hits']) {
  const groups: { style: string; items: { calligrapher: string; deck_name: string; indices: number[] }[] }[] = [];
  const styleMap = new Map<string, Map<string, number[]>>();

  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const style = h.style || '未分类';
    if (!styleMap.has(style)) styleMap.set(style, new Map());
    const calligMap = styleMap.get(style)!;
    const key = h.calligrapher || '佚名';
    if (!calligMap.has(key)) calligMap.set(key, []);
    calligMap.get(key)!.push(i);
  }

  for (const [style, calligMap] of styleMap) {
    const items: { calligrapher: string; deck_name: string; indices: number[] }[] = [];
    for (const [calligrapher, indices] of calligMap) {
      // 取第一个 hit 的 deck_name 作为代表
      const deck_name = hits[indices[0]].deck_name;
      items.push({ calligrapher, deck_name, indices });
    }
    groups.push({ style, items });
  }

  return groups;
}

/** 底部 Sheet 变体选择器 —— 左列作者 / 右列按字体分类展示候选字 */
const JiziSwitcherSheet: React.FC<JiziSwitcherSheetProps> = ({
  open,
  result,
  selectedIndex,
  onPick,
  onClose,
}) => {
  const hits = result?.hits ?? [];
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const groups = useMemo(() => groupHits(hits), [hits]);

  // 所有不重复的作者（左列）
  const allCalligraphers = useMemo(() => {
    const set = new Set<string>();
    hits.forEach((h) => set.add(h.calligrapher || '佚名'));
    return Array.from(set);
  }, [hits]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: isMobile ? '75vh' : '65vh',
          height: isMobile ? '75vh' : '65vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        },
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 600, fontSize: 16 }}>
          {result ? `「${result.char}」的 ${hits.length} 种写法` : '加载中...'}
        </Typography>
        <IconButton onClick={onClose} size="small" edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 主体：左列作者 + 右列候选字 */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左列：作者列表 */}
        <Box
          sx={{
            width: isMobile ? 72 : 90,
            flexShrink: 0,
            overflowY: 'auto',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
            py: 1,
          }}
        >
          {allCalligraphers.map((name) => (
            <Box
              key={name}
              sx={{
                px: 1,
                py: 0.75,
                fontSize: 12,
                color: 'text.secondary',
                borderBottom: 1,
                borderColor: 'divider',
                lineHeight: 1.3,
                wordBreak: 'break-all',
              }}
            >
              {name}
            </Box>
          ))}
        </Box>

        {/* 右列：按字体分组展示 */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 1.5,
            py: 1,
          }}
        >
          {groups.map((group) => (
            <Box key={group.style} sx={{ mb: 2 }}>
              {/* 字体分类标题 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1,
                  position: 'sticky',
                  top: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                  py: 0.5,
                }}
              >
                <Chip
                  label={group.style}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: 11, height: 22, fontWeight: 600 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {group.items.length} 位书家 · {group.items.reduce((s, it) => s + it.indices.length, 0)} 字
                </Typography>
              </Box>

              {/* 每位书家的字 */}
              {group.items.map((item) => (
                <Box key={item.calligrapher} sx={{ mb: 1.5 }}>
                  {/* 书家名 */}
                  <Typography
                    variant="caption"
                    sx={{ fontSize: 11, fontWeight: 500, color: 'text.secondary', display: 'block', mb: 0.5 }}
                  >
                    {item.calligrapher} · {item.deck_name}
                  </Typography>

                  {/* 候选字网格：一行 3 个 */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 1,
                    }}
                  >
                    {item.indices.map((i) => {
                      const hit = hits[i];
                      const isSelected = i === selectedIndex;
                      return (
                        <Box
                          key={hit.card_id}
                          onClick={() => onPick(i)}
                          sx={{
                            cursor: 'pointer',
                            border: isSelected ? 2 : 1,
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            borderRadius: 1.5,
                            p: 0.75,
                            bgcolor: isSelected ? 'action.selected' : 'background.paper',
                            transition: 'all 0.12s',
                            '&:hover': { borderColor: 'primary.light' },
                          }}
                        >
                          <Box
                            component="img"
                            src={getImageUrl(hit.image_url)}
                            alt={hit.front_text_raw}
                            sx={{
                              width: '100%',
                              aspectRatio: '1',
                              objectFit: 'contain',
                              bgcolor: '#fafafa',
                              borderRadius: 1,
                            }}
                            draggable={false}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          ))}

          {groups.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
              暂无匹配
            </Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default JiziSwitcherSheet;
