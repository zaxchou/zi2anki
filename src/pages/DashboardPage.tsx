import { useEffect } from 'react';
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
import StatsBar from '@/components/dashboard/StatsBar';
import StreakBadge from '@/components/dashboard/StreakBadge';
import { LoadingState, EmptyState } from '@/components/common/LoadingState';

/**
 * 仪表盘页面。
 * 显示学习统计概览 + 牌组列表入口。
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { decks, loading, error, loadDecks } = useDeckStore();
  const { dailyNewCardLimit } = useSettingsStore();

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // 计算统计数据
  const dueCount = decks.reduce((sum, deck) => sum + deck.card_count, 0);
  const newCardRemaining = dailyNewCardLimit;
  const streakDays = 0; // 暂从 dailyStats 推算，初始为 0

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
          <Button
            variant="contained"
            onClick={() => navigate('/decks')}
          >
            前往创建
          </Button>
        }
      />
    );
  }

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
                  <Typography
                    variant="h6"
                    className="font-kai"
                    noWrap
                  >
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
