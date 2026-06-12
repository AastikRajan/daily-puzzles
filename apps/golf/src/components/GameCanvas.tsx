import React, { useRef, useEffect, useCallback } from 'react';
import { useGame } from '../state/game';
import { useSettings } from '../state/settings';
import { MAX_POWER_PX, BALL_RADIUS, HOLE_RADIUS, resolvedGate } from '../engine/physics';
import type { HoleDef, BallState } from '../engine/types';

const TRAIL_LEN = 8;

interface Props {
  width: number;
  height: number;
}

export function GameCanvas({ width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);
  const pulseRef = useRef<number>(0);

  const { phase, holes, holeIndex, ballState, gateT, shoot, tickPhysics, setAim, aimAngle, aimPower } = useGame();
  const { reducedMotion } = useSettings();

  const hole = holes[holeIndex];

  // rAF loop
  useEffect(() => {
    let running = true;
    function frame(ts: number) {
      if (!running) return;
      const dt = Math.min((ts - lastTRef.current) / 1000, 0.05);
      lastTRef.current = ts;
      pulseRef.current = ts;

      if (phase === 'playing' || phase === 'sinking') {
        tickPhysics(dt);
      }

      draw(ts);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame((ts) => {
      lastTRef.current = ts;
      frame(ts);
    });
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, holes, holeIndex, ballState, gateT, aimAngle, aimPower, reducedMotion]);

  // Track ball trail
  useEffect(() => {
    if (ballState.status === 'rolling') {
      trailRef.current = [...trailRef.current, { x: ballState.x, y: ballState.y }].slice(-TRAIL_LEN);
    } else if (ballState.status === 'idle' || ballState.status === 'sunk') {
      trailRef.current = [];
    }
  }, [ballState]);

  function draw(ts: number) {
    const canvas = canvasRef.current;
    if (!canvas || !hole) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = width / hole.canvasW;
    const scaleY = height / hole.canvasH;
    const scale = Math.min(scaleX, scaleY);

    canvas.width = width;
    canvas.height = height;

    ctx.save();
    ctx.scale(scale, scale);

    const cw = hole.canvasW;
    const ch = hole.canvasH;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, cw, ch);

    // Draw felt texture (subtle grid)
    ctx.strokeStyle = 'rgba(0,255,150,0.03)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < cw; gx += 20) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke();
    }
    for (let gy = 0; gy < ch; gy += 20) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
    }

    drawSand(ctx, hole);
    drawWalls(ctx, hole, ts);
    drawBumpers(ctx, hole);
    drawGate(ctx, hole, gateT, ts);
    drawHole(ctx, hole, ts);
    drawTrail(ctx);
    drawBall(ctx, ballState, ts);

    if (phase === 'playing' && ballState.status !== 'rolling' && aimAngle !== null && aimPower !== null) {
      drawAimArrow(ctx, ballState, aimAngle, aimPower, hole);
    }

    ctx.restore();
  }

  function drawWalls(ctx: CanvasRenderingContext2D, hole: HoleDef, _ts: number) {
    for (const w of hole.walls) {
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#00ffcc';
      ctx.fillStyle = '#1a1a3e';
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1.5;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      ctx.restore();
    }
  }

  function drawSand(ctx: CanvasRenderingContext2D, hole: HoleDef) {
    for (const s of hole.sand) {
      ctx.save();
      ctx.fillStyle = '#2a1800';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      // Dot texture
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ffaa00';
      ctx.fillStyle = '#3a2800';
      for (let dx = s.x + 4; dx < s.x + s.w - 4; dx += 8) {
        for (let dy = s.y + 4; dy < s.y + s.h - 4; dy += 8) {
          ctx.beginPath();
          ctx.arc(dx, dy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  function drawBumpers(ctx: CanvasRenderingContext2D, hole: HoleDef) {
    for (const b of hole.bumpers) {
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ff00aa';
      ctx.strokeStyle = '#ff00aa';
      ctx.fillStyle = 'rgba(255,0,170,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGate(ctx: CanvasRenderingContext2D, hole: HoleDef, t: number, ts: number) {
    if (!hole.gate) return;
    const g = resolvedGate(hole.gate, t);
    const pulse = Math.sin(ts / 400) * 0.5 + 0.5;
    ctx.save();
    ctx.shadowBlur = 12 + pulse * 8;
    ctx.shadowColor = '#ffff00';
    ctx.fillStyle = `rgba(255,220,0,${0.6 + pulse * 0.3})`;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeRect(g.x, g.y, g.w, g.h);
    ctx.restore();
  }

  function drawHole(ctx: CanvasRenderingContext2D, hole: HoleDef, ts: number) {
    const { x, y, r } = hole.hole;
    const pulse = reducedMotion ? 8 : 8 + Math.sin(ts / 600) * 8;

    // Dark hole
    ctx.save();
    ctx.shadowBlur = pulse;
    ctx.shadowColor = '#00ffcc';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing ring
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7 + Math.sin(ts / 600) * 0.3;
    ctx.stroke();

    // Flag pole
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - r * 2.2);
    ctx.stroke();

    // Flag
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2.2);
    ctx.lineTo(x + 10, y - r * 1.7);
    ctx.lineTo(x, y - r * 1.2);
    ctx.fill();

    ctx.restore();
  }

  function drawTrail(ctx: CanvasRenderingContext2D) {
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i]!;
      const alpha = (i / trail.length) * 0.5;
      const radius = BALL_RADIUS * 0.4 * (i / trail.length);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#00ffff';
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBall(ctx: CanvasRenderingContext2D, ball: BallState, _ts: number) {
    if (ball.status === 'sunk') return;
    const { x, y } = ball;
    const r = BALL_RADIUS;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffff';

    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#88ffee');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAimArrow(
    ctx: CanvasRenderingContext2D,
    ball: BallState,
    angle: number,
    power: number,
    hole: HoleDef,
  ) {
    const { x, y } = ball;
    const len = power * MAX_POWER_PX;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;

    // Dashed aim line
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = `rgba(0,255,204,${0.4 + power * 0.5})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffcc';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Arrowhead
    ctx.setLineDash([]);
    ctx.fillStyle = '#00ffcc';
    const headLen = 10;
    const ax = angle + Math.PI + 0.4;
    const ay = angle + Math.PI - 0.4;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(ax) * headLen, ey + Math.sin(ax) * headLen);
    ctx.lineTo(ex + Math.cos(ay) * headLen, ey + Math.sin(ay) * headLen);
    ctx.closePath();
    ctx.fill();

    // Power ring around ball
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS + 4 + power * 8, 0, Math.PI * 2);
    ctx.stroke();

    // Predicted bounce preview (dotted, first-bounce simulation)
    drawBouncePreview(ctx, ball, angle, power, hole);

    ctx.restore();
  }

  function drawBouncePreview(
    ctx: CanvasRenderingContext2D,
    ball: BallState,
    angle: number,
    power: number,
    hole: HoleDef,
  ) {
    // Simple ray-march: 20 steps
    const spd = power * 12; // simplified
    let px = ball.x;
    let py = ball.y;
    let pvx = Math.cos(angle) * spd;
    let pvy = Math.sin(angle) * spd;
    const r = BALL_RADIUS;

    ctx.setLineDash([3, 5]);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);

    let bounced = false;
    for (let i = 0; i < 40; i++) {
      px += pvx;
      py += pvy;
      pvx *= 0.98;
      pvy *= 0.98;

      // Simple wall bounce
      for (const w of hole.walls) {
        if (px + r > w.x && px - r < w.x + w.w && py + r > w.y && py - r < w.y + w.h) {
          // reflect
          const oL = px + r - w.x;
          const oR = w.x + w.w - (px - r);
          const oT = py + r - w.y;
          const oB = w.y + w.h - (py - r);
          if (Math.min(oL, oR) < Math.min(oT, oB)) pvx *= -1;
          else pvy *= -1;
          if (!bounced) {
            bounced = true;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.globalAlpha = 0.12;
          }
        }
      }
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Pointer events
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing') return;
    if (ballState.status === 'rolling') return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }, [phase, ballState.status]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || phase !== 'playing') return;
    const dx = dragRef.current.startX - e.clientX;
    const dy = dragRef.current.startY - e.clientY;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const power = Math.min(dragDist / MAX_POWER_PX, 1);
    setAim(angle, power);
  }, [phase, setAim]);

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || phase !== 'playing') return;
    if (aimAngle !== null && aimPower !== null && aimPower > 0.05) {
      shoot(aimAngle, aimPower);
    }
    dragRef.current = null;
    setAim(null, null);
  }, [phase, aimAngle, aimPower, shoot, setAim]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
        touchAction: 'none',
        cursor: phase === 'playing' && ballState.status !== 'rolling' ? 'crosshair' : 'default',
        borderRadius: '12px',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
