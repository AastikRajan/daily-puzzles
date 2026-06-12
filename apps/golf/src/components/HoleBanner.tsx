import React, { useEffect, useState } from 'react';
import { useGame } from '../state/game';

export function HoleBanner() {
  const { holes, holeIndex, phase, startHole } = useGame();
  const hole = holes[holeIndex];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (phase !== 'banner') return;
    setVisible(true);
    const timer = setTimeout(() => {
      startHole();
    }, 1800);
    return () => clearTimeout(timer);
  }, [phase, holeIndex]);

  if (phase !== 'banner' || !visible || !hole) return null;

  return (
    <div
      onClick={() => { setVisible(false); startHole(); }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,10,26,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
        cursor: 'pointer',
        animation: 'bannerIn 0.35s cubic-bezier(0.2,0.9,0.3,1.15)',
      }}
    >
      <div style={{
        fontSize: 14,
        color: '#00ffcc',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-ui)',
        marginBottom: 8,
      }}>
        Hole {holeIndex + 1} of 9
      </div>
      <div style={{
        fontSize: 42,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        color: '#ffffff',
        textShadow: '0 0 24px #00ffcc, 0 0 48px #00ffcc40',
      }}>
        Hole {holeIndex + 1}
      </div>
      <div style={{
        fontSize: 20,
        color: '#88ffee',
        marginTop: 4,
        fontFamily: 'var(--font-ui)',
      }}>
        Par {hole.par}
      </div>
      <div style={{
        marginTop: 24,
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'var(--font-ui)',
      }}>
        Tap to start
      </div>
    </div>
  );
}
