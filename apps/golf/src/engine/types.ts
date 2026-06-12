export interface WallSegment {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bumper {
  cx: number;
  cy: number;
  r: number;
}

export interface SandPatch {
  x: number;
  y: number;
  w: number;
  h: number;
  friction: number;
}

export interface Gate {
  x: number;
  y: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  period: number;
  amplitude: number;
  phase: number;
}

export interface HoleDef {
  index: number;        // 0–8
  par: number;          // 2–4
  canvasW: number;
  canvasH: number;
  tee: { x: number; y: number };
  hole: { x: number; y: number; r: number };
  walls: WallSegment[]; // axis-aligned rectangles, include border walls
  bumpers: Bumper[];
  sand: SandPatch[];
  gate: Gate | null;    // null for holes 0–4, present on holes 5–8
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  status: 'idle' | 'rolling' | 'stopped' | 'sunk';
}
