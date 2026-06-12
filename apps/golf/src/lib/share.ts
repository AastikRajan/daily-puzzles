import { shortDate } from './time';

/** Emoji per hole based on strokes vs par. */
export function holeEmoji(strokes: number, par: number): string {
  if (strokes === 1) return '🌟'; // hole-in-one / ace
  if (strokes < par) return '🟢'; // under par
  if (strokes === par) return '⚪'; // par
  if (strokes === par + 1) return '🟠'; // +1 bogey
  return '🔴'; // +2 or worse
}

export function buildGolfShare(
  date: string,
  strokes: number[],
  pars: number[],
  streak: number,
  best: number,
): string {
  const totalStrokes = strokes.reduce((a, b) => a + b, 0);
  const totalPar = pars.reduce((a, b) => a + b, 0);
  const diff = totalStrokes - totalPar;
  const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const emojiRow = strokes.map((s, i) => holeEmoji(s, pars[i] ?? 3)).join('');
  const streakLine = streak > 1 ? `🔥 ${streak}-day streak · Best: ${best > 0 ? '+' + best : best}` : '';

  return [
    `Glow Golf · ${shortDate(date)} · ${diffStr} ⛳`,
    emojiRow,
    streakLine,
    'https://glow-golf.app',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Copy + native share sheet. Returns 'shared' | 'copied' | 'failed'. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
