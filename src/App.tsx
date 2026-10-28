/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Car, LiveGiftNotification, LiveComment, ActionType } from './types/game';
import { RaceCanvas, applyCarAction, CAR_COLORS } from './components/RaceCanvas';
import { LiveOverlay } from './components/LiveOverlay';
import { StreamerControlPanel } from './components/StreamerControlPanel';
import { CodeExportModal } from './components/CodeExportModal';
import { soundEngine } from './utils/audio';
import { Smartphone, Monitor, Sparkles } from 'lucide-react';

const RACE_DURATION = 90; // Exatamente 90 segundos (1m30s)

const INITIAL_PILOTS = [
  '@lucas_drift', '@pedro_turbo', '@julia_veloz', '@marcos_nitro', '@beatriz_gt',
  '@thiago_v8', '@camila_boost', '@gabriel_racha', '@larissa_speed', '@rafael_pro',
  '@felipe_vtec', '@daniela_boost'
];

export default function App() {
  const [cars, setCars] = useState<Car[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(RACE_DURATION);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [podiumCountdown, setPodiumCountdown] = useState<number>(10);
  const [giftToasts, setGiftToasts] = useState<LiveGiftNotification[]>([]);
  const [chatFeed, setChatFeed] = useState<LiveComment[]>([
    { id: '1', username: '@sistema', comment: 'COMENTE QUALQUER COISA PARA ENTRAR NA CORRIDA! 🏁' }
  ]);

  // Audio and simulation controls
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoSimulate, setAutoSimulate] = useState<boolean>(true);
  const [socketUrl, setSocketUrl] = useState<string>('http://localhost:3001');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'split' | 'phone_only'>('split');
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);

  // Initialize up to 12 Cars
  const initCarsList = () => {
    const newCars: Car[] = INITIAL_PILOTS.map((username, idx) => ({
      id: `car_${idx}_${Date.now()}`,
      username,
      color: CAR_COLORS[idx % CAR_COLORS.length],
      secondaryColor: '#ffffff',
      lane: idx % 6, // 6 faixas bem distribuídas
      targetLane: idx % 6,
      x: 0,
      y: 0,
      distance: 0,
      speed: 180,
      baseSpeed: 175 + Math.random() * 20,
      turboTimer: 0,
      nitroTimer: 0,
      oilTimer: 0,
      stunTimer: 0,
      shieldTimer: 0,
      rank: idx + 1,
      spinAngle: 0,
      driftAngle: 0,
      badgeOffset: 0,
      model: 'gt',
      finished: false
    }));
    setCars(newCars);
    setTimeLeft(RACE_DURATION);
    setIsFinished(false);
    setPodiumCountdown(10);
  };

  useEffect(() => {
    initCarsList();
  }, []);

  // ----------------------------------------------------
  // SISTEMA DE TEMPO: CICLO DE 90 SEGUNDOS + PÓDIO DE 10S
  // ----------------------------------------------------
  useEffect(() => {
    if (isFinished) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // TEMPO ZEROU (00:00)
          clearInterval(timer);
          triggerRaceFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished]);

  // Finalização da rodada: congela carros e ativa pódio de 10s
  const triggerRaceFinish = () => {
    setIsFinished(true);
    soundEngine.playWin();
    confetti({
      particleCount: 100,
      spread: 85,
      origin: { y: 0.45 }
    });

    addChatMessage('@sistema', '⏱️ TEMPO ESGOTADO! Conheça os campeões da rodada!');
  };

  // Temporizador de 10 segundos do Pódio com reinício automático
  useEffect(() => {
    if (!isFinished) return;

    setPodiumCountdown(10);
    const podiumTimer = setInterval(() => {
      setPodiumCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(podiumTimer);
          // Reinicia automaticamente corrida e lista do zero
          handleResetRace();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(podiumTimer);
  }, [isFinished]);

  // Reset Race (novo ciclo de 90s)
  const handleResetRace = () => {
    setCars((prev) =>
      prev.map((car, idx) => ({
        ...car,
        distance: 0,
        speed: car.baseSpeed,
        turboTimer: 0,
        nitroTimer: 0,
        oilTimer: 0,
        stunTimer: 0,
        shieldTimer: 0,
        spinAngle: 0,
        driftAngle: 0,
        badgeOffset: 0,
        finished: false,
        lane: idx % 6
      }))
    );
    setTimeLeft(RACE_DURATION);
    setIsFinished(false);
    setPodiumCountdown(10);
    addChatMessage('@sistema', '🔥 NOVO RACHA DE 90 SEGUNDOS INICIADO! VALENDO!');
  };

  // ----------------------------------------------------
  // INTEGRAÇÃO SOCKET.IO EXTERNO
  // ----------------------------------------------------
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 4000,
        reconnectionAttempts: 2
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setSocketConnected(true);
        addChatMessage('@sistema', `Conectado ao servidor Socket.io (${socketUrl})`);
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
      });

      socket.on('connect_error', () => {
        setSocketConnected(false);
      });

      // Ouvintes de entrada de jogadores
      socket.on('join', (data: { username: string }) => {
        if (data && data.username) handleAddCar(data.username);
      });
      socket.on('novo_jogador', (data: { username: string }) => {
        if (data && data.username) handleAddCar(data.username);
      });

      // Ouvintes de eventos e sabotagens
      const handleRemoteAction = (action: ActionType, data?: { username?: string }) => {
        handleTriggerAction(action, data?.username);
      };

      socket.on('turbo', (data) => handleRemoteAction('TURBO', data));
      socket.on('nitro', (data) => handleRemoteAction('NITRO', data));
      socket.on('oil', (data) => handleRemoteAction('OLEO', data));
      socket.on('oleo', (data) => handleRemoteAction('OLEO', data));
      socket.on('missile', (data) => handleRemoteAction('MISSEL', data));
      socket.on('missel', (data) => handleRemoteAction('MISSEL', data));
      socket.on('bomba', (data) => handleRemoteAction('MISSEL', data));
      socket.on('shield', (data) => handleRemoteAction('ESCUDO', data));
      socket.on('escudo', (data) => handleRemoteAction('ESCUDO', data));
      socket.on('reset', () => handleResetRace());
    } catch {
      setSocketConnected(false);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [socketUrl]);

  // Action Handler
  const handleTriggerAction = (actionType: ActionType, targetCarIdOrName?: string) => {
    if (isFinished) return; // não permite ações com tempo zerado

    setCars((prevCars) => {
      let targetCar = prevCars.find(
        (c) =>
          c.id === targetCarIdOrName ||
          c.username.toLowerCase() === targetCarIdOrName?.toLowerCase()
      );
      if (!targetCar && prevCars.length > 0) {
        if (actionType === 'MISSEL' || actionType === 'OLEO') {
          targetCar = prevCars.reduce((max, c) => (c.distance > max.distance ? c : max), prevCars[0]);
        } else {
          targetCar = prevCars[Math.floor(Math.random() * prevCars.length)];
        }
      }

      const { updatedCars, message, icon } = applyCarAction(
        prevCars,
        actionType,
        targetCar?.username,
        '@streamer'
      );

      if (targetCar) {
        addGiftToast(targetCar.username, `${actionType} ativado!`, icon, actionType);
        addChatMessage('@live', message);
      }

      return updatedCars;
    });
  };

  const addGiftToast = (
    username: string,
    giftName: string,
    giftIcon: string,
    action: ActionType
  ) => {
    const newToast: LiveGiftNotification = {
      id: `toast_${Date.now()}_${Math.random()}`,
      username,
      giftName,
      giftIcon,
      action,
      timestamp: Date.now()
    };
    setGiftToasts((prev) => [...prev.slice(-3), newToast]);

    setTimeout(() => {
      setGiftToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 3200);
  };

  const addChatMessage = (username: string, comment: string) => {
    const newMsg: LiveComment = {
      id: `chat_${Date.now()}_${Math.random()}`,
      username,
      comment
    };
    setChatFeed((prev) => [...prev.slice(-5), newMsg]);
  };

  // Add Participant (Suporte até 12 carros simultâneos)
  const handleAddCar = (username: string) => {
    setCars((prev) => {
      if (prev.length >= 12) {
        addChatMessage('@sistema', 'Grid cheio! Máximo 12 carros.');
        return prev;
      }
      const newCar: Car = {
        id: `car_${Date.now()}_${Math.random()}`,
        username,
        color: CAR_COLORS[prev.length % CAR_COLORS.length],
        secondaryColor: '#ffffff',
        lane: prev.length % 6,
        targetLane: prev.length % 6,
        x: 0,
        y: 0,
        distance: 0,
        speed: 180,
        baseSpeed: 175 + Math.random() * 20,
        turboTimer: 0,
        nitroTimer: 0,
        oilTimer: 0,
        stunTimer: 0,
        shieldTimer: 0,
        rank: prev.length + 1,
        spinAngle: 0,
        driftAngle: 0,
        badgeOffset: 0,
        model: 'gt',
        finished: false
      };
      addChatMessage(username, 'Entrou na corrida! 🏁');
      return [...prev, newCar];
    });
  };

  // Automatic TikTok Live simulation
  useEffect(() => {
    if (!autoSimulate || isFinished) return;

    const interval = setInterval(() => {
      const actions: ActionType[] = ['TURBO', 'NITRO', 'OLEO', 'MISSEL', 'ESCUDO'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const sampleViewers = ['@ana_games', '@pedro_live', '@carlos_v8', '@bianca_speed', '@torcida_tiktok', '@marcos_nitro'];
      const randomViewer = sampleViewers[Math.floor(Math.random() * sampleViewers.length)];

      handleTriggerAction(action);
      addChatMessage(randomViewer, `Bora acelerar! 🔥 Enviou ${action}`);
    }, 4500);

    return () => clearInterval(interval);
  }, [autoSimulate, isFinished]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 px-4 md:px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-rose-500/20">
            🏁
          </div>
          <div>
            <h1 className="font-extrabold text-sm md:text-base text-white tracking-tight flex items-center gap-2">
              <span>Racha TikTok Live</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                CICLO 90S • 12 CARROS
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'split' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Estúdio & Celular</span>
            </button>
            <button
              onClick={() => setViewMode('phone_only')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'phone_only' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Apenas Celular (9:16)</span>
            </button>
          </div>

          <button
            onClick={() => setIsCodeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ver Código HTML</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-6 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Left/Center: Vertical Phone Container (9:16 aspect ratio) */}
        <div className="w-full flex justify-center shrink-0 lg:w-auto">
          <div className="relative w-full max-w-[420px] h-[740px] rounded-[36px] bg-slate-950 p-2.5 shadow-[0_0_50px_rgba(0,0,0,0.8)] border-[6px] border-slate-800 flex flex-col overflow-hidden">
            {/* Live Racing Game Screen */}
            <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-[#070a12]">
              <RaceCanvas
                cars={cars}
                raceDuration={RACE_DURATION}
                timeLeft={timeLeft}
                isFinished={isFinished}
                soundEnabled={soundEnabled}
              />

              <LiveOverlay
                cars={cars}
                raceDuration={RACE_DURATION}
                timeLeft={timeLeft}
                isFinished={isFinished}
                podiumCountdown={podiumCountdown}
                giftToasts={giftToasts}
                chatFeed={chatFeed}
                onResetRace={handleResetRace}
                socketConnected={socketConnected}
              />
            </div>
          </div>
        </div>

        {/* Right: Streamer Control Dock */}
        {viewMode === 'split' && (
          <div className="w-full flex-1 max-w-xl">
            <StreamerControlPanel
              cars={cars}
              onTriggerAction={(action, targetId) => handleTriggerAction(action, targetId)}
              onAddCar={handleAddCar}
              onResetCars={initCarsList}
              onResetRace={handleResetRace}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              autoSimulate={autoSimulate}
              onToggleAutoSimulate={() => setAutoSimulate(!autoSimulate)}
              socketUrl={socketUrl}
              onUpdateSocketUrl={setSocketUrl}
              socketConnected={socketConnected}
              onOpenCodeModal={() => setIsCodeModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Code Modal with the complete Standalone Single-File HTML */}
      <CodeExportModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}
