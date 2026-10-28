export interface Car {
  id: string;
  username: string;
  color: string;
  secondaryColor: string;
  model: 'gt' | 'f1' | 'muscle' | 'hyper';
  lane: number;
  targetLane: number;
  x: number;
  y: number;
  distance: number; // in meters
  speed: number; // km/h
  baseSpeed: number; // km/h
  turboTimer: number;
  nitroTimer: number;
  oilTimer: number;
  stunTimer: number;
  shieldTimer: number;
  rank: number;
  spinAngle: number;
  driftAngle: number;
  badgeOffset?: number;
  finished: boolean;
  finishPosition?: number;
  lastAction?: {
    type: 'TURBO' | 'NITRO' | 'OLEO' | 'MISSEL' | 'ESCUDO';
    timestamp: number;
  };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  secondaryColor?: string;
  alpha: number;
  decay: number;
  type: 'flame' | 'nitro' | 'smoke' | 'spark' | 'explosion' | 'shield' | 'shockwave';
  rotation?: number;
  rotSpeed?: number;
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  alpha: number;
}

export interface MissileProjectile {
  id: string;
  targetCarId: string;
  x: number;
  y: number;
  progress: number;
  actor: string;
  angle: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
  vy: number;
}

export interface LiveGiftNotification {
  id: string;
  username: string;
  giftName: string;
  giftIcon: string;
  action: 'TURBO' | 'NITRO' | 'OLEO' | 'MISSEL' | 'ESCUDO';
  targetUsername?: string;
  timestamp: number;
}

export interface LiveComment {
  id: string;
  username: string;
  comment: string;
  badge?: string;
  isAction?: boolean;
}

export type ActionType = 'TURBO' | 'NITRO' | 'OLEO' | 'MISSEL' | 'ESCUDO';

export type TrackTheme = 'cyber_night' | 'neon_city' | 'sunset_asphalt';
