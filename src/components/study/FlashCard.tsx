import React from 'react';
import { useTheme } from '@mui/material';
import type { Card } from '@/types';
import { getImageUrl } from '@/lib/api';

export interface FlashCardProps {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
}

const FlashCard: React.FC<FlashCardProps> = ({ card, flipped, onFlip }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const faceStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#2d2d2d' : '#fff',
    borderColor: isDark ? '#444' : '#e5e7eb',
  };

  return (
    <div className="perspective-1000 w-full flex justify-center" style={{ perspective: '800px' }}>
      <div
        className="relative w-full max-w-lg cursor-pointer select-none"
        style={{ minHeight: '280px' }}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
        aria-label={flipped ? '点击翻回正面' : '点击翻到背面'}
      >
        <div
          className="preserve-3d relative w-full h-64"
          style={{ minHeight: '280px', transition: 'transform 0.5s', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* 正面 */}
          <div className="backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border" style={faceStyle}>
            <span className="card-front-text text-center px-4 break-all">{card.front_text}</span>
          </div>

          {/* 背面 */}
          <div
            className="backface-hidden rotate-y-180 absolute inset-0 flex items-center justify-center rounded-xl border card-image-back overflow-hidden"
            style={{ backgroundColor: isDark ? '#2d2d2d' : '#fafafa', borderColor: isDark ? '#444' : '#e5e7eb' }}
          >
            {card.image_url ? (
              <img src={getImageUrl(card.image_url)} alt={`书法：${card.front_text}`} className="object-contain max-h-full max-w-full p-4" draggable={false} />
            ) : card.back_text ? (
              <span className="card-front-text text-center px-4 break-all">{card.back_text}</span>
            ) : (
              <p className="text-ink-light text-sm">暂无内容</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashCard;
