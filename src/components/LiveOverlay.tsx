import React from 'react';
import { Car, LiveGiftNotification } from '../types/game';
import { Trophy, Shield, Flame, Zap, Crown, Sparkles, Timer } from 'lucide-react';

interface LiveOverlayProps {
  cars: Car[];
  raceDuration: number;
  timeLeft: number;
  isFinished: boolean;
  podiumCountdown: number;
  giftToasts: LiveGiftNotification[];
}

export const LiveOverlay: React.FC<LiveOverlayProps> = ({
  cars,
  raceDuration,
  timeLeft,
  isFinished,
  podiumCountdown,
  giftToasts
}) => {
  const topCars = cars.slice(0, 5);
  const winner = cars[0];
  const second = cars[1];
  const third = cars[2];

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerRatio = Math.max(0, timeLeft / raceDuration);
  const isUrgent = timeLeft <= 15 && timeLeft > 0;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 md:p-4 select-none">
      {/* ---------------------------------------------------- */}
      {/* TOPO: BANNER TIKTOK NEON + TEMPORIZADOR 90S + LEADERBOARD */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col gap-2 w-full max-w-lg mx-auto">
        {/* 1. BANNER DE CHAMADA DO TIKTOK (TOTALMENTE LIMPO, DESTACADO E NEON) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 via-fuchsia-600 to-cyan-500 p-[2.5px] shadow-[0_0_30px_rgba(244,63,94,0.7)]">
          <div className="bg-slate-950/92 backdrop-blur-md px-4 py-3 rounded-[13.5px] text-center">
            <div className="text-[13px] sm:text-sm font-black tracking-wider uppercase text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.95)] flex items-center justify-center gap-2 animate-pulse">
              <span>⚡</span>
              <span className="bg-gradient-to-r from-yellow-300 via-rose-300 to-cyan-300 bg-clip-text text-transparent">
                COMENTE QUALQUER COISA PARA ENTRAR NA CORRIDA!
              </span>
              <span>⚡</span>
            </div>
          </div>
        </div>

        {/* 2. TEMPORIZADOR DE CONTAGEM REGRESSIVA 90s + CONTADOR DE DISTÂNCIA */}
        <div className="bg-slate-950/90 border border-cyan-500/35 rounded-2xl px-3.5 py-2 backdrop-blur-md shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-xl ${isUrgent ? 'bg-rose-500/30 text-rose-400 animate-bounce' : 'bg-cyan-500/20 text-cyan-400'}`}>
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                TEMPO RESTANTE
              </div>
              <div
                className={`font-mono text-lg sm:text-xl font-black tracking-wider tabular-nums ${
                  isUrgent
                    ? 'text-rose-400 animate-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]'
                    : 'text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.7)]'
                }`}
              >
                ⏱️ {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-[170px] flex flex-col gap-1 items-end">
            <span className="text-[10px] font-bold text-slate-300">
              Líder: <strong className="text-cyan-300 font-mono text-xs">{winner ? Math.floor(winner.distance) : 0}m</strong>
            </span>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10 p-[1px]">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isUrgent
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                    : 'bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                }`}
                style={{ width: `${timerRatio * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. TABELA DE CLASSIFICAÇÃO AO VIVO */}
        <div className="bg-slate-950/90 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md shadow-2xl">
          <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Crown className="w-3.5 h-3.5" />
              <span>CLASSIFICAÇÃO AO VIVO</span>
            </span>
            <span className="text-[9px] font-mono text-slate-400">
              {cars.length} CARROS NA PISTA
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {topCars.map((car) => {
              const isFirst = car.rank === 1;
              const isSecond = car.rank === 2;
              const isThird = car.rank === 3;

              const badgeStyle = isFirst
                ? 'bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-transparent border-amber-400/80'
                : isSecond
                ? 'bg-gradient-to-r from-slate-400/20 via-slate-400/10 to-transparent border-slate-300/60'
                : isThird
                ? 'bg-gradient-to-r from-amber-700/20 via-amber-700/10 to-transparent border-amber-600/60'
                : 'bg-white/5 border-slate-700/50';

              return (
                <div
                  key={car.id}
                  className={`flex items-center justify-between px-2.5 py-1 rounded-xl text-[11px] border-l-[3px] transition-all backdrop-blur-sm ${badgeStyle}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-black text-[10px] w-4 text-center tabular-nums ${
                        isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : isThird ? 'text-amber-600' : 'text-slate-400'
                      }`}
                    >
                      {car.rank}º
                    </span>

                    <div
                      className="w-3 h-3 rounded-full border border-white/40 shadow-sm shrink-0"
                      style={{ backgroundColor: car.color }}
                    />

                    <span className="truncate max-w-[130px] font-bold text-slate-100">
                      {car.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 tabular-nums">
                    {car.turboTimer > 0 && <Flame className="w-3.5 h-3.5 text-orange-500 animate-bounce" />}
                    {car.nitroTimer > 0 && <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                    {car.shieldTimer > 0 && <Shield className="w-3.5 h-3.5 text-purple-400" />}

                    <span className="font-bold text-cyan-400 text-[10px]">
                      {Math.floor(car.distance)}m
                    </span>

                    <span className="text-[9px] text-slate-400 font-mono bg-black/40 px-1 py-0.5 rounded">
                      {Math.round(car.speed)} km/h
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* NOTIFICAÇÕES DE PRESENTES E AÇÕES EM TEMPO REAL */}
      <div className="flex flex-col gap-1.5 max-w-[270px] my-auto">
        {giftToasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-slate-950/95 border border-cyan-500/40 rounded-2xl px-3 py-1.5 flex items-center gap-2.5 shadow-[0_4px_16px_rgba(6,182,212,0.3)] backdrop-blur-md animate-in slide-in-from-left duration-200"
          >
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-lg shrink-0 border border-cyan-400/30">
              {toast.giftIcon}
            </div>
            <div className="text-[11px] leading-tight min-w-0">
              <span className="font-extrabold text-white block truncate">{toast.username}</span>
              <span className="text-[9.5px] text-cyan-300 font-bold">{toast.giftName}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ESPAÇO INFERIOR LIVRE */}
      <div className="h-4" />

      {/* ---------------------------------------------------- */}
      {/* PÓDIO DA RODADA (10 SEGUNDOS COM REINÍCIO AUTOMÁTICO) */}
      {/* ---------------------------------------------------- */}
      {isFinished && winner && (
        <div className="absolute inset-0 bg-slate-950/97 backdrop-blur-2xl pointer-events-auto flex flex-col items-center justify-center p-4 text-center z-50 animate-in zoom-in-95 duration-300">
          <div className="relative mb-2">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-400/60 flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.6)] animate-bounce">
              <Trophy className="w-9 h-9 text-amber-400" />
            </div>
          </div>

          <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PÓDIO DA RODADA (90S)</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          <h2 className="text-xl font-black text-white mb-4 tracking-tight">
            RESULTADO FINAL DA CORRIDA
          </h2>

          <div className="grid grid-cols-3 gap-2 w-full max-w-sm mb-4">
            {/* 2º Lugar */}
            {second && (
              <div className="bg-slate-900/90 border border-slate-400/40 rounded-2xl p-2.5 flex flex-col items-center shadow-lg mt-3">
                <div className="w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 font-black text-xs flex items-center justify-center mb-1">
                  2º
                </div>
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/50 mb-1"
                  style={{ backgroundColor: second.color }}
                />
                <div className="text-[11px] font-bold text-white truncate max-w-[85px]">
                  {second.username}
                </div>
                <div className="text-[10px] font-extrabold text-cyan-300 font-mono mt-0.5">
                  {Math.floor(second.distance)}m
                </div>
              </div>
            )}

            {/* 1º Lugar - Campeão */}
            <div className="bg-gradient-to-b from-amber-500/25 to-slate-900 border-2 border-amber-400 rounded-2xl p-3 flex flex-col items-center shadow-[0_0_25px_rgba(245,158,11,0.4)] relative">
              <Crown className="w-5 h-5 text-amber-400 absolute -top-3" />
              <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center mb-1 shadow-md">
                1º
              </div>
              <div
                className="w-4 h-4 rounded-full border-2 border-white mb-1 shadow-sm"
                style={{ backgroundColor: winner.color }}
              />
              <div className="text-xs font-black text-amber-300 truncate max-w-[95px]">
                {winner.username}
              </div>
              <div className="text-xs font-black text-cyan-300 font-mono mt-0.5">
                {Math.floor(winner.distance)}m
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                {Math.round(winner.speed)} km/h
              </div>
            </div>

            {/* 3º Lugar */}
            {third && (
              <div className="bg-slate-900/90 border border-amber-700/40 rounded-2xl p-2.5 flex flex-col items-center shadow-lg mt-4">
                <div className="w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 font-black text-xs flex items-center justify-center mb-1">
                  3º
                </div>
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/50 mb-1"
                  style={{ backgroundColor: third.color }}
                />
                <div className="text-[11px] font-bold text-white truncate max-w-[85px]">
                  {third.username}
                </div>
                <div className="text-[10px] font-extrabold text-cyan-300 font-mono mt-0.5">
                  {Math.floor(third.distance)}m
                </div>
              </div>
            )}
          </div>

          {/* Temporizador de Reinício Automático em 10 Segundos */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-bold text-slate-300">
              Reiniciando automaticamente em: <strong className="text-cyan-400 font-mono text-sm">{podiumCountdown}s</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
