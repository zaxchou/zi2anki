import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Alert } from '@mui/material';
import { useStudyStore } from '@/stores/useStudyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import FlashCard from '@/components/study/FlashCard';
import ProgressBar from '@/components/study/ProgressBar';
import RatingButtons from '@/components/study/RatingButtons';
import StudyComplete from '@/components/study/StudyComplete';
import { LoadingState } from '@/components/common/LoadingState';
import type { Rating } from '@/types';

/**
 * 学习页面。
 * 管理单次学习会话的完整流程：加载 → 学习 → 完成。
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
    reset,
  } = useStudyStore();
  const { dailyNewCardLimit, dailyReviewLimit } = useSettingsStore();

  /** 当前卡片是否已翻转 */
  const [flipped, setFlipped] = useState(false);

  // 初始化学习会话
  useEffect(() => {
    if (deckId) {
      startSession(deckId, dailyNewCardLimit, dailyReviewLimit);
    }

    // 组件卸载时重置状态
    return () => {
      reset();
    };
  }, [deckId, dailyNewCardLimit, dailyReviewLimit, startSession, reset]);

  /** 翻转卡片 */
  const handleFlip = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  /** 评分并翻回正面 */
  const handleRate = useCallback(
    async (rating: Rating) => {
      // 先重置翻转状态（同步），避免切到下一张卡时短暂显示背面
      setFlipped(false);
      await rateCard(rating);
    },
    [rateCard]
  );

  /** 返回 Zi2Anki */
  const handleBackToDashboard = useCallback(() => {
    reset();
    navigate('/dashboard');
  }, [navigate, reset]);

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
              onClick={() => startSession(deckId!, dailyNewCardLimit, dailyReviewLimit)}
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
      <Box className="flex flex-col items-center gap-6 py-4">
        {/* 进度条 */}
        <ProgressBar current={currentIndex + 1} total={queue.length} />

        {/* 闪卡（key 强制重挂载，避免 CSS transition 在新旧卡片间延续） */}
        <FlashCard
          key={currentCard.id}
          card={currentCard}
          flipped={flipped}
          onFlip={handleFlip}
        />

        {/* 评分按钮（仅翻转后可用） */}
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
      </Box>
    );
  }

  // 完成阶段
  if (phase === 'complete' && session) {
    return (
      <StudyComplete
        session={session}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  // 兜底加载状态
  return <LoadingState message="正在准备学习..." />;
};

export default StudyPage;
