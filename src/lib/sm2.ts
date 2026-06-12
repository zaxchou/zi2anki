// ===== SM-2 间隔重复算法（纯函数） =====

import type { Rating, SM2Input, SM2Output } from '@/types';
import { SM2_DEFAULTS } from './constants';

/**
 * 判断一个学习步骤是否已毕业（不再处于 INITIAL_STEPS 中）。
 * 毕业的条件：interval 大于所有初始步骤，且 repetitions > 0。
 */
function hasGraduated(input: SM2Input): boolean {
  const steps = SM2_DEFAULTS.INITIAL_STEPS;
  // interval 为 0 表示全新卡片
  // interval 在 steps 数组中的某个值表示还在学习阶梯中
  if (input.interval === 0) return false;
  if (steps.includes(input.interval as (typeof steps)[number])) return false;
  return true;
}

/**
 * 获取当前学习步骤的索引。
 * - 全新卡片（interval=0）返回 -1
 * - 在 INITIAL_STEPS 中找到对应值则返回其索引
 * - 其他情况返回 -1（已毕业或异常）
 */
function getCurrentStepIndex(input: SM2Input): number {
  if (input.interval === 0) return -1;
  return SM2_DEFAULTS.INITIAL_STEPS.indexOf(
    input.interval as (typeof SM2_DEFAULTS.INITIAL_STEPS)[number]
  );
}

/**
 * 根据评分和当前卡片状态，计算下一复习时间。
 *
 * SM-2 算法规则：
 * - Again (1): ease -= 0.20, 重置到学习阶梯第一步（1分钟），repetitions 归零
 * - Hard  (2): ease -= 0.15, 已毕业卡 interval = 当前 × 1.2；学习中卡保持在当前步骤
 * - Good  (3): ease 不变,  已毕业卡 interval = 当前 × ease；学习中卡进入下一步
 * - Easy  (4): ease += 0.15, interval = 当前 × ease × 1.3；学习中新卡直接毕业（4天）
 *
 * 所有 interval 取整到分钟。ease 下限为 MIN_EASE (1.3)。
 *
 * @param rating - 用户评分（1-4）
 * @param input - 当前卡片 SM-2 状态
 * @returns 更新后的 SM-2 状态，含 next_review ISO 8601 时间戳
 */
export function calculateNextReview(rating: Rating, input: SM2Input): SM2Output {
  const { ease, interval, repetitions } = input;
  let newEase: number;
  let newInterval: number;
  let newRepetitions: number;

  const graduated = hasGraduated(input);
  const steps = SM2_DEFAULTS.INITIAL_STEPS;

  switch (rating) {
    case 1: {
      // Again: 重置到学习第一步
      newEase = Math.max(SM2_DEFAULTS.MIN_EASE, ease + SM2_DEFAULTS.AGAIN_EASE_DELTA);
      newInterval = steps[0]; // 1 分钟
      newRepetitions = 0;
      break;
    }

    case 2: {
      // Hard
      newEase = Math.max(SM2_DEFAULTS.MIN_EASE, ease + SM2_DEFAULTS.HARD_EASE_DELTA);
      if (graduated) {
        newInterval = Math.round(interval * 1.2);
        newRepetitions = repetitions + 1;
      } else if (interval === 0) {
        // 全新卡点 Hard：给一个比 Again 稍长的间隔
        newInterval = SM2_DEFAULTS.HARD_NEW_CARD_INTERVAL;
        newRepetitions = 0;
      } else {
        // 学习阶段：保持当前步骤
        newInterval = interval;
        newRepetitions = repetitions;
      }
      break;
    }

    case 3: {
      // Good
      newEase = ease; // ease 不变
      if (graduated) {
        newInterval = Math.round(interval * ease);
        newRepetitions = repetitions + 1;
      } else {
        // 学习阶段：进入下一步
        const currentIdx = getCurrentStepIndex(input);
        if (currentIdx === -1) {
          // interval = 0（全新卡），跳过第一步，直接进入 10 分钟
          newInterval = steps[1];
          newRepetitions = 1;
        } else if (currentIdx < steps.length - 1) {
          // 还有下一步
          newInterval = steps[currentIdx + 1];
          newRepetitions = repetitions + 1;
        } else {
          // 已在最后一步，毕业
          newInterval = SM2_DEFAULTS.GRADUATING_INTERVAL;
          newRepetitions = repetitions + 1;
        }
      }
      break;
    }

    case 4: {
      // Easy
      newEase = Math.max(SM2_DEFAULTS.MIN_EASE, ease + SM2_DEFAULTS.EASY_EASE_DELTA);
      if (graduated) {
        newInterval = Math.round(interval * ease * SM2_DEFAULTS.EASY_BONUS);
      } else {
        // 学习中或新卡：直接毕业，使用 Easy 毕业间隔
        newInterval = SM2_DEFAULTS.EASY_GRADUATING_INTERVAL;
      }
      newRepetitions = repetitions + 1;
      break;
    }

    default: {
      // 防御性：不可能到达
      newEase = ease;
      newInterval = interval;
      newRepetitions = repetitions;
    }
  }

  // 确保 interval 至少为 1 分钟
  if (newInterval < 1) {
    newInterval = 1;
  }

  // 计算下次复习时间：now + interval（分钟）
  const now = new Date();
  const nextReviewDate = new Date(now.getTime() + newInterval * 60 * 1000);

  return {
    ease: newEase,
    interval: newInterval,
    repetitions: newRepetitions,
    next_review: nextReviewDate.toISOString(),
  };
}

/**
 * 判断一张卡片当前是否到期需要复习。
 *
 * @param card - 包含 next_review 字段的卡片对象
 * @param now - 参考时间点，默认为当前时刻
 * @returns 如果 next_review <= now 则返回 true
 */
export function isDue(
  card: { next_review: string },
  now: Date = new Date()
): boolean {
  const reviewTime = new Date(card.next_review);
  // 无效日期视为到期
  if (isNaN(reviewTime.getTime())) {
    return true;
  }
  return reviewTime <= now;
}

/**
 * 创建一张新卡的初始 SM-2 状态。
 *
 * @returns 包含默认 ease、interval=0、repetitions=0 的 SM2Input
 */
export function createInitialSM2State(): SM2Input {
  return {
    ease: SM2_DEFAULTS.INITIAL_EASE,
    interval: 0,
    repetitions: 0,
  };
}
