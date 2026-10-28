/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Car, LiveGiftNotification, ActionType } from './types/game';
import { RaceCanvas, applyCarAction, CAR_COLORS } from './components/RaceCanvas';
import { LiveOverlay } from './components/LiveOverlay';
import { soundEngine } from './utils/audio';

// URL fixa do backend Socket.io
const SOCKET_URL = 'https://tiktok-live-backend-39v9.onrender.com';
const RACE_DURATION = 90; // Exatamente 90 segundos

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

  const socketRef = useRef<Socket | null>(null);

  // Inicializa até 12 carros
  const initCarsList = () => {
    const newCars: Car[] = INITIAL_PILOTS.map((username, idx) => ({
      id: `car_${idx}_${Date.now()}`,
      username,
      color: CAR_COLORS[idx % CAR_COLORS.length],
      secondaryColor: '#ffffff',
      lane: idx % 6,
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
  // CONEXÃO DIRETA E AUTOMÁTICA AO BACKEND SOCKET.IO
  // ----------------------------------------------------
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000
      });
      socketRef.current = socket;

      // Entrar na corrida
      socket.on('join', (data: { username: string; color?: string }) => {
        if (data && data.username) handleAddCar(data.username, data.color);
      });
      socket.on('novo_jogador', (data: { username: string; color?: string }) => {
        if (data && data.username) handleAddCar(data.username, data.color);
      });

      // Ações em tempo real disparadas pela Live
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
      socket.on('action', (data) => {
        if (data && data.action) {
          handleRemoteAction(data.action.toUpperCase(), data);
        }
      });
      socket.on('reset', () => handleResetRace());
    } catch (err) {
      console.warn('Erro ao conectar ao Socket.io:', err);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // ----------------------------------------------------
  // CICLO DE TEMPO: 90 SEGUNDOS + PÓDIO DE 10S
  // ----------------------------------------------------
  useEffect(() => {
    if (isFinished) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerRaceFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished]);

  const triggerRaceFinish = () => {
    setIsFinished(true);
    soundEngine.playWin();
    confetti({
      particleCount: 110,
      spread: 90,
      origin: { y: 0.45 }
    });
  };

  // Contagem regressiva de 10s no pódio com reinício automático
  useEffect(() => {
    if (!isFinished) return;

    setPodiumCountdown(10);
    const podiumTimer = setInterval(() => {
      setPodiumCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(podiumTimer);
          handleResetRace();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(podiumTimer);
  }, [isFinished]);

  // Reset Race
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
  };

  // Disparo de ação
  const handleTriggerAction = (actionType: ActionType, targetUsername?: string) => {
    if (isFinished) return;

    setCars((prevCars) => {
      let targetCar = prevCars.find(
        (c) => c.username.toLowerCase() === targetUsername?.toLowerCase()
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
        targetUsername || '@live'
      );

      if (targetCar) {
        addGiftToast(targetCar.username, `${actionType}!`, icon, actionType);
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
    }, 3000);
  };

  const handleAddCar = (username: string, customColor?: string) => {
    setCars((prev) => {
      if (prev.length >= 12) return prev;
      const cleanName = username.startsWith('@') ? username : `@${username}`;
      // Não duplica se já existir
      if (prev.some((c) => c.username.toLowerCase() === cleanName.toLowerCase())) return prev;

      const newCar: Car = {
        id: `car_${Date.now()}_${Math.random()}`,
        username: cleanName,
        color: customColor || CAR_COLORS[prev.length % CAR_COLORS.length],
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
      return [...prev, newCar];
    });
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#070a12] flex items-center justify-center overflow-hidden select-none">
      {/* Container Tela Cheia Otimizado para iPhone e Live Stream (100vh / 100vw) */}
      <div className="relative w-full h-full max-w-[480px] flex flex-col justify-between overflow-hidden bg-[#070a12] shadow-2xl">
        <RaceCanvas
          cars={cars}
          raceDuration={RACE_DURATION}
          timeLeft={timeLeft}
          isFinished={isFinished}
          soundEnabled={true}
        />

        <LiveOverlay
          cars={cars}
          raceDuration={RACE_DURATION}
          timeLeft={timeLeft}
          isFinished={isFinished}
          podiumCountdown={podiumCountdown}
          giftToasts={giftToasts}
        />
      </div>
    </div>
  );
}
