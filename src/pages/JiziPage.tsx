import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Drawer,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  IconButton,
  Fab,
  Paper,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import StyleIcon from '@mui/icons-material/Style';
import DashboardIcon from '@mui/icons-material/Dashboard';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import JiziPresetButton from '@/components/jizi/JiziPresetButton';
import JiziPreview from '@/components/jizi/JiziPreview';
import JiziSwitcherSheet from '@/components/jizi/JiziSwitcherSheet';
import JiziFullscreenPreview from '@/components/jizi/JiziFullscreenPreview';
import { fetchJiziMatch, getImageUrl } from '@/lib/api';
import { exportJiziPNG } from '@/lib/jiziExport';
import { DEFAULT_LAYOUT } from '@/types/jizi';
import type { JiziLayout, JiziMatchResult, CharHit, JiziDirection, JiziBackground } from '@/types/jizi';

type JiziTab = 'text' | 'select' | 'layout' | 'preview' | null;

/** 从匹配结果中提取去重的书体/书家列表 */
function extractFilters(results: JiziMatchResult[]): { styles: string[]; calligraphers: string[] } {
  const styleSet = new Set<string>();
  const nameSet = new Set<string>();
  results.forEach((r) => {
    r.hits.forEach((h) => {
      if (h.style) styleSet.add(h.style);
      if (h.calligrapher) nameSet.add(h.calligrapher);
    });
  });
  return {
    styles: Array.from(styleSet).sort(),
    calligraphers: Array.from(nameSet).sort(),
  };
}

/** Sheet 顶部标题栏 */
const SheetHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
    <IconButton size="small" onClick={onClose}>
      <CloseIcon fontSize="small" />
    </IconButton>
  </Box>
);

const JiziPage: React.FC = () => {
  const [text, setText] = useState('');
  const [layout, setLayout] = useState<JiziLayout>(DEFAULT_LAYOUT);
  const [results, setResults] = useState<JiziMatchResult[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherIndex, setSwitcherIndex] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [scope, setScope] = useState<'mine' | 'all'>('all');
  const [styleFilter, setStyleFilter] = useState('');
  const [calligrapherFilter, setCalligrapherFilter] = useState('');
  const [styleConfirmOpen, setStyleConfirmOpen] = useState(false);
  const [pendingStyleHit, setPendingStyleHit] = useState<CharHit | null>(null);
  const [activeTab, setActiveTab] = useState<JiziTab>(null);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setSelectedCardIds({});
      return;
    }
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchJiziMatch(trimmed, scope);
        if (cancelled) return;
        setResults(resp.results);
        setSelectedCardIds({});
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '匹配失败');
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, scope]);

  const hasResults = results.length > 0;

  const filteredResults = useMemo(() => {
    if (!styleFilter && !calligrapherFilter) return results;
    return results.map((r) => ({
      ...r,
      hits: r.hits.filter((h) => {
        if (styleFilter && h.style !== styleFilter) return false;
        if (calligrapherFilter && h.calligrapher !== calligrapherFilter) return false;
        return true;
      }),
    }));
  }, [results, styleFilter, calligrapherFilter]);

  const filters = useMemo(() => extractFilters(results), [results]);

  useEffect(() => {
    if (!results.length) return;
    const allStyles = new Set<string>();
    const allCalligraphers = new Set<string>();
    results.forEach((r) => r.hits.forEach((h) => {
      if (h.style) allStyles.add(h.style);
      if (h.calligrapher) allCalligraphers.add(h.calligrapher);
    }));
    if (styleFilter && !allStyles.has(styleFilter)) setStyleFilter('');
    if (calligrapherFilter && !allCalligraphers.has(calligrapherFilter)) setCalligrapherFilter('');
  }, [results, styleFilter, calligrapherFilter]);

  const selections = useMemo<number[]>(() => {
    return filteredResults.map((r, i) => {
      const cardId = selectedCardIds[i];
      if (!cardId) return 0;
      const idx = r.hits.findIndex((h) => h.card_id === cardId);
      return idx >= 0 ? idx : 0;
    });
  }, [filteredResults, selectedCardIds]);

  const update = (patch: Partial<JiziLayout>) => setLayout({ ...layout, ...patch });

  const handleOpenPicker = useCallback((index: number) => {
    setSwitcherIndex(index);
    setSwitcherOpen(true);
  }, []);

  const handleSwitcherPick = useCallback((hitIndex: number) => {
    setSelectedCardIds((prev) => {
      const result = filteredResults[switcherIndex];
      const card = result?.hits[hitIndex];
      if (!card) return prev;
      return { ...prev, [switcherIndex]: card.card_id };
    });
    setSwitcherOpen(false);

    if (switcherIndex === 0) {
      const card = filteredResults[0]?.hits[hitIndex];
      if (card) {
        setPendingStyleHit(card);
        setStyleConfirmOpen(true);
      }
    }
  }, [switcherIndex, filteredResults]);

  const handleStyleConfirm = useCallback(() => {
    if (!pendingStyleHit) {
      setStyleConfirmOpen(false);
      return;
    }
    const refDeck = pendingStyleHit.deck_id;
    const refCalligrapher = pendingStyleHit.calligrapher;

    setSelectedCardIds((prev) => {
      const next: Record<number, string> = { ...prev };
      filteredResults.forEach((r, i) => {
        if (i === 0) return;
        const sameDeck = r.hits.find((h) => h.deck_id === refDeck);
        if (sameDeck) {
          next[i] = sameDeck.card_id;
          return;
        }
        if (refCalligrapher) {
          const sameCalligrapher = r.hits.find((h) => h.calligrapher === refCalligrapher);
          if (sameCalligrapher) {
            next[i] = sameCalligrapher.card_id;
          }
        }
      });
      return next;
    });
    setStyleConfirmOpen(false);
    setPendingStyleHit(null);
  }, [pendingStyleHit, filteredResults]);

  const handleStyleCancel = useCallback(() => {
    setStyleConfirmOpen(false);
    setPendingStyleHit(null);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportJiziPNG(filteredResults, selections, layout, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [filteredResults, selections, layout, text]);

  const handleResetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  const closeSheet = useCallback(() => setActiveTab(null), []);

  const handleOpenPickerFromList = useCallback((index: number) => {
    closeSheet();
    setTimeout(() => handleOpenPicker(index), 200);
  }, [closeSheet, handleOpenPicker]);

  const matchedCount = filteredResults.filter((r) => r.hits.length > 0).length;

  return (
    <Box sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 20 }}>
          {error}
        </Alert>
      )}

      {/* 加载指示器 */}
      {loading && (
        <Box sx={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {/* ===== 可收缩浮动工具按钮 + 字数显示 ===== */}
      {toolsExpanded ? (
        <Box sx={{
          position: 'absolute',
          left: '50%', transform: 'translateX(-50%)',
          bottom: 44,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}>
          {hasResults && (
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(4px)',
              px: 1.25, py: 0.25,
              borderRadius: 1.5,
              fontSize: 12,
              color: 'text.secondary',
              boxShadow: 1,
              pointerEvents: 'none',
            }}>
              {matchedCount} / {results.length} 字
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Fab
              size="small"
              onClick={() => setToolsExpanded(false)}
              sx={{
                width: 36, height: 36, minHeight: 0,
                bgcolor: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(8px)',
                color: 'text.secondary',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </Fab>
            {([
              { label: '文字', value: 'text', icon: <EditIcon sx={{ fontSize: 18 }} /> },
              { label: '选择', value: 'select', icon: <StyleIcon sx={{ fontSize: 18 }} /> },
              { label: '排版', value: 'layout', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
              { label: '预览', value: 'preview', icon: <VisibilityIcon sx={{ fontSize: 18 }} /> },
            ] as const).map((btn) => (
              <Paper
                key={btn.value}
                elevation={4}
                onClick={() => setActiveTab(activeTab === btn.value ? null : btn.value)}
                sx={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  width: 48,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: activeTab === btn.value ? 'primary.main' : 'rgba(255,255,255,0.7)',
                  color: activeTab === btn.value ? '#fff' : 'text.secondary',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: activeTab === btn.value ? 'primary.dark' : 'rgba(255,255,255,0.85)' },
                }}
              >
                {btn.icon}
                <Typography sx={{ fontSize: 9, lineHeight: 1 }}>{btn.label}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      ) : (
        <Fab
          size="small"
          onClick={() => setToolsExpanded(true)}
          sx={{
            position: 'absolute',
            left: 8,
            bottom: 44,
            zIndex: 10,
            width: 36, height: 36, minHeight: 0,
            bgcolor: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' },
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 20 }} />
        </Fab>
      )}

      {/* ===== 主预览区（无边全屏） ===== */}
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <JiziPreview
          results={filteredResults}
          selections={selections}
          layout={layout}
          onOpenPicker={handleOpenPicker}
          text={text}
        />

        {!hasResults && !loading && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'text.secondary', pointerEvents: 'none',
          }}>
            <Typography variant="body2">点击底部「文字」开始集字</Typography>
          </Box>
        )}
      </Box>

      {/* ===== Sheet: 文字 ===== */}
      <Drawer
        anchor="bottom"
        open={activeTab === 'text'}
        onClose={closeSheet}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70vh' } }}
      >
        <Box sx={{ p: 2 }}>
          <SheetHeader title="编辑文字" onClose={closeSheet} />
          <Stack spacing={2}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>集字内容</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {text && (
                    <Button size="small" color="error" onClick={() => setText('')} sx={{ minWidth: 0, fontSize: 12, px: 1 }}>
                      清空
                    </Button>
                  )}
                  <JiziPresetButton onSelect={setText} />
                </Box>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入诗句，如：春江潮水连海平"
                variant="outlined"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                支持中文汉字，标点自动忽略，最多 200 字
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Drawer>

      {/* ===== Sheet: 选择 ===== */}
      <Drawer
        anchor="bottom"
        open={activeTab === 'select'}
        onClose={closeSheet}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85vh' } }}
      >
        <Box sx={{ p: 2 }}>
          <SheetHeader title="选择风格" onClose={closeSheet} />
          <Stack spacing={2.5}>
            {/* 字库范围 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>字库范围</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label="已订阅"
                  size="small"
                  variant={scope === 'mine' ? 'filled' : 'outlined'}
                  color={scope === 'mine' ? 'primary' : 'default'}
                  onClick={() => setScope('mine')}
                />
                <Chip
                  label="全部公开"
                  size="small"
                  variant={scope === 'all' ? 'filled' : 'outlined'}
                  color={scope === 'all' ? 'primary' : 'default'}
                  onClick={() => setScope('all')}
                />
              </Box>
            </Box>

            {/* 书体筛选 */}
            {filters.styles.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>书体</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    label="全部"
                    size="small"
                    variant={!styleFilter ? 'filled' : 'outlined'}
                    color={!styleFilter ? 'primary' : 'default'}
                    onClick={() => setStyleFilter('')}
                  />
                  {filters.styles.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      size="small"
                      variant={styleFilter === s ? 'filled' : 'outlined'}
                      color={styleFilter === s ? 'primary' : 'default'}
                      onClick={() => setStyleFilter(s)}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* 书家筛选 */}
            {filters.calligraphers.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>书家</InputLabel>
                <Select
                  value={calligrapherFilter || ''}
                  onChange={(e) => setCalligrapherFilter(e.target.value)}
                  label="书家"
                >
                  <MenuItem value="">全部书家</MenuItem>
                  {filters.calligraphers.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 逐字调整 */}
            {hasResults && (
              <>
                <Divider />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>逐字调整</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    点击下方任一文字，可切换写法
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {filteredResults.map((r, i) => {
                      const sel = selections[i] ?? 0;
                      const hit = r.hits[sel];
                      if (!hit) return null;
                      return (
                        <Box
                          key={i}
                          onClick={() => handleOpenPickerFromList(i)}
                          sx={{
                            position: 'relative',
                            cursor: 'pointer',
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            width: 56,
                            height: 56,
                            bgcolor: 'action.hover',
                            overflow: 'hidden',
                            '&:hover': { borderColor: 'primary.main' },
                          }}
                        >
                          <Box
                            component="img"
                            src={getImageUrl(hit.image_url)}
                            alt={r.char}
                            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            draggable={false}
                          />
                          {r.hits.length > 1 && (
                            <Typography
                              sx={{
                                position: 'absolute',
                                bottom: 1,
                                right: 2,
                                fontSize: 8,
                                color: 'text.secondary',
                                bgcolor: 'rgba(255,255,255,0.8)',
                                px: 0.3,
                                borderRadius: 0.5,
                                lineHeight: 1.2,
                              }}
                            >
                              {sel + 1}/{r.hits.length}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </>
            )}
          </Stack>
        </Box>
      </Drawer>

      {/* ===== Sheet: 排版 ===== */}
      <Drawer
        anchor="bottom"
        open={activeTab === 'layout'}
        onClose={closeSheet}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85vh' } }}
      >
        <Box sx={{ p: 2 }}>
          <SheetHeader title="排版设置" onClose={closeSheet} />
          <Stack spacing={2.5}>
            {/* 方向 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>方向</Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={layout.direction}
                onChange={(_, v: JiziDirection | null) => v && update({ direction: v })}
              >
                <ToggleButton value="vertical-rl">竖排右起</ToggleButton>
                <ToggleButton value="vertical-lr">竖排左起</ToggleButton>
                <ToggleButton value="horizontal-lr">横排左起</ToggleButton>
                <ToggleButton value="horizontal-rl">横排右起</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* 字号 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>字号</Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={layout.fontSize}
                onChange={(_, v: number | null) => v && update({ fontSize: v })}
              >
                <ToggleButton value={80}>小</ToggleButton>
                <ToggleButton value={120}>中</ToggleButton>
                <ToggleButton value={160}>大</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* 列字数 / 行字数 */}
            <FormControl size="small" fullWidth>
              <InputLabel>{layout.direction.startsWith('vertical') ? '每列字数' : '每行字数'}</InputLabel>
              <Select
                value={layout.colCount}
                label={layout.direction.startsWith('vertical') ? '每列字数' : '每行字数'}
                onChange={(e) => update({ colCount: Number(e.target.value) })}
              >
                {[4, 6, 8, 10, 12, 14, 16, 18, 20].map((n) => (
                  <MenuItem key={n} value={n}>{n} 字</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 字距 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>字距</Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  size="small"
                  min={0}
                  max={0.4}
                  step={0.02}
                  value={layout.charGap}
                  onChange={(_, v) => update({ charGap: v as number })}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                />
              </Box>
            </Box>

            {/* 行距 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>行距</Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  size="small"
                  min={0}
                  max={0.6}
                  step={0.02}
                  value={layout.lineGap}
                  onChange={(_, v) => update({ lineGap: v as number })}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                />
              </Box>
            </Box>

            {/* 紧凑模式 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>紧凑模式</Typography>
              <Button
                size="small"
                variant={layout.compact ? 'contained' : 'outlined'}
                onClick={() => update({ compact: !layout.compact })}
                sx={{ minWidth: 60, textTransform: 'none' }}
              >
                {layout.compact ? '开' : '关'}
              </Button>
            </Box>

            {/* 背景 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>背景</Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={layout.background}
                onChange={(_, v: JiziBackground | null) => v && update({ background: v })}
              >
                <ToggleButton value="xuan">宣纸</ToggleButton>
                <ToggleButton value="white">纯白</ToggleButton>
                <ToggleButton value="ink">墨色</ToggleButton>
                <ToggleButton value="vermilion">朱砂</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Button size="small" onClick={handleResetLayout} color="inherit">
              恢复默认
            </Button>
          </Stack>
        </Box>
      </Drawer>

      {/* ===== Sheet: 预览 ===== */}
      <Drawer
        anchor="bottom"
        open={activeTab === 'preview'}
        onClose={closeSheet}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
      >
        <Box sx={{ p: 2 }}>
          <SheetHeader title="预览与导出" onClose={closeSheet} />
          <Stack spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FullscreenIcon />}
              onClick={() => {
                closeSheet();
                setFullscreenOpen(true);
              }}
              disabled={!hasResults}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              全屏预览
            </Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={() => {
                closeSheet();
                handleExport();
              }}
              disabled={!hasResults || exporting}
              sx={{ textTransform: 'none', py: 1.25 }}
            >
              {exporting ? '导出中...' : '导出 PNG'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
              也可点击预览区右下角的导出按钮
            </Typography>
          </Stack>
        </Box>
      </Drawer>

      {/* ===== 弹窗：变体选择（已有的 JiziSwitcherSheet） ===== */}
      <JiziSwitcherSheet
        open={switcherOpen}
        result={switcherIndex >= 0 ? filteredResults[switcherIndex] : null}
        selectedIndex={switcherIndex >= 0 ? selections[switcherIndex] ?? 0 : 0}
        onPick={handleSwitcherPick}
        onClose={() => setSwitcherOpen(false)}
      />

      {/* ===== 弹窗：全屏预览 ===== */}
      <JiziFullscreenPreview
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        results={filteredResults}
        selections={selections}
        layout={layout}
        onOpenPicker={handleOpenPicker}
        onExport={handleExport}
        exporting={exporting}
        text={text}
      />

      {/* ===== 风格统一确认对话框 ===== */}
      <Dialog open={styleConfirmOpen} onClose={handleStyleCancel} maxWidth="xs" fullWidth>
        <DialogTitle>是否参考该字风格自动集字？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            将根据所选字的字帖
            {pendingStyleHit?.deck_name && (
              <Typography component="span" sx={{ mx: 0.5, fontWeight: 500, color: 'primary.main' }}>
                《{pendingStyleHit.deck_name}》
              </Typography>
            )}
            {pendingStyleHit?.calligrapher && (
              <>
                / 书家
                <Typography component="span" sx={{ mx: 0.5, fontWeight: 500, color: 'primary.main' }}>
                  {pendingStyleHit.calligrapher}
                </Typography>
              </>
            )}
            自动匹配后续所有字。无匹配的字保持原状。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleStyleCancel}>取消</Button>
          <Button variant="contained" onClick={handleStyleConfirm}>确认</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JiziPage;
