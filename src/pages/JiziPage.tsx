import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import JiziInputPanel from '@/components/jizi/JiziInputPanel';
import JiziPreview from '@/components/jizi/JiziPreview';
import JiziSwitcherSheet from '@/components/jizi/JiziSwitcherSheet';
import JiziFullscreenPreview from '@/components/jizi/JiziFullscreenPreview';
import { fetchJiziMatch } from '@/lib/api';
import { exportJiziPNG } from '@/lib/jiziExport';
import { DEFAULT_LAYOUT } from '@/types/jizi';
import type { JiziLayout, JiziMatchResult } from '@/types/jizi';

/** 集字页面 */
const JiziPage: React.FC = () => {
  const [text, setText] = useState('');
  const [layout, setLayout] = useState<JiziLayout>(DEFAULT_LAYOUT);
  const [results, setResults] = useState<JiziMatchResult[]>([]);
  // selectedCardIds: 索引→用户主动选择的 card_id；缺失时回退到当前可见 hits[0]
  const [selectedCardIds, setSelectedCardIds] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherIndex, setSwitcherIndex] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [styleFilter, setStyleFilter] = useState('');
  const [calligrapherFilter, setCalligrapherFilter] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** debounce 匹配 */
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
        // 文字变化时清空过往选择（按 char 数组完全重置）
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

  // 前端筛选：书体 + 书家
  const filteredResults = React.useMemo(() => {
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

  // 当 results 变化时，若当前筛选值已不在可选列表中，自动清空（避免 MUI Select 警告）
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

  // 解析每个位置当前显示的 hit index（基于 filteredResults）
  // 优先使用用户主动选择的 card_id；找不到则回退到 0
  const selections = React.useMemo<number[]>(() => {
    return filteredResults.map((r, i) => {
      const cardId = selectedCardIds[i];
      if (!cardId) return 0;
      const idx = r.hits.findIndex((h) => h.card_id === cardId);
      return idx >= 0 ? idx : 0;
    });
  }, [filteredResults, selectedCardIds]);

  /** 打开选择弹窗 */
  const handleOpenPicker = useCallback((index: number) => {
    setSwitcherIndex(index);
    setSwitcherOpen(true);
  }, []);

  /** 弹窗选择 */
  const handleSwitcherPick = useCallback((hitIndex: number) => {
    setSelectedCardIds((prev) => {
      const result = filteredResults[switcherIndex];
      const card = result?.hits[hitIndex];
      if (!card) return prev;
      return { ...prev, [switcherIndex]: card.card_id };
    });
    setSwitcherOpen(false);
  }, [switcherIndex, filteredResults]);

  /** 导出 PNG */
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

  const missingCount = filteredResults.filter((r) => r.hits.length === 0).length;

  return (
    <Box className="space-y-4 py-4">
      {/* 顶部标题 + 导出 */}
      <Box className="flex items-center justify-between">
        <Box>
          <Typography variant="h5" className="font-kai" sx={{ fontWeight: 600 }}>
            集字
          </Typography>
          <Typography variant="body2" color="text.secondary">
            从字库中匹配汉字，拼成书法作品
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FullscreenIcon />}
            onClick={() => setFullscreenOpen(true)}
            disabled={!hasResults}
            sx={{ textTransform: 'none' }}
          >
            全屏预览
          </Button>
          <Button
            variant="contained"
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            onClick={handleExport}
            disabled={!hasResults || exporting}
            sx={{ textTransform: 'none' }}
          >
            {exporting ? '导出中...' : '导出 PNG'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* 主体：左输入 / 右预览 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <JiziInputPanel
            text={text}
            onTextChange={setText}
            layout={layout}
            onLayoutChange={setLayout}
            scope={scope}
            onScopeChange={setScope}
            results={results}
            styleFilter={styleFilter}
            onStyleFilterChange={setStyleFilter}
            calligrapherFilter={calligrapherFilter}
            onCalligrapherFilterChange={setCalligrapherFilter}
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <Box sx={{ position: 'relative' }}>
            {loading && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                }}
              >
                <CircularProgress size={20} />
              </Box>
            )}
            <JiziPreview
              results={filteredResults}
              selections={selections}
              layout={layout}
              onOpenPicker={handleOpenPicker}
              text={text}
            />
          </Box>

          {/* 缺字提示 */}
          {hasResults && missingCount > 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }} icon={false}>
              {missingCount} 个字在当前筛选中无匹配
            </Alert>
          )}

          {/* 统计 */}
          {hasResults && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              共 {results.length} 字 · {filteredResults.filter((r) => r.hits.length > 0).length} 字有匹配
              · 点击文字可切换写法
            </Typography>
          )}
        </Grid>
      </Grid>

      {/* 切换弹窗 */}
      <JiziSwitcherSheet
        open={switcherOpen}
        result={switcherIndex >= 0 ? filteredResults[switcherIndex] : null}
        selectedIndex={switcherIndex >= 0 ? selections[switcherIndex] ?? 0 : 0}
        onPick={handleSwitcherPick}
        onClose={() => setSwitcherOpen(false)}
      />

      {/* 全屏预览 */}
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
    </Box>
  );
};

export default JiziPage;
