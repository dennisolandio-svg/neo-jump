export enum GameState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER'
}

export enum ControllerMode {
  KEYBOARD = 'KEYBOARD',
  BUILTIN_MOTION = 'BUILTIN_MOTION',
  TEACHABLE_MACHINE = 'TEACHABLE_MACHINE'
}

export enum GameAction {
  NONE = 'NONE',
  JUMP = 'JUMP',
  CROUCH = 'CROUCH'
}

export interface GameStats {
  score: number;
  highScore: number;
  coins: number;
  distance: number;
  speedMultiplier: number;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  type: 'rock' | 'cactus_small' | 'cactus_tall' | 'bird_low' | 'bird_high';
  frame: number;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  pulseFrame: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface TeachableModelClass {
  className: string;
  probability: number;
}
