import React, { useState } from 'react';
import { Car, ActionType } from '../types/game';
import {
  Flame,
  Zap,
  Shield,
  Bomb,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Plus,
  Radio,
  Code2,
  Tv,
  Check,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface StreamerControlPanelProps {
  cars: Car[];
  onTriggerAction: (actionType: ActionType, targetCarId?: string) => void;
  onAddCar: (username: string) => void;
  onResetCars: () => void;
  onResetRace: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  autoSimulate: boolean;
  onToggleAutoSimulate: () => void;
  socketUrl: string;
  onUpdateSocketUrl: (url: string) => void;
  socketConnected: boolean;
  onOpenCodeModal: () => void;
}

export const StreamerControlPanel: React.FC<StreamerControlPanelProps> = ({
  cars,
  onTriggerAction,
  onAddCar,
  onResetCars,
  onResetRace,
  soundEnabled,
  onToggleSound,
  autoSimulate,
  onToggleAutoSimulate,
  socketUrl,
  onUpdateSocketUrl,
  socketConnected,
  onOpenCodeModal
}) => {
  const [selectedCarId, setSelectedCarId] = useState<string>('leader');
  const [newUsername, setNewUsername] = useState<string>('');
  const [showSocketGuide, setShowSocketGuide] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>(socketUrl);
  const [copiedSample, setCopiedSample] = useState<boolean>(false);

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const formatted = newUsername.startsWith('@') ? newUsername.trim() : `@${newUsername.trim()}`;
    onAddCar(formatted);
    setNewUsername('');
  };

  const sampleServerCode = `// backend-server.js
const { Server } = require("socket.io");
const { WebcastPushConnection } = require("tiktok-live-connector");

const io = new Server(3001, {
  cors: { origin: "*" }
});

const tiktokUsername = "SEU_USUARIO_TIKTOK";
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(() => {
  console.log("Conectado à live do TikTok!");
}).catch(err => console.error("Erro:", err));

// Quando alguém envia comentário: entra na corrida
tiktokLiveConnection.on('chat', data => {
  io.emit('join', { username: '@' + data.uniqueId });
});

// Quando alguém envia presente: dispara turbo, nitro ou míssil!
tiktokLiveConnection.on('gift', data => {
  const username = '@' + data.uniqueId;
  const gift = data.giftName.toLowerCase();
  
  if (gift.includes('rose') || gift.includes('rosa')) {
    io.emit('nitro', { username });
  } else if (gift.includes('fire') || gift.includes('fogo')) {
    io.emit('turbo', { username });
  } else if (gift.includes('bomb') || gift.includes('boxing')) {
    io.emit('missile', { username });
  } else if (gift.includes('heart') || gift.includes('coracao')) {
    io.emit('shield', { username });
  }
});

console.log("Servidor Socket.io ativo na porta 3001");`;

  const copySampleCode = () => {
    navigator.clipboard.writeText(sampleServerCode);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 text-slate-200">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Tv className="w-4 h-4 text-rose-500" />
            <span>Painel do Streamer (TikTok Live)</span>
          </h2>
          <p className="text-xs text-slate-400">Controles de corrida, sabotagem e integração</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSound}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title={soundEnabled ? 'Silenciar Áudio' : 'Ativar Áudio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

          <button
            onClick={onOpenCodeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Código HTML Único</span>
          </button>
        </div>
      </div>

      {/* 1. SEÇÃO DE DISPARO DE AÇÕES EM TEMPO REAL */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ações em Tempo Real (Efeitos)
          </span>

          {/* Selecionador de Alvo */}
          <select
            value={selectedCarId}
            onChange={(e) => setSelectedCarId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-200 px-2 py-1 outline-none"
          >
            <option value="leader">🥇 Aplicar no Líder</option>
            <option value="random">🎲 Carro Aleatório</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rank}º - {c.username}
              </option>
            ))}
          </select>
        </div>

        {/* Botões dos 5 Efeitos Obrigatórios */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            onClick={() => onTriggerAction('TURBO', selectedCarId === 'leader' || selectedCarId === 'random' ? undefined : selectedCarId)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-orange-300 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            <div className="text-left leading-tight">
              <div>TURBO</div>
              <span className="text-[10px] text-orange-400/80 font-normal">Rasto de Fogo</span>
            </div>
          </button>

          <button
            onClick={() => onTriggerAction('NITRO', selectedCarId === 'leader' || selectedCarId === 'random' ? undefined : selectedCarId)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="text-left leading-tight">
              <div>NITRO</div>
              <span className="text-[10px] text-cyan-400/80 font-normal">Aceleração Longa</span>
            </div>
          </button>

          <button
            onClick={() => onTriggerAction('OLEO', selectedCarId === 'leader' || selectedCarId === 'random' ? undefined : selectedCarId)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 hover:bg-amber-900/40 border border-amber-600/40 text-amber-300 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <span className="text-base">🛢️</span>
            <div className="text-left leading-tight">
              <div>ÓLEO</div>
              <span className="text-[10px] text-amber-400/80 font-normal">Derrapa & Freia</span>
            </div>
          </button>

          <button
            onClick={() => onTriggerAction('MISSEL', selectedCarId === 'leader' || selectedCarId === 'random' ? undefined : selectedCarId)}
            className="flex items-center gap-2 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <Bomb className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="text-left leading-tight">
              <div>MÍSSIL</div>
              <span className="text-[10px] text-rose-400/80 font-normal">Explosão & Stun</span>
            </div>
          </button>

          <button
            onClick={() => onTriggerAction('ESCUDO', selectedCarId === 'leader' || selectedCarId === 'random' ? undefined : selectedCarId)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <Shield className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="text-left leading-tight">
              <div>ESCUDO</div>
              <span className="text-[10px] text-purple-400/80 font-normal">Barreira Protetora</span>
            </div>
          </button>

          <button
            onClick={onResetRace}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="text-left leading-tight">
              <div>REINICIAR</div>
              <span className="text-[10px] text-slate-400 font-normal">Nova Corrida</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. SIMULAÇÃO AUTOMÁTICA DE AUDIÊNCIA */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <span>Simulação Automática de Presentes</span>
            {autoSimulate && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          </div>
          <p className="text-[11px] text-slate-400">
            Gera interações de chat e presentes simulados a cada poucos segundos
          </p>
        </div>

        <button
          onClick={onToggleAutoSimulate}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            autoSimulate
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {autoSimulate ? 'Ativa' : 'Desativada'}
        </button>
      </div>

      {/* 3. GRID DE PARTICIPANTES (ATÉ 12 CARROS) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Participantes ({cars.length}/12)
            </span>
          </div>

          <button
            onClick={onResetCars}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            Preencher 12 Pilotos
          </button>
        </div>

        {/* Input para adicionar participante */}
        <form onSubmit={handleAddParticipant} className="flex gap-2">
          <input
            type="text"
            placeholder="@usuario_tiktok"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            disabled={cars.length >= 12}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={cars.length >= 12 || !newUsername.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Entrar</span>
          </button>
        </form>

        {/* Lista compacta de carros na pista */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {cars.map((car) => (
            <div
              key={car.id}
              className="flex items-center justify-between p-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-black w-4 text-slate-400">{car.rank}º</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: car.color }} />
                <span className="truncate font-semibold text-slate-200">{car.username}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onTriggerAction('TURBO', car.id)}
                  title="Dar Turbo"
                  className="p-1 hover:bg-slate-800 rounded text-orange-400"
                >
                  <Flame className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onTriggerAction('MISSEL', car.id)}
                  title="Jogar Míssil"
                  className="p-1 hover:bg-slate-800 rounded text-rose-400"
                >
                  <Bomb className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. CONEXÃO COM SOCKET.IO EXTERNO */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">Servidor Socket.io</span>
          </div>

          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              socketConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {socketConnected ? '● CONECTADO' : '○ DESCONECTADO (Local)'}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://localhost:3001"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500 font-mono"
          />
          <button
            onClick={() => onUpdateSocketUrl(urlInput)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-lg transition-colors"
          >
            Conectar
          </button>
        </div>

        {/* Guia de Integração com TikTok Live Connector */}
        <button
          onClick={() => setShowSocketGuide(!showSocketGuide)}
          className="flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-300 font-medium pt-1"
        >
          <span>Como conectar com TikFinity ou TikTokLiveConnector?</span>
          {showSocketGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showSocketGuide && (
          <div className="mt-2 bg-slate-950 rounded-lg p-2.5 border border-slate-800 text-[11px] flex flex-col gap-2">
            <div className="flex items-center justify-between text-slate-400">
              <span>Script Node.js para escutar presentes e emitir Socket.io:</span>
              <button
                onClick={copySampleCode}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold"
              >
                {copiedSample ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSample ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="bg-slate-900 p-2 rounded text-[10px] text-slate-300 font-mono overflow-x-auto max-h-36">
              {sampleServerCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
