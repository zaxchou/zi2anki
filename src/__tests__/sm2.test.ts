/**
 * SM-2 算法单元测试
 * 使用纯 Node 运行：npx tsx src/__tests__/sm2.test.ts
 */

import { calculateNextReview, isDue, createInitialSM2State } from '../lib/sm2';
import { SM2_DEFAULTS } from '../lib/constants';
import type { SM2Input } from '../types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`  ✗ ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`  ✗ ${msg} — 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual: number, expected: number, msg: string): void {
  if (Math.abs(actual - expected) < 0.01) {
    passed++;
  } else {
    failed++;
    failures.push(`  ✗ ${msg} — 期望接近: ${expected}, 实际: ${actual}`);
  }
}

// ================================================================
// 测试组 1: createInitialSM2State
// ================================================================
console.log('\n📋 测试组 1: createInitialSM2State');
{
  const state = createInitialSM2State();
  assertEqual(state.ease, 2.5, '初始 ease 应为 2.5');
  assertEqual(state.interval, 0, '初始 interval 应为 0');
  assertEqual(state.repetitions, 0, '初始 repetitions 应为 0');
}

// ================================================================
// 测试组 2: 全新卡片 (interval=0) 的四种评分
// ================================================================
console.log('\n📋 测试组 2: 全新卡片评分');

{
  // Again (1): 应重置到第一步
  const result = calculateNextReview(1, { ease: 2.5, interval: 0, repetitions: 0 });
  assertEqual(result.repetitions, 0, 'Again: repetitions 应为 0');
  assertEqual(result.interval, SM2_DEFAULTS.INITIAL_STEPS[0], 'Again: interval 应为 1 分钟');
  assertClose(result.ease, 2.3, 'Again: ease 应为 2.3 (2.5 - 0.20)');
}

{
  // Hard (2): 新卡点Hard应给 3 分钟间隔
  const result = calculateNextReview(2, { ease: 2.5, interval: 0, repetitions: 0 });
  assertEqual(result.interval, SM2_DEFAULTS.INITIAL_STEPS[1], 'Hard: interval 应为 3 分钟');
  assertClose(result.ease, 2.35, 'Hard: ease 应为 2.35 (2.5 - 0.15)');
}

{
  // Good (3): 新卡点Good应跳过前两步直接进入 10 分钟
  const result = calculateNextReview(3, { ease: 2.5, interval: 0, repetitions: 0 });
  assertEqual(result.interval, SM2_DEFAULTS.INITIAL_STEPS[2], 'Good: interval 应为 10 分钟');
  assertEqual(result.ease, 2.5, 'Good: ease 应不变');
  assertEqual(result.repetitions, 1, 'Good: repetitions 应 +1');
}

{
  // Easy (4): 新卡点Easy应直接毕业
  const result = calculateNextReview(4, { ease: 2.5, interval: 0, repetitions: 0 });
  assertEqual(result.interval, SM2_DEFAULTS.EASY_GRADUATING_INTERVAL, 'Easy: interval 应为 4 天');
  assertClose(result.ease, 2.65, 'Easy: ease 应为 2.65 (2.5 + 0.15)');
  assertEqual(result.repetitions, 1, 'Easy: repetitions 应为 1');
}

// ================================================================
// 测试组 3: 学习第一步 (interval=1) 的评分, 下一步为 3 分钟
// ================================================================
console.log('\n📋 测试组 3: 学习第一步 (interval=1)');

{
  // Again: 重置到第一步
  const result = calculateNextReview(1, { ease: 2.5, interval: 1, repetitions: 1 });
  assertEqual(result.repetitions, 0, 'Again: repetitions 应重置');
  assertEqual(result.interval, SM2_DEFAULTS.INITIAL_STEPS[0], 'Again: 应回到第一步');
}

{
  // Hard: 保持在当前步骤
  const result = calculateNextReview(2, { ease: 2.5, interval: 1, repetitions: 1 });
  assertEqual(result.interval, 1, 'Hard: 应保持 interval=1');
  assertClose(result.ease, 2.35, 'Hard: ease 应减 0.15');
}

{
  // Good: 进入下一步 (3分钟 Hard 阶梯)
  const result = calculateNextReview(3, { ease: 2.5, interval: 1, repetitions: 1 });
  assertEqual(result.interval, SM2_DEFAULTS.INITIAL_STEPS[1], 'Good: 应进入 3 分钟');
  assertEqual(result.repetitions, 2, 'Good: repetitions 应为 2');
}

{
  // Easy: 直接毕业
  const result = calculateNextReview(4, { ease: 2.5, interval: 1, repetitions: 1 });
  assertEqual(result.interval, SM2_DEFAULTS.EASY_GRADUATING_INTERVAL, 'Easy: 应毕业');
  assertClose(result.ease, 2.65, 'Easy: ease 应 +0.15');
}

// ================================================================
// 测试组 3b: 学习第二步 (interval=3, Hard) 的评分
// ================================================================
console.log('\n📋 测试组 3b: 学习第二步 (interval=3)');

{
  // Good: 进入下一步 10 分钟
  const r = calculateNextReview(3, { ease: 2.35, interval: 3, repetitions: 0 });
  assertEqual(r.interval, SM2_DEFAULTS.INITIAL_STEPS[2], 'Good: 应进入 10 分钟');
  assertEqual(r.repetitions, 1, 'Good: repetitions 应为 1');
}

{
  // Hard: 保持在当前步骤
  const r = calculateNextReview(2, { ease: 2.35, interval: 3, repetitions: 0 });
  assertEqual(r.interval, 3, 'Hard: 应保持 interval=3');
  assertClose(r.ease, 2.20, 'Hard: ease 应减到 2.20');
}

// ================================================================
// 测试组 4: 学习第三步 (interval=10) 的评分 → 毕业
// ================================================================
console.log('\n📋 测试组 4: 学习第二步 (interval=10)');

{
  // Good: 毕业进入 1 天
  const result = calculateNextReview(3, { ease: 2.5, interval: 10, repetitions: 2 });
  assertEqual(result.interval, SM2_DEFAULTS.GRADUATING_INTERVAL, 'Good: 应毕业到 1 天');
  assertEqual(result.repetitions, 3, 'Good: repetitions 应为 3');
}

{
  // Easy: 直接毕业
  const result = calculateNextReview(4, { ease: 2.5, interval: 10, repetitions: 2 });
  assertEqual(result.interval, SM2_DEFAULTS.EASY_GRADUATING_INTERVAL, 'Easy: 应毕业');
}

// ================================================================
// 测试组 5: 已毕业卡片的评分
// ================================================================
console.log('\n📋 测试组 5: 已毕业卡片');

{
  // Again: 重置
  const result = calculateNextReview(1, { ease: 2.5, interval: 1440, repetitions: 5 });
  assertEqual(result.repetitions, 0, 'Again: repetitions 应归零');
  assertEqual(result.interval, SM2_DEFAULTS.INITIAL_STEPS[0], 'Again: 应回到第一步');
  assertClose(result.ease, 2.3, 'Again: ease 应 -0.20');
}

{
  // Hard: interval × 1.2
  const result = calculateNextReview(2, { ease: 2.5, interval: 1440, repetitions: 5 });
  assertEqual(result.interval, Math.round(1440 * 1.2), 'Hard: interval 应为当前 × 1.2');
  assertEqual(result.repetitions, 6, 'Hard: repetitions 应为 6');
  assertClose(result.ease, 2.35, 'Hard: ease 应 -0.15');
}

{
  // Good: interval × ease
  const result = calculateNextReview(3, { ease: 2.5, interval: 1440, repetitions: 5 });
  assertEqual(result.interval, Math.round(1440 * 2.5), 'Good: interval 应为当前 × ease');
  assertEqual(result.repetitions, 6, 'Good: repetitions 应为 6');
  assertEqual(result.ease, 2.5, 'Good: ease 应不变');
}

{
  // Easy: interval × ease × 1.3
  const result = calculateNextReview(4, { ease: 2.5, interval: 1440, repetitions: 5 });
  assertEqual(result.interval, Math.round(1440 * 2.5 * SM2_DEFAULTS.EASY_BONUS), 'Easy: interval 应为 当前 × ease × 1.3');
  assertClose(result.ease, 2.65, 'Easy: ease 应 +0.15');
}

// ================================================================
// 测试组 6: Ease 下限保护
// ================================================================
console.log('\n📋 测试组 6: Ease 下限保护');

{
  // 连续 Again：ease 不应低于 MIN_EASE
  const r1 = calculateNextReview(1, { ease: 1.3, interval: 1440, repetitions: 5 });
  assertEqual(r1.ease, SM2_DEFAULTS.MIN_EASE, 'ease 不低于 MIN_EASE (再次 Again)');
}

{
  const r1 = calculateNextReview(2, { ease: 1.3, interval: 1440, repetitions: 5 });
  assertEqual(r1.ease, SM2_DEFAULTS.MIN_EASE, 'ease 不低于 MIN_EASE (Hard)');
}

// ================================================================
// 测试组 7: isDue 函数
// ================================================================
console.log('\n📋 测试组 7: isDue');

{
  // 过期的卡片
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  assert(isDue({ next_review: past }), '过期卡片应返回 true');
}

{
  // 未来的卡片
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assert(!isDue({ next_review: future }), '未来卡片应返回 false');
}

{
  // 正好现在
  const now = new Date();
  const justNow = new Date(now.getTime() - 1000).toISOString();
  assert(isDue({ next_review: justNow }), '刚刚过期的卡片应返回 true');
}

{
  // 无效日期
  assert(isDue({ next_review: 'invalid-date' }), '无效日期应返回 true');
}

{
  // 自定义参考时间
  const future = new Date(Date.now() + 3600_000).toISOString();
  const refTime = new Date(Date.now() + 7200_000);
  assert(isDue({ next_review: future }, refTime), '自定义参考时间：未来卡片在更远的参考时间下应为 true');
}

// ================================================================
// 测试组 8: 边缘情况
// ================================================================
console.log('\n📋 测试组 8: 边缘情况');

{
  // interval 为 0 但已经被评分过 Again（理论上不会，但防护）
  const result = calculateNextReview(3, { ease: 2.5, interval: 0, repetitions: 0 });
  assertEqual(result.interval, 10, 'interval 0 + Good = 第二步 10 分钟');
}

{
  // 高 ease + 大 interval
  const result = calculateNextReview(4, { ease: 2.8, interval: 86400, repetitions: 10 });
  const expected = Math.round(86400 * 2.8 * SM2_DEFAULTS.EASY_BONUS);
  assertEqual(result.interval, expected, '高 ease 大 interval Easy 计算');
  assertClose(result.ease, 2.95, 'ease 应 +0.15 到 2.95');
}

// ================================================================
// 测试组 9: 极端数值
// ================================================================
console.log('\n📋 测试组 9: 极端数值');

{
  // 极大 interval
  const bigInput: SM2Input = { ease: 2.5, interval: 1000000, repetitions: 100 };
  const result = calculateNextReview(1, bigInput);
  assertEqual(result.repetitions, 0, '极大 interval Again: repetitions 归零');
  assertEqual(result.interval, 1, '极大 interval Again: 回到第一步');
}

{
  // 极小 ease
  const lowEase: SM2Input = { ease: 1.3, interval: 1440, repetitions: 3 };
  const result = calculateNextReview(3, lowEase);
  assertEqual(result.interval, Math.round(1440 * 1.3), '低 ease Good: interval = 当前 × ease');
}

// ================================================================
// 结果汇总
// ================================================================
console.log('\n' + '='.repeat(50));
console.log(`\n📊 测试结果: 总计 ${passed + failed} | ✅ 通过 ${passed} | ❌ 失败 ${failed}`);
if (failures.length > 0) {
  console.log('\n失败详情:');
  failures.forEach((f) => console.log(f));
  console.log('\n❌ 测试失败！');
  throw new Error('Tests failed');
} else {
  console.log('\n🎉 所有测试通过！');
}
