import { useEffect, useState } from 'react';
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

const STATUS_COLORS = ['#1565c0', '#ed6c02', '#2e7d32', '#8bc34a'];
const DIFFICULTY_COLORS = ['#d32f2f', '#ed6c02', '#2e7d32', '#9e9e9e'];
const RATING_COLORS = ['#d32f2f', '#ed6c02', '#2e7d32', '#1565c0'];

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
 * 数据分析页面。
 * 参考 Anki 统计面板，展示卡片状态、难度分布、评分分布、复习趋势。
 */
const AnalyticsPage: React.FC = () => {
  const { decks, loadDecks } = useDeckStore();
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

  // 页面挂载时加载牌组
  useEffect(() => {
    const init = async () => {
      await loadDecks();
      setReady(true);
    };
    init();
  }, [loadDecks]);

  // 牌组加载完成后，自动选择有数据的牌组
  // 优先级：上次使用的 > card_count 最多的 > 第一个
  useEffect(() => {
    if (decks.length === 0) return;
    if (selectedDeck && decks.some((d) => d.id === selectedDeck)) return;

    // 优先选卡片数最多的（有数据的），相同时选创建最早的
    const best = decks
      .filter((d) => d.card_count > 0)
      .sort((a, b) => b.card_count - a.card_count)[0] || decks[0];

    setSelectedDeck(best.id);
    localStorage.setItem('analytics-last-deck', best.id);
  }, [decks, selectedDeck]);

  // 切换牌组时持久化
  const handleDeckChange = (id: string) => {
    setSelectedDeck(id);
    localStorage.setItem('analytics-last-deck', id);
  };

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
                      label={({ name, value }) => `${name} ${value}`}
                    >
                      {pieData(cardStatus, STATUS_LABELS).map((_, i) => (
                        <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Box className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData(cardStatus, STATUS_LABELS).map((d, i) => (
                    <Box key={d.name} className="flex items-center gap-1 text-sm">
                      <Box className="w-3 h-3 rounded-full" sx={{ bgcolor: STATUS_COLORS[i] }} />
                      <span>{d.name}: {d.value}</span>
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
                      label={({ name, value }) => `${name} ${value}`}
                    >
                      {pieData(difficulty, DIFFICULTY_LABELS).map((_, i) => (
                        <Cell key={i} fill={DIFFICULTY_COLORS[i % DIFFICULTY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Box className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData(difficulty, DIFFICULTY_LABELS).map((d, i) => (
                    <Box key={d.name} className="flex items-center gap-1 text-sm">
                      <Box className="w-3 h-3 rounded-full" sx={{ bgcolor: DIFFICULTY_COLORS[i] }} />
                      <span>{d.name}: {d.value}</span>
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
                          label={({ name, value }) => `${name} ${value}`}
                        >
                          {pieData(
                            { again: ratings.again, hard: ratings.hard, good: ratings.good, easy: ratings.easy },
                            RATING_LABELS
                          ).map((_, i) => (
                            <Cell key={i} fill={RATING_COLORS[i % RATING_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(5)}
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cards_studied" name="复习数" fill="#5c4033" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="new_cards_learned" name="新卡数" fill="#a1887f" radius={[4, 4, 0, 0]} />
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
