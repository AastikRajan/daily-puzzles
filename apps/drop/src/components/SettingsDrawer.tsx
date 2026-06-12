import { useSettings, applyTheme, type ThemeChoice } from '../state/settings';

interface Props {
  onClose: () => void;
}

export default function SettingsDrawer({ onClose }: Props) {
  const { theme, sound, reducedMotion, set } = useSettings();

  const setTheme = (t: ThemeChoice) => {
    set({ theme: t });
    applyTheme(t, reducedMotion);
  };

  const THEMES: ThemeChoice[] = ['auto', 'light', 'dark'];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(10,0,14,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 20,
    }} onClick={onClose}>
      <div
        className="panel"
        style={{ width: '100%', padding: '24px 20px 32px', borderRadius: '24px 24px 0 0', maxWidth: 500 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>Settings</h2>
          <button onClick={onClose} style={{ fontSize: 22, lineHeight: 1 }} aria-label="Close settings">✕</button>
        </div>

        <hr className="hairline" style={{ marginBottom: 18 }} />

        {/* Theme */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>Theme</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 12,
                  background: theme === t ? 'var(--c-brand)' : 'var(--surface)',
                  color: theme === t ? '#fff' : 'var(--ink)',
                  border: `1px solid ${theme === t ? 'transparent' : 'var(--surface-edge)'}`,
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Sound */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontFamily: 'var(--font-ui)', color: 'var(--ink)' }}>Sound effects</span>
          <button
            role="switch"
            aria-checked={sound}
            onClick={() => set({ sound: !sound })}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: sound ? 'var(--c-brand)' : 'var(--line-strong)',
              position: 'relative', transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: sound ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'left 200ms',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>

        {/* Reduced motion */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontFamily: 'var(--font-ui)', color: 'var(--ink)' }}>Reduced motion</span>
          <button
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => {
              const next = !reducedMotion;
              set({ reducedMotion: next });
              applyTheme(theme, next);
            }}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: reducedMotion ? 'var(--c-brand)' : 'var(--line-strong)',
              position: 'relative', transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: reducedMotion ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'left 200ms',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}
