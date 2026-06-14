import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useStudyStore } from '@/stores/useStudyStore';
import { fetchDecks } from '@/lib/api';
import FlashCard from '@/components/study/FlashCard';
import ProgressBar from '@/components/study/ProgressBar';
import RatingButtons from '@/components/study/RatingButtons';
import StudyComplete from '@/components/study/StudyComplete';
import { LoadingState } from '@/components/common/LoadingState';
import type { Rating } from '@/types';

/**
 * 学习页面。
 * 管理单次学习会话的完整流程：加载 → 学习 → 完成。
 * 顶部"返回"按钮支持中断当前会话，已评分的卡会保留进度。
 */
const StudyPage: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const {
    phase,
    queue,
    currentIndex,
    session,
    loading,
    error,
    startSession,
    rateCard,
    endSession,
    reset,
  } = useStudyStore();

  const [flipped, setFlipped] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  // 加载牌组信息 → 获取牌组专属上限 → 启动学习
  useEffect(() => {
    if (!deckId) return;
    const init = async () => {
      const decks = await fetchDecks();
      const deck = decks.find((d) => d.id === deckId);
      startSession(
        deckId,
        deck?.daily_new_card_limit,
        deck?.daily_review_limit
      );
    };
    init();

    return () => { reset(); };
  }, [deckId, startSession, reset]);

  /** 翻转卡片 */
  const handleFlip = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  /** 评分并翻回正面 */
  const handleRate = useCallback(
    async (rating: Rating) => {
      setFlipped(false);
      await rateCard(rating);
    },
    [rateCard]
  );

  /** 用户点"返回" → 弹确认对话框 */
  const handleRequestExit = useCallback(() => {
    // 学习中且已学至少 1 张 → 弹确认；否则直接退出
    if (phase === 'studying' && (session?.cards_studied ?? 0) > 0) {
      setConfirmExit(true);
    } else {
      handleConfirmExit();
    }
  }, [phase, session?.cards_studied]);

  /** 确认退出：先结束会话（保留已评分的卡） → 跳回仪表盘 */
  const handleConfirmExit = useCallback(async () => {
    setConfirmExit(false);
    if (phase === 'studying') {
      await endSession().catch(() => {/* 静默失败 */});
    }
    navigate('/dashboard');
  }, [phase, endSession, navigate]);

  // 加载状态
  if (phase === 'loading' || loading) {
    return <LoadingState message="正在准备学习..." />;
  }

  // 错误状态
  if (error) {
    return (
      <Box className="py-4">
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
        <Alert
          severity="info"
          action={
            <Box
              component="button"
              onClick={() => startSession(deckId!)}
              className="cursor-pointer bg-transparent border-0 underline text-blue-600"
            >
              重试
            </Box>
          }
        >
          加载学习内容失败
        </Alert>
      </Box>
    );
  }

  // 学习阶段
  if (phase === 'studying' && queue.length > 0 && currentIndex < queue.length) {
    const currentCard = queue[currentIndex];
    return (
      <Box className="flex flex-col items-center gap-6 py-4 relative">
        {/* 顶部返回按钮：整个区域可点击 */}
        <Stack
          direction="row"
          alignItems="center"
          sx={{ position: 'absolute', left: 0, top: 0 }}
        >
          <Button
            onClick={handleRequestExit}
            size="small"
            startIcon={<ArrowBackIcon />}
            sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500 }}
          >
            返回
          </Button>
        </Stack>

        {/* 进度条 */}
        <Box sx={{ mt: 4, width: '100%' }}>
          <ProgressBar current={currentIndex + 1} total={queue.length} />
        </Box>

        {/* 闪卡 */}
        <FlashCard
          key={currentCard.id}
          card={currentCard}
          flipped={flipped}
          onFlip={handleFlip}
        />

        {/* 评分按钮 */}
        <Box className="w-full max-w-lg mt-2">
          <RatingButtons
            onRate={handleRate}
            disabled={!flipped}
            card={currentCard ? {
              ease: currentCard.ease,
              interval: currentCard.interval,
              repetitions: currentCard.repetitions,
            } : undefined}
          />
        </Box>

        {/* 中断确认对话框 */}
        <Dialog open={confirmExit} onClose={() => setConfirmExit(false)}>
          <DialogTitle>中断当前学习？</DialogTitle>
          <DialogContent>
            <DialogContentText>
              已完成 {session?.cards_studied ?? 0} 张卡片，进度会保留。
              确认要离开吗？
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmExit(false)}>继续学习</Button>
            <Button onClick={handleConfirmExit} color="error" variant="contained">
              确认离开
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // 完成阶段
  if (phase === 'complete' && session) {
    return (
      <Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            size="small"
            color="inherit"
          >
            返回仪表盘
          </Button>
        </Stack>
        <StudyComplete
          session={session}
          onBackToDashboard={handleConfirmExit}
        />
      </Box>
    );
  }

  // 兜底加载状态
  return <LoadingState message="正在准备学习..." />;
};

export default StudyPage;
