import type { GameState } from '../game/engine';
import { getTier } from '../game/orbs';

interface Props {
  state: GameState;
  onSettings: () => void;
}

export default function HUD({ state, onSettings }: Props) {
  const nextData = getTier(state.nextTier);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px 6px',
      width: '100%',
      flexShrink: 0,
    }}>
      {/* Score chip */}
      <div className="panel" style={{ padding: '6px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score</div>
        <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{state.score}</div>
      </div>

      {/* Next orb preview */}
      <div className="panel" style={{ padding: '6px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next</div>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${nextData.colorLight}, ${nextData.color} 55%, ${nextData.colorDark})`,
          boxShadow: `0 2px 6px ${nextData.colorDark}55`,
        }} />
      </div>

      {/* Best + settings */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div className="panel" style={{ padding: '6px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Best</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{state.best}</div>
        </div>
        <button
          onClick={onSettings}
          aria-label="Settings"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--surface-edge)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}
        >⚙️</button>
      </div>
    </div>
  );
}
