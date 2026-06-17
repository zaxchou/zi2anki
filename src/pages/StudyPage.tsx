import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useStudyStore } from '@/stores/useStudyStore';
import { fetchDecks, endStudySession as endStudySessionApi, getImageUrl } from '@/lib/api';
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
  const [searchParams] = useSearchParams();
  const difficultyFilter = searchParams.get('difficulty');
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
  // 学习计时（秒）：从 session.started_at 到现在的秒数
  const [elapsed, setElapsed] = useState(0);

  // 加载牌组信息 → 获取牌组专属上限 → 启动学习
  useEffect(() => {
    if (!deckId) return;
    const init = async () => {
      const decks = await fetchDecks();
      const deck = decks.find((d) => d.id === deckId);
      startSession(
        deckId,
        deck?.daily_new_card_limit,
        deck?.daily_review_limit,
        difficultyFilter || undefined
      );
    };
    init();

    return () => {
      const state = useStudyStore.getState();
      if (state.session && state.phase === 'studying') {
        state.endSession().catch(() => {});
      }
      reset();
    };
  }, [deckId, startSession, reset]);

  // 学习计时器 + 学时持久化（每10秒 + 页面关闭保底）
  useEffect(() => {
    if (phase !== 'studying' || !session?.started_at || !session?.id) {
      setElapsed(0);
      return;
    }
    const startedAt = session.started_at;
    const sid = session.id;

    const tick = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    };
    tick();
    const timerId = setInterval(tick, 1000);

    // 每10秒持久化 ended_at，页面关闭最多丢10秒
    const persistId = setInterval(async () => {
      try {
        await endStudySessionApi(sid, { ended_at: new Date().toISOString() });
      } catch { /* 静默 */ }
    }, 10000);
    endStudySessionApi(sid, { ended_at: new Date().toISOString() }).catch(() => {});

    // 页面关闭/刷新保底 —— fetch keepalive 保证请求完成
    const onUnload = () => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return;
        const token = JSON.parse(raw)?.state?.token;
        if (token) {
          fetch(`/api/study-sessions/${sid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ended_at: new Date().toISOString() }),
            keepalive: true,
          });
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(timerId);
      clearInterval(persistId);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [phase, session?.started_at, session?.id]);

  /** 格式化秒为 MM:SS */
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  /** 预加载当前卡片之后 3 张的图片，避免翻牌时白屏等待 */
  useEffect(() => {
    const PRELOAD_COUNT = 3;
    for (let i = 1; i <= PRELOAD_COUNT; i++) {
      const nextCard = queue[currentIndex + i];
      if (nextCard?.image_url) {
        const img = new Image();
        img.src = getImageUrl(nextCard.image_url);
      }
    }
  }, [queue, currentIndex]);

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

  /** 确认退出：先结束会话（保留已评分的卡） → 回到来源页 */
  const handleConfirmExit = useCallback(async () => {
    setConfirmExit(false);
    if (phase === 'studying' && session) {
      try {
        await endSession();
      } catch (err) {
        console.error('[StudyPage] endSession 失败:', err);
      }
    }
    navigate(-1);
  }, [phase, session, endSession, navigate]);

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
        {/* 顶部：左-返回 + 右-计时 */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        >
          <Button
            onClick={handleRequestExit}
            size="small"
            startIcon={<ArrowBackIcon />}
            sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500 }}
          >
            返回
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtTime(elapsed)}
          </Typography>
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
      <StudyComplete
        session={session}
        onBackToDashboard={handleConfirmExit}
      />
    );
  }

  // 兜底加载状态
  return <LoadingState message="正在准备学习..." />;
};

export default StudyPage;
