import { readFileSync, writeFileSync } from 'node:fs';

// 1) sim.ts — wire SFX
const simF = 'apps/balance/src/game/sim.ts';
let sim = readFileSync(simF, 'utf8');
sim = sim.replace(
  "import { tap, pop } from '../lib/haptics';",
  "import { tap, pop } from '../lib/haptics';\nimport { sfxClick, sfxDeath, sfxStart, sfxEat } from '../lib/sfx';",
);
sim = sim.replace('this.nextIdx++;\n    this.holdPos = null;', 'this.nextIdx++;\n    sfxEat();\n    this.holdPos = null;');
sim = sim.replace("this.phase = 'failed';\n    pop();", "this.phase = 'failed';\n    sfxDeath();\n    pop();");
sim = sim.replace("this.attemptResults.push(-1);\n    this.phase = 'won';\n    pop();", "this.attemptResults.push(-1);\n    this.phase = 'won';\n    sfxStart();\n    pop();");
sim = sim.replace('rotateHold(): void {\n    this.holdAngle += Math.PI / 12;', 'rotateHold(): void {\n    sfxClick();\n    this.holdAngle += Math.PI / 12;');
writeFileSync(simF, sim);

// 2) GameView — started state, title overlay, height-fit
const gvF = 'apps/balance/src/components/GameView.tsx';
let gv = readFileSync(gvF, 'utf8');
gv = gv.replace(
  "import { useSettings } from '../state/settings';",
  "import { useSettings } from '../state/settings';\nimport { sfxStart } from '../lib/sfx';",
);
gv = gv.replace(
  'const theme = useSettings((s) => s.theme);',
  'const [started, setStarted] = useState(false);\n  const theme = useSettings((s) => s.theme);',
);
gv = gv.replace(
  "const fit = () => {\n      const w = Math.min(window.innerWidth - 16, 470);",
  "const fit = () => {\n      const w = Math.min(window.innerWidth - 16, (window.innerHeight - 150) / 1.436, 760);",
);
gv = gv.replace(
  '<button className="chip rotate-btn"',
  `{!started && (
          <div className="start-overlay" data-testid="start-overlay">
            <h1 className="start-title">Balance!</h1>
            <p className="start-sub">today's 8 shapes — same for everyone</p>
            <div className="howto-row">
              <span>👆 drag = place</span>
              <span>⟳ rotate</span>
              <span>5 tries · don't topple</span>
            </div>
            <button
              className="btn3d start-btn"
              data-testid="start-btn"
              onClick={() => {
                sfxStart();
                setStarted(true);
              }}
            >
              ▶ &nbsp;PLAY
            </button>
          </div>
        )}
        <button className="chip rotate-btn"`,
);
writeFileSync(gvF, gv);

// 3) CSS — start overlay (scoped inside stage)
const cssF = 'apps/balance/src/styles/global.css';
let css = readFileSync(cssF, 'utf8');
css += `
/* title screen */
.start-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  background: radial-gradient(60% 50% at 50% 42%, rgba(60,40,20,0.25) 0%, rgba(60,40,20,0.7) 100%);
  z-index: 25;
  padding: 24px;
  text-align: center;
  border-radius: 20px;
}
.start-title {
  font-family: var(--font-display);
  font-size: clamp(40px, 8vw, 62px);
  font-weight: 800;
  margin: 0;
  background: var(--g-accent);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 4px 18px rgba(245, 160, 90, 0.5));
}
.start-sub { font-size: 14.5px; font-weight: 700; color: #fff7ea; margin: -5px 0 2px; }
.howto-row { display: flex; gap: 9px; flex-wrap: wrap; justify-content: center; font-size: 13px; font-weight: 800; color: var(--ink); }
.howto-row span {
  background: var(--surface-solid);
  border: 1px solid var(--surface-edge);
  border-radius: 12px;
  padding: 7px 12px;
  box-shadow: 0 2px 0 var(--edge-shadow);
}
.start-btn {
  font-size: 20px;
  padding: 15px 46px;
  margin-top: 6px;
  animation: start-glow 1.4s ease-in-out infinite;
}
@keyframes start-glow {
  0%, 100% { box-shadow: 0 5px 0 var(--btn-deep), 0 0 14px rgba(245, 160, 90, 0.4); }
  50% { box-shadow: 0 5px 0 var(--btn-deep), 0 0 38px rgba(245, 160, 90, 0.85); }
}
`;
writeFileSync(cssF, css);

// 4) e2e — click start before interacting
const e2eF = 'apps/balance/e2e/balance.spec.ts';
let sp = readFileSync(e2eF, 'utf8');
sp = sp.replaceAll(
  "await page.waitForFunction(() => typeof window.__balance !== 'undefined');",
  "await page.waitForFunction(() => typeof window.__balance !== 'undefined');\n  await page.getByTestId('start-btn').click();",
);
writeFileSync(e2eF, sp);

console.log('balance fixed');
