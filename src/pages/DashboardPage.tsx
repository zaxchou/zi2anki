import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useDeckStore } from '@/stores/useDeckStore';
import { DEFAULT_DAILY_NEW_CARD_LIMIT, DEFAULT_DAILY_REVIEW_LIMIT } from '@/lib/constants';
import { fetchDueCounts, fetchDailyStats, fetchDailyStatsRange, todayLocal, resetDeckProgress } from '@/lib/api';
import StatsBar from '@/components/dashboard/StatsBar';
import StreakBadge from '@/components/dashboard/StreakBadge';
import { LoadingState, EmptyState } from '@/components/common/LoadingState';
import ConfirmDialog from '@/components/common/ConfirmDialog';

/**
 * 根据 daily_stats 历史记录计算连续打卡天数。
 * 从昨天开始往前推，统计连续有 cards_studied > 0 的天数。
 */
function calculateStreak(
  stats: { date: string; cards_studied: number }[]
): number {
  let streak = 0;
  const checkDate = new Date();
  // 从昨天开始检查（今天还没结束）
  checkDate.setDate(checkDate.getDate() - 1);

  while (true) {
    const y = checkDate.getFullYear();
    const m = String(checkDate.getMonth() + 1).padStart(2, '0');
    const d = String(checkDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
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

  const [dueCount, setDueCount] = useState(0);
  const [newCardRemaining, setNewCardRemaining] = useState(DEFAULT_DAILY_NEW_CARD_LIMIT);
  const [streakDays, setStreakDays] = useState(0);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // 加载真实统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        const today = todayLocal();
        const d30 = new Date();
        d30.setDate(d30.getDate() - 30);
        const thirtyDaysAgo = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;

        const [dueCounts, todayStats, statsRange] = await Promise.all([
          fetchDueCounts(),
          fetchDailyStats(today),
          fetchDailyStatsRange(thirtyDaysAgo, today),
        ]);

        const rawDue = dueCounts.reduce((sum, d) => sum + d.due_count, 0);
        setDueCount(Math.min(rawDue, DEFAULT_DAILY_REVIEW_LIMIT));
        setNewCardRemaining(Math.max(0, DEFAULT_DAILY_NEW_CARD_LIMIT - (todayStats?.new_cards_learned ?? 0)));
        setStreakDays(calculateStreak(statsRange));
      } catch (err) {
        console.error('[Dashboard] 加载统计失败:', err);
      }
    };

    loadStats();
  }, [decks, DEFAULT_DAILY_NEW_CARD_LIMIT, DEFAULT_DAILY_REVIEW_LIMIT]);

  /** 确认重置进度 */
  const handleConfirmReset = useCallback(async () => {
    if (!resetTarget) return;
    setResetError(null);
    try {
      const res = await resetDeckProgress(resetTarget.id);
      console.log('[Dashboard] 重置成功:', res);
      setDueCount(0);
      setNewCardRemaining(DEFAULT_DAILY_NEW_CARD_LIMIT);
      setStreakDays(0);
      await loadDecks();
    } catch (err) {
      console.error('[Dashboard] 重置失败:', err);
      setResetError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setResetTarget(null);
    }
  }, [resetTarget, loadDecks]);

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

  return (
    <>
    <Box className="space-y-6 py-4">
      {/* 统计栏 */}
      <StatsBar
        dueCount={dueCount}
        newCardRemaining={newCardRemaining}
        streakDays={streakDays}
      />

      {/* 连续打卡徽章（仅在有打卡记录时显示） */}
      {streakDays > 0 && (
        <Box className="flex justify-center">
          <StreakBadge days={streakDays} />
        </Box>
      )}

      {/* 牌组列表 */}
      <Box>
        <Typography variant="h6" className="font-kai mb-5" sx={{ fontWeight: 600, transform: 'translateY(-16px)' }}>
          我的牌组
        </Typography>
        <Box className="space-y-3">
          {decks.map((deck) => {
            const reviewProgress = deck.card_count > 0
              ? Math.round(((deck.card_count - (deck as any)._newCount || 0)) / deck.card_count * 100)
              : 0;
            return (
              <Card
                key={deck.id}
                variant="outlined"
                className="cursor-pointer hover:shadow-md transition-shadow rounded-xl"
                sx={{ borderColor: 'divider' }}
                onClick={() => navigate(`/study/${deck.id}`)}
              >
                <CardContent className="flex items-center gap-4 !pb-2">
                  <Box
                    className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
                    sx={{ bgcolor: 'primary.main', color: '#fff' }}
                  >
                    <AutoStoriesIcon />
                  </Box>
                  <Box className="flex-1 min-w-0">
                    <Box className="flex items-center justify-between mb-1">
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {deck.name}
                      </Typography>
                      <Box className="flex items-center gap-2 shrink-0 ml-2">
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>
                          {deck.card_count} 张
                        </Typography>
                        <Chip
                          label={deck.card_count > 0 ? (reviewProgress > 0 ? `${reviewProgress}%` : '新牌组') : '空'}
                          size="small"
                          sx={{
                            fontSize: 11,
                            height: 22,
                            bgcolor: reviewProgress > 0 ? 'primary.main' : 'grey.200',
                            color: reviewProgress > 0 ? '#fff' : 'text.secondary',
                          }}
                        />
                      </Box>
                    </Box>
                    {deck.card_count > 0 && (
                      <LinearProgress
                        variant="determinate"
                        value={reviewProgress}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'action.hover',
                          '& .MuiLinearProgress-bar': { borderRadius: 3 },
                        }}
                      />
                    )}
                  </Box>
                </CardContent>
                <Box className="px-4 pt-0 pb-1 flex items-center gap-2">
                  <Typography variant="caption" color="text.secondary">
                    新卡 {deck.daily_new_card_limit ?? 20} · 复习 {deck.daily_review_limit ?? 200}
                  </Typography>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); /* 跳转到卡片管理页编辑 */ navigate(`/decks/${deck.id}/cards`); }}>
                    <EditIcon fontSize="inherit" />
                  </IconButton>
                </Box>
                <CardActions className="justify-end px-4 pt-1 pb-3 gap-1">
                  <Button
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={(e) => { e.stopPropagation(); navigate(`/decks/${deck.id}/cards`); }}
                  >
                    管理
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<RestartAltIcon />}
                    onClick={(e) => { e.stopPropagation(); setResetTarget({ id: deck.id, name: deck.name }); }}
                    disabled={deck.card_count === 0}
                  >
                    重置
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      </Box>
    </Box>

    {/* 重置进度确认对话框 */}
    <ConfirmDialog
      open={!!resetTarget}
      title="重置学习进度"
      message={resetError || `确定要重置「${resetTarget?.name ?? ''}」的所有学习进度吗？所有卡片将恢复到未学习状态，此操作不可撤销。`}
      onConfirm={handleConfirmReset}
      onCancel={() => { setResetTarget(null); setResetError(null); }}
    />
    </>
  );
};

export default DashboardPage;
