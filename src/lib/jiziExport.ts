import { getImageUrl } from './api';
import type { JiziMatchResult, JiziLayout } from '@/types/jizi';

/**
 * Canvas 导出集字作品为 PNG
 * 使用 2x devicePixelRatio 保证高清输出
 */
export async function exportJiziPNG(
  results: JiziMatchResult[],
  selections: number[],
  layout: JiziLayout,
): Promise<void> {
  const { direction, fontSize, colCount, charGap, lineGap, background } = layout;

  if (results.length === 0) return;

  const cell = fontSize;
  const cg = Math.round(fontSize * charGap);
  const lg = Math.round(fontSize * lineGap);

  // 分组
  const groups: JiziMatchResult[][] = [];
  for (let i = 0; i < results.length; i += colCount) {
    groups.push(results.slice(i, i + colCount));
  }

  const isVertical = direction.startsWith('vertical');
  const groupCount = groups.length;
  const maxInGroup = colCount;

  const width = isVertical
    ? groupCount * cell + (groupCount - 1) * lg
    : maxInGroup * cell + (maxInGroup - 1) * cg;
  const height = isVertical
    ? maxInGroup * cell + (maxInGroup - 1) * cg
    : groupCount * cell + (groupCount - 1) * lg;

  const padding = 40;
  const totalW = width + padding * 2;
  const totalH = height + padding * 2;
  const dpr = 2;

  const canvas = document.createElement('canvas');
  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // 背景
  const bgColors: Record<string, string> = {
    xuan: '#f5ecd9',
    white: '#ffffff',
    ink: '#1a1a1a',
    vermilion: '#8b0000',
  };
  ctx.fillStyle = bgColors[background] || '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);

  // 预加载图片
  const urlSet = new Set<string>();
  results.forEach((r, i) => {
    const hit = r.hits[selections[i] ?? 0];
    if (hit) urlSet.add(getImageUrl(hit.image_url));
  });
  const imgMap = await loadImages(Array.from(urlSet));

  // 逐字绘制
  const needsReversed = direction.endsWith('rl');
  const orderedGroups = needsReversed ? [...groups].reverse() : groups;

  orderedGroups.forEach((group, gi) => {
    const realGi = needsReversed ? groups.length - 1 - gi : gi;

    group.forEach((result, ii) => {
      const globalIndex = realGi * colCount + ii;

      let x: number, y: number;
      if (isVertical) {
        x = padding + gi * (cell + lg);
        y = padding + ii * (cell + cg);
      } else {
        x = padding + ii * (cell + cg);
        y = padding + gi * (cell + lg);
      }

      const hit = result.hits[selections[globalIndex] ?? 0];
      if (hit) {
        const img = imgMap.get(getImageUrl(hit.image_url));
        if (img) {
          drawContain(ctx, img, x, y, cell, cell);
        }
      } else {
        // 缺字：虚线方框
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
        ctx.setLineDash([]);
        ctx.fillStyle = '#999';
        ctx.font = `${Math.round(cell * 0.4)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(result.char, x + cell / 2, y + cell / 2);
      }
    });
  });

  // 触发下载
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jizi-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    },
    'image/png',
  );
}

function loadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
  return Promise.all(
    urls.map(
      (u) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image();
          // 同源图片不需要 crossOrigin，设置了反而可能因服务器无 CORS 头导致加载失败
          img.onload = () => resolve([u, img]);
          img.onerror = () => reject(new Error(`图片加载失败: ${u}`));
          img.src = u;
        }),
    ),
  ).then((list) => new Map(list));
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > cr) {
    dh = w / ir;
    dy = y + (h - dh) / 2;
  } else {
    dw = h * ir;
    dx = x + (w - dw) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}
