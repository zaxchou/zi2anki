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
import JiziInputPanel from '@/components/jizi/JiziInputPanel';
import JiziPreview from '@/components/jizi/JiziPreview';
import JiziSwitcherDialog from '@/components/jizi/JiziSwitcherDialog';
import { fetchJiziMatch } from '@/lib/api';
import { exportJiziPNG } from '@/lib/jiziExport';
import { DEFAULT_LAYOUT } from '@/types/jizi';
import type { JiziLayout, JiziMatchResult } from '@/types/jizi';

/** 集字页面 */
const JiziPage: React.FC = () => {
  const [text, setText] = useState('');
  const [layout, setLayout] = useState<JiziLayout>(DEFAULT_LAYOUT);
  const [results, setResults] = useState<JiziMatchResult[]>([]);
  const [selections, setSelections] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherIndex, setSwitcherIndex] = useState(-1);
  const [exporting, setExporting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** debounce 匹配 */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setSelections([]);
      return;
    }
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchJiziMatch(trimmed);
        if (cancelled) return;
        setResults(resp.results);
        setSelections(resp.results.map(() => 0));
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
  }, [text]);

  /** 打开选择弹窗 */
  const handleOpenPicker = useCallback((index: number) => {
    setSwitcherIndex(index);
    setSwitcherOpen(true);
  }, []);

  /** 弹窗选择 */
  const handleSwitcherPick = useCallback((hitIndex: number) => {
    setSelections((prev) => {
      const next = [...prev];
      next[switcherIndex] = hitIndex;
      return next;
    });
    setSwitcherOpen(false);
  }, [switcherIndex]);

  /** 导出 PNG */
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportJiziPNG(results, selections, layout);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [results, selections, layout]);

  const hasResults = results.length > 0;
  const missingCount = results.filter((r) => r.hits.length === 0).length;

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

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* 主体：左输入 / 右预览 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <JiziInputPanel
            text={text}
            onTextChange={setText}
            layout={layout}
            onLayoutChange={setLayout}
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
              results={results}
              selections={selections}
              layout={layout}
              onOpenPicker={handleOpenPicker}
            />
          </Box>

          {/* 缺字提示 */}
          {hasResults && missingCount > 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }} icon={false}>
              {missingCount} 个字在字库中未找到（显示为方框）
            </Alert>
          )}

          {/* 统计 */}
          {hasResults && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              共 {results.length} 字 · {results.filter((r) => r.hits.length > 0).length} 字有匹配
              · 点击文字可切换写法
            </Typography>
          )}
        </Grid>
      </Grid>

      {/* 切换弹窗 */}
      <JiziSwitcherDialog
        open={switcherOpen}
        result={switcherIndex >= 0 ? results[switcherIndex] : null}
        selectedIndex={switcherIndex >= 0 ? selections[switcherIndex] ?? 0 : 0}
        onPick={handleSwitcherPick}
        onClose={() => setSwitcherOpen(false)}
      />
    </Box>
  );
};

export default JiziPage;
