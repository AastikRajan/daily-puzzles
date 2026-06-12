/** Wordle-style spoiler-free share: one row per attempt. */
export function attemptRow(result: number): string {
  if (result === -1) return '🟩';
  // toppled after placing N shapes: N blue squares then red
  return '🟦'.repeat(Math.min(result, 7)) + '🟥';
}

export function buildBalanceShare(
  date: string,
  attemptResults: number[],
  solved: boolean,
  streak: number,
): string {
  const d = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const head = solved
    ? `Balance! · ${d} · solved in ${attemptResults.length}/5`
    : `Balance! · ${d} · X/5`;
  const rows = attemptResults.map(attemptRow).join('\n');
  const streakLine = streak > 1 ? `🔥 ${streak}-day streak` : '';
  return [head, rows, streakLine, 'https://balance-daily.app'].filter(Boolean).join('\n');
}

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
