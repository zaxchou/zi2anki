import React from 'react';
import type { Card } from '@/types';
import { getImageUrl } from '@/lib/api';

export interface FlashCardProps {
  /** 当前卡片数据 */
  card: Card;
  /** 是否已翻转 */
  flipped: boolean;
  /** 点击翻转回调 */
  onFlip: () => void;
}

/**
 * 书法记忆闪卡组件 —— 核心学习组件。
 *
 * 使用 CSS 3D transform 实现卡片翻转动画：
 * - 正面：楷体大号文字（card.front_text）
 * - 背面：书法图片（card.image_url）
 * - 点击整个卡片触发翻转
 */
const FlashCard: React.FC<FlashCardProps> = ({ card, flipped, onFlip }) => {
  return (
    <div
      className="perspective-1000 w-full flex justify-center"
      style={{ perspective: '800px' }}
    >
      <div
        className="relative w-full max-w-lg cursor-pointer select-none"
        style={{ minHeight: '280px' }}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFlip();
          }
        }}
        aria-label={flipped ? '点击翻回正面' : '点击翻到背面'}
      >
        {/* 卡片内部容器 —— 3D 翻转 */}
        <div
          className="preserve-3d relative w-full h-64"
          style={{
            minHeight: '280px',
            transition: 'transform 0.5s',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ===== 正面：楷体大字 ===== */}
          <div
            className="backface-hidden absolute inset-0 flex items-center justify-center 
                           rounded-xl border border-gray-200 bg-paper-light"
          >
            <span className="card-front-text text-center px-4 break-all">
              {card.front_text}
            </span>
          </div>

          {/* ===== 背面：书法图片 ===== */}
          <div
            className="backface-hidden rotate-y-180 absolute inset-0 flex items-center justify-center
                           rounded-xl border border-gray-200 card-image-back overflow-hidden"
          >
            {card.image_url ? (
              <img
                src={getImageUrl(card.image_url)}
                alt={`书法：${card.front_text}`}
                className="object-contain max-h-full max-w-full p-4"
                draggable={false}
              />
            ) : (
              <p className="text-ink-light text-sm">暂无图片</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashCard;
