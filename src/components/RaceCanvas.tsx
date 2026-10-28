import React, { useEffect, useRef } from 'react';
import { Car, Particle, SkidMark, MissileProjectile, FloatingText, ActionType, TrackTheme } from '../types/game';
import { soundEngine } from '../utils/audio';

interface RaceCanvasProps {
  cars: Car[];
  raceDuration: number;
  timeLeft: number;
  isFinished: boolean;
  soundEnabled: boolean;
  trackTheme?: TrackTheme;
}

export const CAR_COLORS = [
  '#ef4444', // 1 Vermelho Ferrari
  '#3b82f6', // 2 Azul Elétrico
  '#10b981', // 3 Verde Esmeralda
  '#f59e0b', // 4 Amarelo Ouro
  '#8b5cf6', // 5 Roxo Neon
  '#ec4899', // 6 Rosa Choque
  '#06b6d4', // 7 Ciano Glacial
  '#eab308', // 8 Dourado Metálico
  '#14b8a6', // 9 Turquesa
  '#f97316', // 10 Laranja McLaren
  '#a855f7', // 11 Violeta Cyber
  '#6366f1'  // 12 Índigo Sport
];

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  cars,
  raceDuration,
  timeLeft,
  isFinished,
  soundEnabled,
  trackTheme = 'cyber_night'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable refs for 60 FPS performance
  const carsRef = useRef<Car[]>(cars);
  carsRef.current = cars;

  const particlesRef = useRef<Particle[]>([]);
  const skidMarksRef = useRef<SkidMark[]>([]);
  const missilesRef = useRef<MissileProjectile[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const scrollYRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const finishedRef = useRef<boolean>(isFinished);
  finishedRef.current = isFinished;

  const screenShakeRef = useRef<number>(0);
  const speedLinesRef = useRef<{ x: number; y: number; length: number; speed: number; alpha: number }[]>([]);

  useEffect(() => {
    soundEngine.enabled = soundEnabled;
  }, [soundEnabled]);

  // Initialize speed lines
  useEffect(() => {
    const lines = [];
    for (let i = 0; i < 28; i++) {
      lines.push({
        x: Math.random() * 450,
        y: Math.random() * 800,
        length: Math.random() * 50 + 30,
        speed: Math.random() * 20 + 25,
        alpha: Math.random() * 0.35 + 0.1
      });
    }
    speedLinesRef.current = lines;
  }, []);

  // Main 60 FPS Canvas Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const gameLoop = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // ----------------------------------------------------
      // SIMULATION UPDATE
      // ----------------------------------------------------
      const currentCars = carsRef.current;
      const particles = particlesRef.current;
      const skidMarks = skidMarksRef.current;
      const missiles = missilesRef.current;
      const floatingTexts = floatingTextsRef.current;

      const roadLeft = 32;
      const roadRight = canvas.width - 32;
      const roadWidth = roadRight - roadLeft;
      const laneCount = 6; // 6 faixas para comportar até 12 carros com folga
      const laneWidth = roadWidth / laneCount;

      // Decay screen shake
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 15);
      }

      // ONLY UPDATE MOVEMENT IF RACE IS NOT FROZEN (TIME HAS NOT RUN OUT)
      if (!finishedRef.current && currentCars.length > 0) {
        // Find max leader distance
        let maxDist = 0;
        for (const c of currentCars) {
          if (c.distance > maxDist) maxDist = c.distance;
        }

        // Scroll track proportional to pack speed
        const avgSpeed = currentCars.reduce((acc, c) => acc + c.speed, 0) / currentCars.length;
        const scrollStep = (avgSpeed / 200) * 18;
        scrollYRef.current = (scrollYRef.current + scrollStep) % 10000;

        currentCars.forEach((car, index) => {
          // Decrement effect timers
          if (car.turboTimer > 0) car.turboTimer -= dt;
          if (car.nitroTimer > 0) car.nitroTimer -= dt;

          if (car.oilTimer > 0) {
            car.oilTimer -= dt;
            car.spinAngle += dt * 14;
            // Record skid marks continuously during oil slip
            if (Math.random() < 0.4) {
              skidMarks.push({
                x1: car.x - 9,
                y1: car.y + 10,
                x2: car.x - 9 + Math.sin(car.spinAngle) * 5,
                y2: car.y + 22,
                width: 3,
                alpha: 0.7
              });
              skidMarks.push({
                x1: car.x + 9,
                y1: car.y + 10,
                x2: car.x + 9 + Math.sin(car.spinAngle) * 5,
                y2: car.y + 22,
                width: 3,
                alpha: 0.7
              });
            }
          } else {
            car.spinAngle = 0;
          }

          if (car.stunTimer > 0) car.stunTimer -= dt;
          if (car.shieldTimer > 0) car.shieldTimer -= dt;

          // Compute car dynamic speed (balanced for 90s competitive endurance)
          let speed = car.baseSpeed;
          if (car.turboTimer > 0) speed += 125;
          if (car.nitroTimer > 0) speed += 65;
          if (car.oilTimer > 0) speed *= 0.45;
          if (car.stunTimer > 0) speed *= 0.25;

          // Organic overtakes & slipstream simulation
          speed += Math.sin(now * 0.0022 + index * 1.5) * 8;
          car.speed = Math.max(25, speed);

          // Update distance (km/h to m/s)
          car.distance += (car.speed / 3.6) * dt;

          // Smooth lane X interpolation with subtle steering drift tilt
          const targetX = roadLeft + (car.lane + 0.5) * laneWidth;
          const diffX = targetX - car.x;
          car.x += diffX * 0.12;
          car.driftAngle = Math.max(-0.25, Math.min(0.25, diffX * 0.02));

          // Camera Y placement (Leader placed at 68% height, pack spread visually)
          const relativeDist = car.distance - maxDist;
          const baseY = canvas.height * 0.68;
          car.y = baseY - relativeDist * 4.4;
          // Keep bounded on canvas
          car.y = Math.max(125, Math.min(canvas.height - 75, car.y));

          // Autonomous overtake AI: switch lanes occasionally across 6 lanes
          if (Math.random() < 0.009 && car.oilTimer <= 0) {
            const delta = Math.random() > 0.5 ? 1 : -1;
            car.lane = Math.max(0, Math.min(laneCount - 1, car.lane + delta));
          }

          // Particle Emitters
          // 1. TURBO
          if (car.turboTimer > 0) {
            screenShakeRef.current = Math.max(screenShakeRef.current, 1.5);
            [-6, 6].forEach((side) => {
              particles.push({
                x: car.x + side + (Math.random() * 2 - 1),
                y: car.y + 24,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 8 + 8,
                size: Math.random() * 6 + 4,
                color: '#ffffff',
                secondaryColor: Math.random() > 0.4 ? '#f97316' : '#ef4444',
                alpha: 1,
                decay: 0.06,
                type: 'flame'
              });

              if (Math.random() < 0.4) {
                particles.push({
                  x: car.x + side,
                  y: car.y + 26,
                  vx: (Math.random() - 0.5) * 4,
                  vy: Math.random() * 9 + 5,
                  size: Math.random() * 3 + 1,
                  color: '#fbbf24',
                  alpha: 1,
                  decay: 0.04,
                  type: 'spark'
                });
              }
            });
          }

          // 2. NITRO
          if (car.nitroTimer > 0) {
            [-5, 5].forEach((side) => {
              particles.push({
                x: car.x + side,
                y: car.y + 24,
                vx: (Math.random() - 0.5) * 1.5,
                vy: Math.random() * 9 + 6,
                size: Math.random() * 5 + 3,
                color: '#67e8f9',
                secondaryColor: '#06b6d4',
                alpha: 0.95,
                decay: 0.05,
                type: 'nitro'
              });
            });
          }

          // 3. OIL
          if (car.oilTimer > 0) {
            particles.push({
              x: car.x + (Math.random() * 14 - 7),
              y: car.y + 16,
              vx: (Math.random() - 0.5) * 2.5,
              vy: Math.random() * 3 + 1,
              size: Math.random() * 6 + 3,
              color: '#0f172a',
              secondaryColor: '#334155',
              alpha: 0.85,
              decay: 0.03,
              type: 'smoke'
            });
          }
        });

        // Update Leaderboard Rankings by Distance
        currentCars.sort((a, b) => b.distance - a.distance);
        currentCars.forEach((c, idx) => {
          c.rank = idx + 1;
        });

        // ----------------------------------------------------
        // ANTI-OVERLAPPING TAG ELEVATION SOLVER
        // Ensures username tags NEVER overlap when cars are side-by-side
        // ----------------------------------------------------
        for (let i = 0; i < currentCars.length; i++) {
          currentCars[i].badgeOffset = 0;
        }
        for (let i = 0; i < currentCars.length; i++) {
          for (let j = i + 1; j < currentCars.length; j++) {
            const c1 = currentCars[i];
            const c2 = currentCars[j];
            const dx = Math.abs(c1.x - c2.x);
            const dy = Math.abs(c1.y - c2.y);
            // If cars are close horizontally and vertically, raise one tag
            if (dx < 64 && dy < 28) {
              if (c1.rank < c2.rank) {
                c1.badgeOffset = 18; // higher rank gets top elevation
              } else {
                c2.badgeOffset = 18;
              }
            }
          }
        }
      }

      // Update Missiles
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        const target = currentCars.find((c) => c.id === m.targetCarId);
        if (!target) {
          missiles.splice(i, 1);
          continue;
        }

        m.progress += dt * 1.6;
        const targetY = target.y;
        const targetX = target.x;

        const dx = targetX - m.x;
        const dy = targetY - m.y;
        m.angle = Math.atan2(dy, dx) - Math.PI / 2;

        m.x += dx * 0.18;
        m.y += dy * 0.22;

        particles.push({
          x: m.x,
          y: m.y + 12,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 5 + 3,
          size: Math.random() * 5 + 3,
          color: '#fbbf24',
          secondaryColor: '#64748b',
          alpha: 0.9,
          decay: 0.05,
          type: 'smoke'
        });

        if (m.progress >= 1 || Math.hypot(dx, dy) < 18) {
          missiles.splice(i, 1);
          screenShakeRef.current = 6;

          if (target.shieldTimer > 0) {
            soundEngine.playShield();
            floatingTexts.push({
              id: 'ft_' + Date.now(),
              x: target.x,
              y: target.y - 42,
              text: '🛡️ ESCUDO!',
              color: '#c084fc',
              alpha: 1,
              scale: 1.2,
              vy: -25
            });
            for (let s = 0; s < 18; s++) {
              const a = (s / 18) * Math.PI * 2;
              particles.push({
                x: target.x + Math.cos(a) * 30,
                y: target.y + Math.sin(a) * 30,
                vx: Math.cos(a) * 5,
                vy: Math.sin(a) * 5,
                size: 4,
                color: '#c084fc',
                alpha: 1,
                decay: 0.05,
                type: 'spark'
              });
            }
          } else {
            soundEngine.playMissileExplosion();
            target.stunTimer = 2.4;
            floatingTexts.push({
              id: 'ft_' + Date.now(),
              x: target.x,
              y: target.y - 42,
              text: '💥 EXPLOSÃO!',
              color: '#f87171',
              alpha: 1,
              scale: 1.3,
              vy: -28
            });

            particles.push({
              x: target.x,
              y: target.y,
              vx: 0,
              vy: 0,
              size: 15,
              color: '#ffffff',
              alpha: 1,
              decay: 0.04,
              type: 'shockwave'
            });

            for (let e = 0; e < 35; e++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = Math.random() * 8 + 3;
              particles.push({
                x: target.x,
                y: target.y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                size: Math.random() * 9 + 4,
                color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
                secondaryColor: '#fef08a',
                alpha: 1,
                decay: 0.035,
                type: 'explosion'
              });
            }
          }
        }
      }

      // Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.type === 'shockwave') {
          p.size += 6;
        } else {
          p.size *= 0.96;
        }

        if (p.alpha <= 0 || p.size <= 0.4) {
          particles.splice(i, 1);
        }
      }

      // Update Floating Texts
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.alpha -= dt * 0.9;
        if (ft.alpha <= 0) {
          floatingTexts.splice(i, 1);
        }
      }

      // Update Skid Marks
      for (let i = skidMarks.length - 1; i >= 0; i--) {
        if (!finishedRef.current) {
          skidMarks[i].y1 += 7;
          skidMarks[i].y2 += 7;
        }
        skidMarks[i].alpha -= 0.005;
        if (skidMarks[i].alpha <= 0 || skidMarks[i].y1 > canvas.height + 60) {
          skidMarks.splice(i, 1);
        }
      }

      // Update Speed Lines (only when active)
      if (!finishedRef.current) {
        speedLinesRef.current.forEach((line) => {
          line.y += line.speed;
          if (line.y > canvas.height + line.length) {
            line.y = -line.length;
            line.x = Math.random() * canvas.width;
          }
        });
      }

      // ----------------------------------------------------
      // RENDER CANVAS (EXACT VISUAL IDENTITY)
      // ----------------------------------------------------
      ctx.save();

      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current * 4;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current * 4;
        ctx.translate(shakeX, shakeY);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. TARMAC & ROAD BASE (Deep asphalt with textured gradient)
      const asphaltGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      asphaltGrad.addColorStop(0, '#070a12');
      asphaltGrad.addColorStop(roadLeft / canvas.width, '#0f172a');
      asphaltGrad.addColorStop(0.5, '#151f33');
      asphaltGrad.addColorStop(roadRight / canvas.width, '#0f172a');
      asphaltGrad.addColorStop(1, '#070a12');

      ctx.fillStyle = asphaltGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#172033';
      ctx.fillRect(roadLeft, 0, roadWidth, canvas.height);

      // Tire wear groove lines on asphalt
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      for (let i = 0; i < laneCount; i++) {
        const laneCenterX = roadLeft + (i + 0.5) * laneWidth;
        ctx.fillRect(laneCenterX - 10, 0, 3.5, canvas.height);
        ctx.fillRect(laneCenterX + 6, 0, 3.5, canvas.height);
      }

      // 2. 3D BEVELED ZEBRAS (CURB STONES)
      const curbWidth = 10;
      const curbSegment = 26;
      const trackScroll = scrollYRef.current;

      for (let y = -curbSegment * 2; y < canvas.height + curbSegment * 2; y += curbSegment) {
        const segmentIndex = Math.floor((y + trackScroll) / curbSegment);
        const isRed = segmentIndex % 2 === 0;
        const curY = y + (trackScroll % curbSegment);

        // Left curb
        ctx.fillStyle = isRed ? '#dc2626' : '#f8fafc';
        ctx.fillRect(roadLeft - curbWidth, curY, curbWidth, curbSegment);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(roadLeft - curbWidth, curY + curbSegment - 2, curbWidth, 2);

        // Right curb
        ctx.fillStyle = isRed ? '#dc2626' : '#f8fafc';
        ctx.fillRect(roadRight, curY, curbWidth, curbSegment);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(roadRight, curY + curbSegment - 2, curbWidth, 2);
      }

      // Neon Guardrails
      const railGlowLeft = ctx.createLinearGradient(roadLeft - curbWidth - 4, 0, roadLeft - curbWidth, 0);
      railGlowLeft.addColorStop(0, 'rgba(6, 182, 212, 0)');
      railGlowLeft.addColorStop(1, 'rgba(6, 182, 212, 0.4)');
      ctx.fillStyle = railGlowLeft;
      ctx.fillRect(roadLeft - curbWidth - 4, 0, 4, canvas.height);

      const railGlowRight = ctx.createLinearGradient(roadRight + curbWidth, 0, roadRight + curbWidth + 4, 0);
      railGlowRight.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
      railGlowRight.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = railGlowRight;
      ctx.fillRect(roadRight + curbWidth, 0, 4, canvas.height);

      // Neon chevrons on verges
      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
      for (let y = -80; y < canvas.height + 80; y += 120) {
        const curY = y + (trackScroll % 120);
        ctx.beginPath();
        ctx.moveTo(10, curY + 12);
        ctx.lineTo(20, curY);
        ctx.lineTo(10, curY - 12);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(canvas.width - 10, curY + 12);
        ctx.lineTo(canvas.width - 20, curY);
        ctx.lineTo(canvas.width - 10, curY - 12);
        ctx.fill();
      }

      // 3. DASHED LANE DIVIDERS (6 Faixas)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -trackScroll;

      for (let i = 1; i < laneCount; i++) {
        const lx = roadLeft + i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, canvas.height);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 4. SKID MARKS
      skidMarks.forEach((sm) => {
        ctx.save();
        ctx.strokeStyle = `rgba(15, 23, 42, ${sm.alpha * 0.75})`;
        ctx.lineWidth = sm.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sm.x1, sm.y1);
        ctx.lineTo(sm.x2, sm.y2);
        ctx.stroke();
        ctx.restore();
      });

      // 5. SPEED LINES
      if (!finishedRef.current) {
        ctx.save();
        speedLinesRef.current.forEach((line) => {
          ctx.strokeStyle = `rgba(255, 255, 255, ${line.alpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(line.x, line.y);
          ctx.lineTo(line.x, line.y + line.length);
          ctx.stroke();
        });
        ctx.restore();
      }

      // 6. RENDER CARS (COM FARÓIS, UNDERGLOW E TAGS ANTI-SOBREPOSIÇÃO)
      currentCars.forEach((car) => {
        renderHighFidelityCar(ctx, car);
      });

      // 7. MISSILES
      missiles.forEach((m) => {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);

        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(5, 5);
        ctx.lineTo(3, 7);
        ctx.lineTo(-3, 7);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-2, 7);
        ctx.lineTo(0, 14);
        ctx.lineTo(2, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        const target = currentCars.find((c) => c.id === m.targetCarId);
        if (target) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(target.x, target.y, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });

      // 8. PARTICLES
      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);

        if (p.type === 'shockwave') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.type === 'flame' || p.type === 'nitro') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, p.secondaryColor || 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // 9. FLOATING COMBAT TEXT
      floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = '900 11px sans-serif';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [trackTheme]);

  return (
    <canvas
      ref={canvasRef}
      id="gameCanvas"
      width={450}
      height={800}
      className="w-full h-full block bg-[#070a12] select-none"
    />
  );
};

// ==========================================
// DETAILED HIGH-FIDELITY CAR RENDERER (12 CARS BALANCED)
// ==========================================
function renderHighFidelityCar(ctx: CanvasRenderingContext2D, car: Car) {
  ctx.save();
  ctx.translate(car.x, car.y);

  if (car.spinAngle !== 0) {
    ctx.rotate(car.spinAngle);
  } else if (car.driftAngle) {
    ctx.rotate(car.driftAngle);
  }

  const w = 22; // dimensionado para 12 carros com folga nas faixas
  const h = 46;

  // 1. DYNAMIC HEADLIGHT BEAMS (Forward light cone onto the dark asphalt)
  const headlightGrad = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 - 105);
  headlightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
  headlightGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.16)');
  headlightGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

  ctx.fillStyle = headlightGrad;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 3, -h / 2);
  ctx.lineTo(-w / 2 - 20, -h / 2 - 100);
  ctx.lineTo(w / 2 + 20, -h / 2 - 100);
  ctx.lineTo(w / 2 - 3, -h / 2);
  ctx.closePath();
  ctx.fill();

  // 2. DYNAMIC NEON UNDERGLOW
  const underglowColor = car.turboTimer > 0 ? '#f97316' : car.nitroTimer > 0 ? '#06b6d4' : car.color;
  const underglowGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 32);
  underglowGrad.addColorStop(0, underglowColor + '55');
  underglowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = underglowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();

  // 3. DROP SHADOW
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2, -h / 2 + 3, w, h + 2, 7);
  ctx.fill();

  // 4. TIRES WITH ALLOY RIMS
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-w / 2 - 3, -h / 2 + 6, 4, 10);
  ctx.fillRect(w / 2 - 1, -h / 2 + 6, 4, 10);
  ctx.fillRect(-w / 2 - 3, h / 2 - 16, 4, 11);
  ctx.fillRect(w / 2 - 1, h / 2 - 16, 4, 11);

  // Wheel rim highlights
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-w / 2 - 2, -h / 2 + 9, 2, 4);
  ctx.fillRect(w / 2, -h / 2 + 9, 2, 4);
  ctx.fillRect(-w / 2 - 2, h / 2 - 13, 2, 5);
  ctx.fillRect(w / 2, h / 2 - 13, 2, 5);

  // 5. MAIN CHASSIS (Supercar Aerodynamic Body with Specular Sheen)
  const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  bodyGrad.addColorStop(0, car.color);
  bodyGrad.addColorStop(0.35, '#ffffff33');
  bodyGrad.addColorStop(0.7, car.color);
  bodyGrad.addColorStop(1, '#00000044');

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 7);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Front Splitter / Canards
  ctx.fillStyle = '#090d16';
  ctx.fillRect(-w / 2 + 2, -h / 2 - 2, w - 4, 2.5);

  // Center Dual Racing Stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.fillRect(-2.5, -h / 2 + 2, 1.8, h - 8);
  ctx.fillRect(0.7, -h / 2 + 2, 1.8, h - 8);

  // 6. WINDSHIELD
  const glassGrad = ctx.createLinearGradient(0, -h / 2 + 11, 0, -h / 2 + 22);
  glassGrad.addColorStop(0, '#38bdf8');
  glassGrad.addColorStop(0.5, '#0284c7');
  glassGrad.addColorStop(1, '#075985');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, -h / 2 + 12, w - 6, 10, 2);
  ctx.fill();

  // Glass reflection diagonal stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 5, -h / 2 + 13);
  ctx.lineTo(-w / 2 + 8, -h / 2 + 13);
  ctx.lineTo(-w / 2 + 5, -h / 2 + 21);
  ctx.closePath();
  ctx.fill();

  // 7. ROOF & COCKPIT
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 4, -h / 2 + 22, w - 8, 11, 2);
  ctx.fill();

  // 8. REAR WINDOW
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 33, w - 8, 3.5);

  // 9. REAR SPOILER / CARBON WING
  ctx.fillStyle = '#020617';
  ctx.fillRect(-w / 2 - 1, h / 2 - 5, w + 2, 3.5);
  ctx.fillStyle = car.color;
  ctx.fillRect(-w / 2 - 1, h / 2 - 7, 2, 5);
  ctx.fillRect(w / 2 - 1, h / 2 - 7, 2, 5);

  // 10. REAR EXHAUSTS
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-6, h / 2 - 2, 2.5, 2.5);
  ctx.fillRect(3.5, h / 2 - 2, 2.5, 2.5);

  // 11. HEADLIGHTS & TAILLIGHTS
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-w / 2 + 2, -h / 2, 4.5, 2);
  ctx.fillRect(w / 2 - 6.5, -h / 2, 4.5, 2);

  const brakeGlow = car.oilTimer > 0 || car.stunTimer > 0 ? 1 : 0.6;
  ctx.fillStyle = `rgba(239, 68, 68, ${brakeGlow})`;
  ctx.fillRect(-w / 2 + 3, h / 2 - 2, w - 6, 2);

  // 12. FORCEFIELD SHIELD AURA
  if (car.shieldTimer > 0) {
    const time = performance.now() * 0.005;
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const nodeAngle = time + (i * Math.PI * 2) / 3;
      const nx = Math.cos(nodeAngle) * 31;
      const ny = Math.sin(nodeAngle) * 31;
      ctx.fillStyle = '#f3e8ff';
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // ==========================================
  // TIKTOK OVERHEAD USERNAME TAG (ANTI-OVERLAPPING)
  // Dynamic offset prevents horizontal overlapping when cars are side-by-side
  // ==========================================
  ctx.save();
  const baseBadgeY = car.y - 36;
  // Apply staggered badge offset to prevent overlap
  const dynamicOffset = (car.lane % 2 === 1 ? 16 : 0) + (car.badgeOffset || 0);
  const badgeY = baseBadgeY - dynamicOffset;

  ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const nameMetrics = ctx.measureText(car.username);
  const pillWidth = Math.max(nameMetrics.width + 26, 62);

  // Glassmorphic Tag Background
  ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
  const borderColor =
    car.rank === 1
      ? '#eab308'
      : car.rank === 2
      ? '#cbd5e1'
      : car.rank === 3
      ? '#d97706'
      : 'rgba(255, 255, 255, 0.18)';

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(car.x - pillWidth / 2, badgeY - 10, pillWidth, 16, 8);
  ctx.fill();
  ctx.stroke();

  // Rank Badge Circle
  const rankBg =
    car.rank === 1
      ? '#eab308'
      : car.rank === 2
      ? '#94a3b8'
      : car.rank === 3
      ? '#b45309'
      : '#1e293b';

  ctx.fillStyle = rankBg;
  ctx.beginPath();
  ctx.arc(car.x - pillWidth / 2 + 8, badgeY - 2, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = car.rank <= 3 ? '#000000' : '#ffffff';
  ctx.font = '900 7.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${car.rank}`, car.x - pillWidth / 2 + 8, badgeY + 0.5);

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(car.username, car.x - pillWidth / 2 + 16, badgeY + 0.5);

  // Active status icon floating above tag
  if (car.turboTimer > 0) {
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥', car.x, badgeY - 11);
  } else if (car.nitroTimer > 0) {
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', car.x, badgeY - 11);
  } else if (car.oilTimer > 0) {
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛢️', car.x, badgeY - 11);
  } else if (car.stunTimer > 0) {
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💫', car.x, badgeY - 11);
  }

  ctx.restore();
}

// Action Applier Helper
export function applyCarAction(
  cars: Car[],
  actionType: ActionType,
  targetUsername?: string,
  actorName: string = '@streamer'
): { updatedCars: Car[]; message: string; icon: string } {
  let targetCar: Car | undefined;

  if (targetUsername) {
    targetCar = cars.find((c) => c.username.toLowerCase() === targetUsername.toLowerCase());
  }

  if (!targetCar && cars.length > 0) {
    if (actionType === 'MISSEL' || actionType === 'OLEO') {
      targetCar = cars.reduce((max, c) => (c.distance > max.distance ? c : max), cars[0]);
    } else {
      targetCar = cars[Math.floor(Math.random() * cars.length)];
    }
  }

  if (!targetCar) {
    return { updatedCars: cars, message: 'Nenhum carro na pista', icon: '⚠️' };
  }

  let message = '';
  let icon = '';

  const updatedCars = cars.map((c) => {
    if (c.id !== targetCar!.id) return c;

    const copy = { ...c };

    if (actionType === 'TURBO') {
      copy.turboTimer = 2.4;
      soundEngine.playTurbo();
      message = `${actorName} ativou TURBO em ${copy.username}!`;
      icon = '🔥';
    } else if (actionType === 'NITRO') {
      copy.nitroTimer = 4.8;
      soundEngine.playNitro();
      message = `${actorName} ativou NITRO em ${copy.username}!`;
      icon = '⚡';
    } else if (actionType === 'OLEO') {
      if (copy.shieldTimer > 0) {
        soundEngine.playShield();
        message = `${copy.username} bloqueou o ÓLEO com ESCUDO!`;
        icon = '🛡️';
      } else {
        copy.oilTimer = 2.6;
        soundEngine.playOil();
        message = `${actorName} derramou ÓLEO em ${copy.username}!`;
        icon = '🛢️';
      }
    } else if (actionType === 'MISSEL') {
      if (copy.shieldTimer > 0) {
        soundEngine.playShield();
        message = `${copy.username} defendeu o MÍSSIL com ESCUDO!`;
        icon = '🛡️';
      } else {
        copy.stunTimer = 2.4;
        soundEngine.playMissileExplosion();
        message = `${actorName} acertou MÍSSIL em ${copy.username}!`;
        icon = '🚀';
      }
    } else if (actionType === 'ESCUDO') {
      copy.shieldTimer = 5.0;
      soundEngine.playShield();
      message = `${actorName} protegeu ${copy.username} com ESCUDO!`;
      icon = '🛡️';
    }

    copy.lastAction = { type: actionType, timestamp: Date.now() };
    return copy;
  });

  return { updatedCars, message, icon };
}
