import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Trophy, Moon, Award, Info, Flame } from 'lucide-react';
import { GameState, GameAction, GameStats, Obstacle, Coin, Particle } from '../types';
import {
  playJumpSound,
  playCrouchSound,
  playCoinSound,
  playCrashSound,
  playLevelUpSound,
  startBgm,
  stopBgm,
} from '../utils/audio';

// Custom 8-bit color map matrices for character rendering
// 16x16 pixel sprites represented as grids
const SPRITE_SIZE = 16;

// Retro Character Sprite Pixel Matrices
const SPRITES = {
  // Dino / Robot Hero
  RUN_1: [
    '    ██████████  ',
    '   ████████████ ',
    '   ███░████████ ',
    '   ████████████ ',
    '   █████████    ',
    '   ███████████  ',
    '█  ██████████   ',
    '████████████    ',
    ' ██████████     ',
    '  ████████      ',
    '   ███████      ',
    '    ██████      ',
    '     █████      ',
    '     █   ██     ',
    '     ██   █     ',
    '     █          ',
  ],
  RUN_2: [
    '    ██████████  ',
    '   ████████████ ',
    '   ███░████████ ',
    '   ████████████ ',
    '   █████████    ',
    '   ███████████  ',
    '█  ██████████   ',
    '████████████    ',
    ' ██████████     ',
    '  ████████      ',
    '   ███████      ',
    '    ██████      ',
    '     █████      ',
    '     ██  █      ',
    '     █   ██     ',
    '          █     ',
  ],
  JUMP: [
    '    ██████████  ',
    '   ████████████ ',
    '   ███░████████ ',
    '   ████████████ ',
    '   █████████    ',
    '   ███████████  ',
    '█  ██████████   ',
    '████████████    ',
    ' ██████████     ',
    '  ████████      ',
    '   ███████      ',
    '   ██   ██      ',
    '   █     █      ',
    '  ██     ██     ',
    '                ',
    '                ',
  ],
  CROUCH_1: [
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '     ██████████ ',
    '    ████████████',
    '██  ████░███████',
    '████████████████',
    ' ███████████    ',
    '  ████████████  ',
    '   ███████████  ',
    '    █████████   ',
    '     ██   ██    ',
    '     ██   █     ',
    '                ',
  ],
  CROUCH_2: [
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '     ██████████ ',
    '    ████████████',
    '██  ████░███████',
    '████████████████',
    ' ███████████    ',
    '  ████████████  ',
    '   ███████████  ',
    '    █████████   ',
    '     █    ██    ',
    '     ██   ██    ',
    '                ',
  ],
  CRASHED: [
    '    ██████████  ',
    '   ████████████ ',
    '   ███❌████████ ',
    '   ████████████ ',
    '   █████████    ',
    '   ███████████  ',
    '   ██████████   ',
    '██ ████████     ',
    ' █████████      ',
    '  ███████       ',
    '   ███          ',
    '  █   █         ',
    ' ██   ██        ',
    '                ',
    '                ',
    '                ',
  ],
  // Obstacles
  BIRD_DOWN: [
    '      ████      ',
    '     ██████     ',
    '    ████████    ',
    '██████░█░██████ ',
    ' █████████████  ',
    '  ███████████   ',
    '   █████████    ',
    '    ███  ███    ',
    '    ██    ██    ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
  ],
  BIRD_UP: [
    '    ██    ██    ',
    '    ███  ███    ',
    '   █████████    ',
    '  ███████████   ',
    ' █████████████  ',
    '██████░█░██████ ',
    '    ████████    ',
    '     ██████     ',
    '      ████      ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
  ],
};

interface RetroGameCanvasProps {
  activeAction: GameAction;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  stats: GameStats;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
}

type ArtTheme = 'SYNTHWAVE' | 'CLASSIC' | 'FOREST';

export default function RetroGameCanvas({
  activeAction,
  gameState,
  setGameState,
  stats,
  setStats,
}: RetroGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Styling and Sound preferences
  const [theme, setTheme] = useState<ArtTheme>('SYNTHWAVE');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Level Up Milestone check
  const lastLevelMilestone = useRef(0);

  // In-game variables handled with refs for uniform, frame-bound mutability inside canvas tick
  const playerRef = useRef({
    x: 80,
    y: 190, // Ground Y starts (canvasHeight (260) - groundHeight (34) - dinoHeight (36))
    width: 38,
    height: 38,
    vy: 0,
    isGrounded: true,
    isCrouching: false,
    aniFrame: 0,
    runTimer: 0,
  });

  const gameSpeedRef = useRef(4.8);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const backgroundElementsRef = useRef<{ id: number; x: number; y: number; speed: number; size: number }[]>([]);
  const frameCounterRef = useRef(0);
  const nextObstacleDistanceRef = useRef(120);

  // Synchronize BGM
  useEffect(() => {
    if (gameState === GameState.RUNNING && audioEnabled) {
      startBgm();
    } else {
      stopBgm();
    }
    return () => stopBgm();
  }, [gameState, audioEnabled]);

  // Read Keyboard as fallback to make sure controls feel highly testable
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.RUNNING) return;

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        triggerJump();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        playerRef.current.isCrouching = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        playerRef.current.isCrouching = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Synchronize Active Webcam Motion trigger
  useEffect(() => {
    if (gameState !== GameState.RUNNING) return;

    if (activeAction === GameAction.JUMP) {
      triggerJump();
    } else if (activeAction === GameAction.CROUCH) {
      playerRef.current.isCrouching = true;
    } else if (activeAction === GameAction.NONE) {
      playerRef.current.isCrouching = false;
    }
  }, [activeAction, gameState]);

  // Implement physical jump helper
  const triggerJump = () => {
    const p = playerRef.current;
    if (p.isGrounded && !p.isCrouching) {
      p.vy = -10.2; // Smooth gravity jump arcade punch
      p.isGrounded = false;
      if (audioEnabled) {
        playJumpSound();
      }

      // Spawn jumping dust particles
      const count = 6;
      for (let i = 0; i < count; i++) {
        spawnParticle(p.x + p.width / 2, p.y + p.height, {
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * -2,
          color: theme === 'SYNTHWAVE' ? '#ff0055' : theme === 'FOREST' ? '#8bc34a' : '#666',
          size: Math.random() * 3 + 2,
        });
      }
    }
  };

  // Safe sound control toggler
  const toggleSound = () => {
    if (audioEnabled) {
      setAudioEnabled(false);
      stopBgm();
    } else {
      setAudioEnabled(true);
      if (gameState === GameState.RUNNING) {
        startBgm();
      }
    }
  };

  const spawnParticle = (
    x: number,
    y: number,
    options?: { vx?: number; vy?: number; color?: string; size?: number; life?: number }
  ) => {
    particlesRef.current.push({
      id: Math.random() + Date.now(),
      x,
      y,
      vx: options?.vx ?? (Math.random() - 0.5) * 2,
      vy: options?.vy ?? (Math.random() - 0.5) * 2,
      size: options?.size ?? Math.random() * 4 + 1.5,
      color: options?.color ?? '#ff0055',
      alpha: 1.0,
      life: 0,
      maxLife: options?.life ?? Math.random() * 20 + 15,
    });
  };

  // Reset core game states back to beginning
  const startNewGame = () => {
    gameSpeedRef.current = 4.8;
    obstaclesRef.current = [];
    coinsRef.current = [];
    particlesRef.current = [];
    frameCounterRef.current = 0;
    nextObstacleDistanceRef.current = 130;
    lastLevelMilestone.current = 0;

    // Reset Player
    playerRef.current = {
      x: 80,
      y: 190,
      width: 38,
      height: 38,
      vy: 0,
      isGrounded: true,
      isCrouching: false,
      aniFrame: 0,
      runTimer: 0,
    };

    // Seeds slow floating background clouds/wires
    const count = 5;
    backgroundElementsRef.current = Array.from({ length: count }, (_, idx) => ({
      id: idx,
      x: Math.random() * 800,
      y: Math.random() * 100 + 30,
      speed: Math.random() * 0.4 + 0.1,
      size: Math.random() * 40 + 20,
    }));

    setStats((prev) => ({
      ...prev,
      score: 0,
      coins: 0,
      distance: 0,
      speedMultiplier: 1.0,
    }));

    setGameState(GameState.RUNNING);
  };

  // Draw customized procedural pixel-art grids to canvas block context
  const drawProceduralSprite = (
    ctx: CanvasRenderingContext2D,
    spriteRows: string[],
    x: number,
    y: number,
    targetWidth: number,
    targetHeight: number,
    primaryColor: string,
    accentColor?: string
  ) => {
    const pixelW = targetWidth / SPRITE_SIZE;
    const pixelH = targetHeight / SPRITE_SIZE;

    spriteRows.forEach((row, ri) => {
      for (let ci = 0; ci < row.length; ci++) {
        const char = row[ci];
        if (char === '█') {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(Math.floor(x + ci * pixelW), Math.floor(y + ri * pixelH), Math.ceil(pixelW), Math.ceil(pixelH));
        } else if (char === '░') {
          ctx.fillStyle = accentColor ?? '#ffffff';
          ctx.fillRect(Math.floor(x + ci * pixelW), Math.floor(y + ri * pixelH), Math.ceil(pixelW), Math.ceil(pixelH));
        } else if (char === '❌') {
          ctx.fillStyle = '#ff0033';
          ctx.fillRect(Math.floor(x + ci * pixelW), Math.floor(y + ri * pixelH), Math.ceil(pixelW), Math.ceil(pixelH));
        }
      }
    });
  };

  // Core Game Loop Effect Handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const tick = () => {
      // Clear screen base colors based on theme
      if (theme === 'SYNTHWAVE') {
        ctx.fillStyle = '#0f091a'; // Deep arcade violet
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Retromatic sunset glow grid
        ctx.strokeStyle = '#2b1945';
        ctx.lineWidth = 1;
        // Draw vertical wiregrid perspective
        for (let i = -100; i < canvas.width + 100; i += 40) {
          ctx.beginPath();
          ctx.moveTo(canvas.width / 2, 80);
          ctx.lineTo(i, canvas.height - 34);
          ctx.stroke();
        }
        // Draw horizontal receding wirelines
        const horizon = 120;
        const maxLines = 8;
        for (let idx = 0; idx < maxLines; idx++) {
          const ratio = Math.pow(idx / maxLines, 2);
          const drawY = horizon + ratio * (canvas.height - 34 - horizon);
          ctx.beginPath();
          ctx.moveTo(0, drawY);
          ctx.lineTo(canvas.width, drawY);
          ctx.strokeStyle = `rgba(182, 0, 180, ${0.1 + ratio * 0.4})`;
          ctx.stroke();
        }

        // Draw synthwave retro gradient sun
        const grad = ctx.createLinearGradient(0, 10, 0, 100);
        grad.addColorStop(0, '#fe00f6');
        grad.addColorStop(1, '#ffc000');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 75, 40, Math.PI, 0);
        ctx.fill();

        // Sun scanline slots
        ctx.fillStyle = '#0f091a';
        for (let sy = 50; sy < 85; sy += 6) {
          ctx.fillRect(canvas.width / 2 - 45, sy, 90, 2);
        }
      } else if (theme === 'FOREST') {
        // Sky Blue
        ctx.fillStyle = '#daedef';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Sun orb
        ctx.fillStyle = '#fce460';
        ctx.beginPath();
        ctx.arc(700, 50, 18, 0, Math.PI * 2);
        ctx.fill();

        // Draw pixel retro green hills background
        ctx.fillStyle = '#b7e3be';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 34);
        ctx.quadraticCurveTo(200, 140, 400, canvas.height - 34);
        ctx.quadraticCurveTo(600, 150, 800, canvas.height - 34);
        ctx.fill();

        ctx.fillStyle = '#8bc34a';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 34);
        ctx.quadraticCurveTo(150, 180, 300, canvas.height - 34);
        ctx.quadraticCurveTo(550, 170, 800, canvas.height - 34);
        ctx.fill();
      } else {
        // CLASSIC grey dinosaur style
        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Handle running physics and state operations when game is alive
      if (gameState === GameState.RUNNING) {
        frameCounterRef.current++;

        // Increase score steadily with distance run
        if (frameCounterRef.current % 4 === 0) {
          setStats((prev) => {
            const nextScore = prev.score + 1;
            // Highscore synchronization
            const nextHighScore = Math.max(prev.highScore, nextScore);

            // Level up Sound check at intervals of 500
            if (nextScore > 0 && nextScore % 500 === 0 && lastLevelMilestone.current !== nextScore) {
              lastLevelMilestone.current = nextScore;
              if (audioEnabled) playLevelUpSound();
            }

            return {
              ...prev,
              score: nextScore,
              highScore: nextHighScore,
              distance: Math.floor(nextScore * 0.15),
            };
          });
        }

        // Speed increases continuously
        if (frameCounterRef.current % 300 === 0 && gameSpeedRef.current < 12) {
          gameSpeedRef.current += 0.45;
          setStats((prev) => ({
            ...prev,
            speedMultiplier: parseFloat((gameSpeedRef.current / 4.8).toFixed(2)),
          }));
        }

        // Draw and update Background decoration (Cloud floats, perspective grid)
        backgroundElementsRef.current.forEach((el) => {
          el.x -= el.speed * (gameSpeedRef.current / 4.8);
          if (el.x < -el.size) {
            el.x = canvas.width + Math.random() * 100;
            el.y = Math.random() * 80 + 20;
          }

          if (theme === 'SYNTHWAVE') {
            // Neon triangles as low stars/glares
            ctx.fillStyle = 'rgba(254, 0, 246, 0.1)';
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.x + el.size / 2, el.y - el.size / 3);
            ctx.lineTo(el.x + el.size, el.y);
            ctx.closePath();
            ctx.fill();
          } else if (theme === 'FOREST') {
            // Cute fluffy puff clouds
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(el.x, el.y, el.size * 0.35, 0, Math.PI * 2);
            ctx.arc(el.x + el.size * 0.25, el.y - el.size * 0.15, el.size * 0.4, 0, Math.PI * 2);
            ctx.arc(el.x + el.size * 0.5, el.y, el.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Classic monochrome sketchy line cloud
            ctx.strokeStyle = '#d7d7d7';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(el.x, el.y);
            ctx.lineTo(el.x + el.size, el.y);
            ctx.stroke();
          }
        });

        // GROUND RENDERING
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 34);
        ctx.lineTo(canvas.width, canvas.height - 34);
        if (theme === 'SYNTHWAVE') {
          ctx.strokeStyle = '#ff0055';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ff0055';
          ctx.stroke();
          ctx.shadowBlur = 0; // reset glow
        } else if (theme === 'FOREST') {
          ctx.strokeStyle = '#558b2f';
          ctx.lineWidth = 4;
          ctx.stroke();
          // Forest solid soil ground
          ctx.fillStyle = '#795548';
          ctx.fillRect(0, canvas.height - 32, canvas.width, 32);
        } else {
          ctx.strokeStyle = '#535353';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw little retro grass patches on classic ground
          ctx.fillStyle = '#838383';
          for (let gx = 10; gx < canvas.width; gx += 120) {
            const shiftX = (gx + frameCounterRef.current * -gameSpeedRef.current) % canvas.width;
            ctx.fillRect(shiftX, canvas.height - 30, 6, 1);
            ctx.fillRect(shiftX + 12, canvas.height - 28, 4, 1);
          }
        }

        // PLAYER DYNAMICS & COLLISION COMPACTION
        const p = playerRef.current;

        // Apply physical gravity drop
        p.vy += 0.52; // smooth falling gravity rate
        p.y += p.vy;

        // Handle Ground boundaries
        const finalGroundY = canvas.height - 34 - p.height;
        if (p.y >= finalGroundY) {
          p.y = finalGroundY;
          p.vy = 0;
          p.isGrounded = true;
        }

        // Toggle Running dust frames
        p.runTimer += gameSpeedRef.current;
        if (p.runTimer >= 40) {
          p.aniFrame = p.aniFrame === 0 ? 1 : 0;
          p.runTimer = 0;

          // Kick up dust trail when grounded
          if (p.isGrounded && !p.isCrouching) {
            spawnParticle(p.x, p.y + p.height, {
              vx: -1.8,
              vy: (Math.random() - 0.7) * 1.5,
              color: theme === 'SYNTHWAVE' ? '#00f0ff' : theme === 'FOREST' ? '#8bc34a' : '#8c8c8c',
              size: Math.random() * 2 + 1,
            });
          }
        }

        // OBSTACLES SPAWNING SYSTEM
        nextObstacleDistanceRef.current -= 1;
        if (nextObstacleDistanceRef.current <= 0) {
          // Time to spawn! We randomly flip between small cactus, tall cactus, or flying bird
          const rand = Math.random();
          let type: Obstacle['type'] = 'cactus_small';
          let obsW = 20;
          let obsH = 34;
          let spawnY = canvas.height - 34 - obsH;

          if (rand < 0.35) {
            type = 'cactus_small';
            obsW = 22;
            obsH = 32;
            spawnY = canvas.height - 34 - obsH;
          } else if (rand < 0.60) {
            type = 'cactus_tall';
            obsW = 26;
            obsH = 42;
            spawnY = canvas.height - 34 - obsH;
          } else if (rand < 0.80) {
            type = 'rock';
            obsW = 32;
            obsH = 15;
            spawnY = canvas.height - 34 - obsH;
          } else {
            // Flying retro Bird!
            type = Math.random() > 0.5 ? 'bird_low' : 'bird_high';
            obsW = 32;
            obsH = 26;
            // bird_low must be ducked under or jumped over, bird_high can be run under easily
            spawnY = type === 'bird_low' ? canvas.height - 68 : canvas.height - 88;
          }

          obstaclesRef.current.push({
            id: Date.now() + Math.random(),
            x: canvas.width + 10,
            y: spawnY,
            width: obsW,
            height: obsH,
            speedX: -gameSpeedRef.current,
            type,
            frame: 0,
          });

          // Set randomized interval padding for next obstacle based on current speed (prevent impossible jumps)
          nextObstacleDistanceRef.current = Math.floor(Math.random() * 80) + 100 + (gameSpeedRef.current * 1.5);
        }

        // COINS / STARS GOLD BONUS SPAWNING
        if (frameCounterRef.current % 180 === 0) {
          // Spawn a collectable coin floating at ideal jump levels
          const count = Math.random() > 0.5 ? 2 : 1;
          for (let c = 0; c < count; c++) {
            coinsRef.current.push({
              id: Date.now() + Math.random() + c,
              x: canvas.width + 40 + c * 35,
              y: canvas.height - 34 - (Math.random() * 45 + 50),
              radius: 6,
              collected: false,
              pulseFrame: 0,
            });
          }
        }

        // UPDATE OBSTACLES AND ASSESS LOSS STATE
        obstaclesRef.current = obstaclesRef.current.filter((obs) => {
          obs.x += obs.speedX;

          // Birds flap wing flap animations
          if (obs.type === 'bird_low' || obs.type === 'bird_high') {
            if (frameCounterRef.current % 8 === 0) {
              obs.frame = obs.frame === 0 ? 1 : 0;
            }
          }

          // Collisions Box Checks (shrink box hit margins slightly for responsive, friendly play!)
          const playerCrouching = p.isCrouching && p.isGrounded;
          const pHitY = playerCrouching ? p.y + 14 : p.y;
          const pHitH = playerCrouching ? p.height - 14 : p.height;
          const pHitW = p.width - 8;

          const isColliding =
            p.x + 4 < obs.x + obs.width &&
            p.x + 4 + pHitW > obs.x &&
            pHitY + 2 < obs.y + obs.height &&
            pHitY + pHitH > obs.y + 2;

          if (isColliding) {
            // WHACK! Crash Triggered
            setGameState(GameState.GAMEOVER);
            if (audioEnabled) {
              playCrashSound();
            }

            // Explode player particles details
            for (let i = 0; i < 24; i++) {
              spawnParticle(p.x + p.width / 2, p.y + p.height / 2, {
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 2,
                color: theme === 'SYNTHWAVE' ? '#fe00f6' : theme === 'FOREST' ? '#ffeb3b' : '#333333',
                size: Math.random() * 5 + 3,
                life: Math.random() * 32 + 20,
              });
            }
          }

          // Filter out escaped obstacles
          return obs.x > -obs.width;
        });

        // UPDATE COINS & SEED PICKS
        coinsRef.current = coinsRef.current.filter((coin) => {
          coin.x -= gameSpeedRef.current;
          coin.pulseFrame += 0.15;

          // Bounding box collision check for coin
          const playerCrouching = p.isCrouching && p.isGrounded;
          const pHitY = playerCrouching ? p.y + 14 : p.y;
          const pHitH = playerCrouching ? p.height - 14 : p.height;

          const isCollected =
            p.x < coin.x + coin.radius * 2 &&
            p.x + p.width > coin.x &&
            pHitY < coin.y + coin.radius * 2 &&
            pHitY + pHitH > coin.y - coin.radius;

          if (isCollected && !coin.collected) {
            coin.collected = true;
            setStats((prev) => ({
              ...prev,
              coins: prev.coins + 1,
              score: prev.score + 100, // 100 bonus marks per gold coin
            }));

            if (audioEnabled) {
              playCoinSound();
            }

            // Sparkle burst elements
            const count = 10;
            for (let i = 0; i < count; i++) {
              const rad = Math.random() * Math.PI * 2;
              const sp = Math.random() * 3.5 + 1.2;
              spawnParticle(coin.x, coin.y, {
                vx: Math.cos(rad) * sp,
                vy: Math.sin(rad) * sp,
                color: '#ffd700',
                size: Math.random() * 3 + 1,
              });
            }
          }

          return coin.x > -50 && !coin.collected;
        });
      }

      // PARTICLES UPDATES (Alive regardless of collision state)
      particlesRef.current = particlesRef.current.filter((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life += 1;
        pt.alpha = 1.0 - pt.life / pt.maxLife;

        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.alpha;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.globalAlpha = 1.0; // reset

        return pt.life < pt.maxLife;
      });

      // RENDER REMAINING ACTIVE GAME-WORLD OBJECTS
      const p = playerRef.current;
      const isCrouchPose = p.isCrouching && p.isGrounded;

      // Determine Sprite Matrix based on state
      let characterSprite = SPRITES.RUN_1;
      if (gameState === GameState.GAMEOVER) {
        characterSprite = SPRITES.CRASHED;
      } else if (!p.isGrounded) {
        characterSprite = SPRITES.JUMP;
      } else if (isCrouchPose) {
        characterSprite = p.aniFrame === 0 ? SPRITES.CROUCH_1 : SPRITES.CROUCH_2;
      } else {
        characterSprite = p.aniFrame === 0 ? SPRITES.RUN_1 : SPRITES.RUN_2;
      }

      // Set character skin color
      let skinColor = '#00f0ff'; // laser teal default
      let innerColor: string | undefined = undefined;

      if (theme === 'SYNTHWAVE') {
        skinColor = '#00f0ff';
        innerColor = '#ff2a85';
      } else if (theme === 'FOREST') {
        skinColor = '#ec407a';
        innerColor = '#fff176';
      } else {
        skinColor = '#535353';
        innerColor = '#b3b3b3';
      }

      // Render Player sprite matrix onto canvas
      drawProceduralSprite(
        ctx,
        characterSprite,
        p.x,
        p.isCrouching && p.isGrounded ? p.y + 10 : p.y, // adjust crouch drawing level offset
        p.width,
        p.height,
        skinColor,
        innerColor
      );

      // Render Obstacles (rocks, cactus groupings, flying birds)
      obstaclesRef.current.forEach((obs) => {
        let obsColor = '#f26101';
        let accessoryColor = '#cc00cc';

        if (theme === 'SYNTHWAVE') {
          obsColor = '#fe00f6';
          accessoryColor = '#00f0ff';
        } else if (theme === 'FOREST') {
          obsColor = '#4caf50';
          accessoryColor = '#388e3c';
        } else {
          obsColor = '#535353';
          accessoryColor = '#a8a8a8';
        }

        if (obs.type === 'bird_low' || obs.type === 'bird_high') {
          // procedural pterodactyl wing flap
          const birdSprite = obs.frame === 0 ? SPRITES.BIRD_DOWN : SPRITES.BIRD_UP;
          drawProceduralSprite(
            ctx,
            birdSprite,
            obs.x,
            obs.y,
            obs.width,
            obs.height,
            theme === 'SYNTHWAVE' ? '#00f0ff' : '#d84315',
            '#ffeb3b'
          );
        } else if (obs.type === 'cactus_small' || obs.type === 'cactus_tall') {
          // Render procedural cactus shapes
          ctx.fillStyle = obsColor;
          ctx.fillRect(obs.x, obs.y + 10, obs.width, obs.height - 10);
          // center stem line
          ctx.fillStyle = accessoryColor;
          ctx.fillRect(obs.x + obs.width / 2 - 2, obs.y, 4, obs.height);
          // branch left
          ctx.fillRect(obs.x, obs.y + obs.height * 0.3, obs.width / 2, 4);
          ctx.fillRect(obs.x, obs.y + obs.height * 0.1, 4, obs.height * 0.2);
          // branch right
          ctx.fillRect(obs.x + obs.width / 2, obs.y + obs.height * 0.45, obs.width / 2, 4);
          ctx.fillRect(obs.x + obs.width - 4, obs.y + obs.height * 0.2, 4, obs.height * 0.25);
        } else {
          // Rock/boulder obstacle
          ctx.fillStyle = obsColor;
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.height);
          ctx.lineTo(obs.x + obs.width * 0.2, obs.y + obs.height * 0.2);
          ctx.lineTo(obs.x + obs.width * 0.7, obs.y + obs.height * 0.1);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = accessoryColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.width * 0.2, obs.y + obs.height * 0.5);
          ctx.lineTo(obs.x + obs.width * 0.6, obs.y + obs.height * 0.4);
          ctx.stroke();
        }
      });

      // Render Floating Collectable golden coins
      coinsRef.current.forEach((coin) => {
        const pulse = Math.abs(Math.sin(coin.pulseFrame)) * 1.5;
        const colorGrad = ctx.createRadialGradient(
          coin.x,
          coin.y,
          1,
          coin.x,
          coin.y,
          coin.radius + pulse
        );
        colorGrad.addColorStop(0, '#fff176');
        colorGrad.addColorStop(0.7, '#ffca28');
        colorGrad.addColorStop(1, '#cb6d00');

        ctx.fillStyle = colorGrad;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Little inner geometric block to represent pixel-star center
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(coin.x - 1.5, coin.y - 1.5, 3, 3);
      });

      // CONTINUOUS LOOP TRIGGER
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gameState, theme, audioEnabled]);

  return (
    <div id="retro_arcade_cabinet" className="w-full flex flex-col items-center select-none font-mono">
      
      {/* Control Strip & Styling Selector */}
      <div className="w-full flex flex-wrap items-center justify-between bg-white border-4 border-b-0 border-black p-3.5 gap-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-black shrink-0" />
          <span className="text-xs uppercase font-black tracking-wider text-black">
            🎮 8-Bit Arcade Engine v1.0
          </span>
        </div>

        {/* Theme select controls */}
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-black text-black uppercase">SKIN:</label>
          <div className="flex bg-gray-100 border-2 border-black p-0.5">
            <button
              id="theme_synth"
              onClick={() => setTheme('SYNTHWAVE')}
              className={`px-2 py-1 text-[9px] font-black uppercase transition-all duration-100 ${
                theme === 'SYNTHWAVE' ? 'bg-black text-white' : 'text-black hover:bg-gray-200'
              }`}
            >
              🌌 Synth
            </button>
            <button
              id="theme_forest"
              onClick={() => setTheme('FOREST')}
              className={`px-2 py-1 text-[9px] font-black uppercase transition-all duration-100 ${
                theme === 'FOREST' ? 'bg-green-600 text-white' : 'text-black hover:bg-gray-200'
              }`}
            >
              🌳 Forest
            </button>
            <button
              id="theme_classic"
              onClick={() => setTheme('CLASSIC')}
              className={`px-2 py-1 text-[9px] font-black uppercase transition-all duration-100 ${
                theme === 'CLASSIC' ? 'bg-gray-600 text-white' : 'text-black hover:bg-gray-200'
              }`}
            >
              🦖 Classic
            </button>
          </div>

          {/* Sound hardware button */}
          <button
            id="synth_audio_toggle"
            onClick={toggleSound}
            className={`p-1.5 border-2 border-black transition active:scale-95 ${
              audioEnabled
                ? 'bg-yellow-300 text-black hover:bg-yellow-400'
                : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-black" /> : <VolumeX className="w-4 h-4 text-black" />}
          </button>
        </div>
      </div>

      {/* Screen Frame of Canvas */}
      <div className="relative w-full aspect-[800/260] max-w-full bg-black border-4 border-black overflow-hidden shadow-brutal select-none">
        <canvas
          ref={canvasRef}
          width={800}
          height={260}
          className="w-full h-full block image-render-retro"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Scanline CRT Arcade Glow effect overlay */}
        <div className="absolute inset-0 pointer-events-none bg-scanlines opacity-[0.06] z-10" />

        {/* Overlay Screen states */}
        {gameState === GameState.IDLE && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-20 animate-fade-in_mild">
            <div className="bg-white border-4 border-black p-6 md:p-8 max-w-md shadow-brutal-sm text-center">
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black mb-2">
                NEURO-RUNNER 8-BIT
              </h1>
              <p className="text-[11px] text-gray-800 leading-relaxed mb-6 font-semibold uppercase">
                Jump over high barriers and crouch under flying birds! Works seamlessly using custom webcam poses or standard keyboard keys.
              </p>
              <button
                id="play_start_btn"
                onClick={startNewGame}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FF4444] text-white hover:bg-red-600 border-4 border-black font-black uppercase text-xs tracking-wider shadow-brutal-sm hover:scale-105 active:scale-95 duration-100"
              >
                <Play className="w-4 h-4 fill-white text-white" /> Start Arcade Run
              </button>
            </div>
          </div>
        )}

        {/* Gameover Overlay screen */}
        {gameState === GameState.GAMEOVER && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center z-20">
            <div className="bg-[#FF4444] text-white border-4 border-black p-6 md:p-8 max-w-sm shadow-brutal-white text-center">
              <h2 className="text-3xl font-black uppercase tracking-wider mb-2 text-white animate-bounce">
                CRASHED!
              </h2>
              <p className="text-xs text-white font-extrabold bg-black px-3 py-1.5 uppercase tracking-widest mb-6 inline-block">
                Final Score: {stats.score} pt
              </p>
              <div>
                <button
                  id="play_retry_btn"
                  onClick={startNewGame}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-105 border-4 border-black font-black uppercase text-xs tracking-wider shadow-brutal-sm hover:scale-105 duration-100"
                >
                  <RotateCcw className="w-4 h-4 stroke-[3]" /> RESTART STAGE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Arcade cabinet margin detail */}
      <div className="w-full h-4 bg-white border-4 border-t-0 border-black mb-6 shadow-brutal-sm" />
    </div>
  );
}
