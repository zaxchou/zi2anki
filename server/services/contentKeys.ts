import crypto from 'node:crypto';

function normalizeSourceText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function shortHash(value: string, length = 16): string {
  return crypto.createHash('sha1').update(normalizeSourceText(value)).digest('hex').slice(0, length);
}

export function deckSourceKey(name: string): string {
  return `deck:${shortHash(name)}`;
}

export function cardSourceKey(deckKey: string, sortOrder: number, frontText: string): string {
  const order = String(Math.max(sortOrder, 0)).padStart(5, '0');
  return `card:${deckKey}:${order}:${shortHash(frontText, 12)}`;
}

export function filenameFromImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\/uploads\//, '').split('/').pop() || null;
}

export function imageUrlFromFilename(filename: string | null | undefined): string {
  return filename ? `/uploads/${filename}` : '';
}
