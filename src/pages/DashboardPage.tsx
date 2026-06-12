import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { useDeckStore } from '@/stores/useDeckStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { fetchDueCounts, fetchDailyStatsRange } from '@/lib/api';
import StatsBar from '@/components/dashboard/StatsBar';
import StreakBadge from '@/components/dashboard/StreakBadge';
import { LoadingState, EmptyState } from '@/components/common/LoadingState';

/**
 * 根据 daily_stats 历史记录计算连续打卡天数。
 * 从昨天开始往前推，统计连续有 cards_studied > 0 的天数。
 */
function calculateStreak(
  stats: { date: string; cards_studied: number }[]
): number {
  let streak = 0;
  let checkDate = new Date();
  // 从昨天开始检查（今天还没结束）
  checkDate.setDate(checkDate.getDate() - 1);

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    const found = stats.find((s) => s.date === dateStr);
    if (found && found.cards_studied > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 仪表盘页面。
 * 显示学习统计概览 + 牌组列表入口。
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { decks, loading, error, loadDecks } = useDeckStore();
  const { dailyNewCardLimit } = useSettingsStore();

  const [dueCount, setDueCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // 加载真实统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        // 并行加载到期计数 + 历史统计
        const today = new Date().toISOString().slice(0, 10);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
          .toISOString()
          .slice(0, 10);

        const [dueCounts, statsRange] = await Promise.all([
          fetchDueCounts(),
          fetchDailyStatsRange(thirtyDaysAgo, today),
        ]);

        setDueCount(dueCounts.reduce((sum, d) => sum + d.due_count, 0));
        setStreakDays(calculateStreak(statsRange));
      } catch (err) {
        console.error('[Dashboard] 加载统计失败:', err);
      }
    };

    loadStats();
  }, [decks]);

  // 错误状态
  if (error) {
    return (
      <Box className="py-4">
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => loadDecks()}>
          重试
        </Button>
      </Box>
    );
  }

  // 加载状态
  if (loading) {
    return <LoadingState message="正在加载仪表盘..." />;
  }

  // 空状态
  if (!decks || decks.length === 0) {
    return (
      <EmptyState
        icon={<LibraryBooksIcon />}
        title="还没有牌组"
        description="创建你的第一个书法记忆牌组，开始学习之旅吧！"
        action={
          <Button variant="contained" onClick={() => navigate('/decks')}>
            前往创建
          </Button>
        }
      />
    );
  }

  const newCardRemaining = dailyNewCardLimit;

  return (
    <Box className="space-y-6 py-4">
      {/* 统计栏 */}
      <StatsBar
        dueCount={dueCount}
        newCardRemaining={newCardRemaining}
        streakDays={streakDays}
      />

      {/* 连续打卡徽章 */}
      <Box className="flex justify-center">
        <StreakBadge days={streakDays} />
      </Box>

      {/* 牌组列表 */}
      <Box>
        <Typography variant="h5" className="font-kai mb-3">
          我的牌组
        </Typography>
        <Grid container spacing={2}>
          {decks.map((deck) => (
            <Grid item xs={12} sm={6} md={4} key={deck.id}>
              <Card
                variant="outlined"
                className="h-full flex flex-col"
                sx={{ borderRadius: 3 }}
              >
                <CardContent className="flex-1">
                  <Typography variant="h6" className="font-kai" noWrap>
                    {deck.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className="mt-1">
                    {deck.card_count} 张卡片
                  </Typography>
                </CardContent>
                <CardActions className="px-4 pb-3 flex flex-wrap gap-2">
                  <Button
                    variant="contained"
                    size="medium"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => navigate(`/study/${deck.id}`)}
                    disabled={deck.card_count === 0}
                  >
                    {deck.card_count === 0 ? '暂无卡片' : '开始学习'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="medium"
                    onClick={() => navigate(`/decks/${deck.id}/cards`)}
                  >
                    管理卡片
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default DashboardPage;
