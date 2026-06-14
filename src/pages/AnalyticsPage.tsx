import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { useDeckStore } from '@/stores/useDeckStore';
import {
  fetchCardStatus, fetchDifficulty, fetchRatingsSummary, fetchDailyTrend,
  type CardStatus, type Difficulty, type RatingsSummary, type DailyTrendPoint,
} from '@/lib/api';

/** 浅色主题配色 */
const LIGHT = {
  status: ['#1565c0', '#ed6c02', '#2e7d32', '#8bc34a'],
  difficulty: ['#d32f2f', '#ed6c02', '#2e7d32', '#9e9e9e'],
  rating: ['#d32f2f', '#ed6c02', '#2e7d32', '#1565c0'],
  bar: { reviewed: '#5c4033', newCards: '#a1887f' },
  grid: '#e0e0e0',
};

/** 暗色主题配色 */
const DARK = {
  status: ['#42a5f5', '#ffa726', '#66bb6a', '#aed581'],
  difficulty: ['#ef5350', '#ffa726', '#66bb6a', '#78909c'],
  rating: ['#ef5350', '#ffa726', '#66bb6a', '#42a5f5'],
  bar: { reviewed: '#8d6e63', newCards: '#bcaaa4' },
  grid: '#424242',
};

const STATUS_LABELS: Record<string, string> = {
  new: '新卡片', learning: '学习中', young: '复习中', mature: '已掌握',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  hard: '困难', medium: '普通', easy: '简单', unreviewed: '未复习',
};

const RATING_LABELS: Record<string, string> = {
  again: '重来', hard: '困难', good: '良好', easy: '简单',
};

/**
 * 自定义饼图标签（适配暗色/浅色主题）
 */
const PieLabel = ({ cx, cy, midAngle, innerRadius: _ir, outerRadius, name, value, fill: _f }: any) => {
  const theme = useTheme();
  const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333';
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill={textColor} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {name} {value}
    </text>
  );
};

/**
 * 自定义 Tooltip（适配暗色/浅色主题）
 */
const ChartTooltip = ({ active, payload }: any) => {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  const dark = theme.palette.mode === 'dark';
  return (
    <Box sx={{
      bgcolor: dark ? '#333' : '#fff',
      color: dark ? '#e0e0e0' : '#333',
      px: 1.5, py: 0.75,
      borderRadius: 1.5,
      border: 1,
      borderColor: dark ? '#555' : '#ddd',
      fontSize: 13,
      boxShadow: 2,
    }}>
      {payload.map((p: any, i: number) => (
        <Box key={i}>{p.name}: {p.value}</Box>
      ))}
    </Box>
  );
};

/**
 * 数据分析页面。
 * 参考 Anki 统计面板：卡片状态、难度分布、评分分布、复习趋势。
 * 所有图表配色随 MUI 主题切换（浅色/暗色）。
 */
const AnalyticsPage: React.FC = () => {
  const { decks, loadDecks } = useDeckStore();
  const navigate = useNavigate();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const COLORS = dark ? DARK : LIGHT;
  const textColor = dark ? '#e0e0e0' : '#333';

  const [selectedDeck, setSelectedDeck] = useState<string | null>(
    () => localStorage.getItem('analytics-last-deck')
  );
  const [cardStatus, setCardStatus] = useState<CardStatus | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [ratings, setRatings] = useState<RatingsSummary | null>(null);
  const [trend, setTrend] = useState<DailyTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /** 点击饼图扇区 → 跳转到牌组管理页并预选难度筛选 */
  const handlePieClick = useCallback(
    (labelKey: string) => {
      if (!selectedDeck) return;
      // 状态扇区映射: 新卡片→new, 学习中→new, 复习中→medium, 已掌握→easy
      // 难度扇区映射: 困难→hard, 普通→medium, 简单→easy, 未复习→new
      // 评分扇区映射: 重来→hard, 困难→hard, 良好→easy, 简单→easy
      const diffMap: Record<string, string> = {
        '新卡片': 'new', '学习中': 'new', '复习中': 'medium', '已掌握': 'easy',
        '困难': 'hard', '普通': 'medium', '简单': 'easy', '未复习': 'new',
        '重来': 'hard', '良好': 'easy',
      };
      const diff = diffMap[labelKey] || '';
      navigate(`/decks/${selectedDeck}/cards${diff ? `?difficulty=${diff}` : ''}`);
    },
    [selectedDeck, navigate]
  );

  // 页面挂载时加载牌组
  useEffect(() => {
    const init = async () => {
      await loadDecks();
      setReady(true);
    };
    init();
  }, [loadDecks]);

  const handleDeckChange = (deckId: string) => {
    setSelectedDeck(deckId);
    localStorage.setItem('analytics-last-deck', deckId);
  };

  // 加载统计数据
  useEffect(() => {
    if (!selectedDeck) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [status, diff, rats, trendData] = await Promise.all([
          fetchCardStatus(selectedDeck),
          fetchDifficulty(selectedDeck),
          fetchRatingsSummary(selectedDeck),
          fetchDailyTrend(14),
        ]);
        setCardStatus(status);
        setDifficulty(diff);
        setRatings(rats);
        setTrend(trendData);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDeck]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pieData = (data: any, labels: Record<string, string>) => {
    if (!data) return [];
    return Object.entries(data as Record<string, number>)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: labels[k] || k, value: v }));
  };

  if (!ready) {
    return (
      <Box className="flex justify-center py-12">
        <CircularProgress />
      </Box>
    );
  }

  if (!decks.length) {
    return (
      <Box className="py-8 text-center">
        <Typography color="text.secondary">还没有牌组数据</Typography>
      </Box>
    );
  }

  return (
    <Box className="space-y-6 py-4">
      <Box className="flex items-center justify-between">
        <Typography variant="h5" className="font-kai">数据分析</Typography>
      </Box>

      {/* 牌组选择 */}
      <ToggleButtonGroup
        value={selectedDeck}
        exclusive
        onChange={(_, v) => v && handleDeckChange(v)}
        size="small"
        className="flex-wrap"
      >
        {decks.map((d) => (
          <ToggleButton key={d.id} value={d.id}>{d.name}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box className="flex justify-center py-12">
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* 卡片状态分布 */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" className="font-kai mb-2">卡片状态</Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData(cardStatus, STATUS_LABELS)}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90}
                      dataKey="value" nameKey="name"
                      label={<PieLabel />}
                      onClick={(data: any) => handlePieClick(data.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData(cardStatus, STATUS_LABELS).map((_, i) => (
                        <Cell key={i} fill={COLORS.status[i % COLORS.status.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <Box className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData(cardStatus, STATUS_LABELS).map((d, i) => (
                    <Box key={d.name} className="flex items-center gap-1 text-sm">
                      <Box className="w-3 h-3 rounded-full" sx={{ bgcolor: COLORS.status[i] }} />
                      <span style={{ color: textColor }}>{d.name}: {d.value}</span>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 难度分布 */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" className="font-kai mb-2">难度分布</Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData(difficulty, DIFFICULTY_LABELS)}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90}
                      dataKey="value" nameKey="name"
                      label={<PieLabel />}
                      onClick={(data: any) => handlePieClick(data.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData(difficulty, DIFFICULTY_LABELS).map((_, i) => (
                        <Cell key={i} fill={COLORS.difficulty[i % COLORS.difficulty.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <Box className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData(difficulty, DIFFICULTY_LABELS).map((d, i) => (
                    <Box key={d.name} className="flex items-center gap-1 text-sm">
                      <Box className="w-3 h-3 rounded-full" sx={{ bgcolor: COLORS.difficulty[i] }} />
                      <span style={{ color: textColor }}>{d.name}: {d.value}</span>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 评分分布 */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" className="font-kai mb-2">评分分布</Typography>
                {ratings && ratings.total > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData(
                            { again: ratings.again, hard: ratings.hard, good: ratings.good, easy: ratings.easy },
                            RATING_LABELS
                          )}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={90}
                          dataKey="value" nameKey="name"
                          label={<PieLabel />}
                          onClick={(data: any) => handlePieClick(data.name)}
                          style={{ cursor: 'pointer' }}
                        >
                          {pieData(
                            { again: ratings.again, hard: ratings.hard, good: ratings.good, easy: ratings.easy },
                            RATING_LABELS
                          ).map((_, i) => (
                            <Cell key={i} fill={COLORS.rating[i % COLORS.rating.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Typography variant="body2" color="text.secondary" className="text-center mt-1">
                      总计 {ratings.total} 次评分
                    </Typography>
                  </>
                ) : (
                  <Box className="flex items-center justify-center h-[260px]">
                    <Typography color="text.secondary">暂无评分数据</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 每日复习趋势 */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" className="font-kai mb-2">每日复习</Typography>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)}
                      fontSize={11}
                      tick={{ fill: textColor }}
                    />
                    <YAxis fontSize={11} tick={{ fill: textColor }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(value: string) => <span style={{ color: textColor }}>{value}</span>} />
                    <Bar dataKey="cards_studied" name="复习数" fill={COLORS.bar.reviewed} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="new_cards_learned" name="新卡数" fill={COLORS.bar.newCards} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AnalyticsPage;
