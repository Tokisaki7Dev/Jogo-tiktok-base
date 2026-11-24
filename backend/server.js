// ============================================================================
// BACKEND TIKTOK LIVE -> WEBSOCKET PARA O JOGO RACHA DE CARROS 2D
// Express + ws + tiktok-live-connector
// ============================================================================

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const tiktokLib = require('tiktok-live-connector');

// Suporte automático tanto para tiktok-live-connector v2+ (TikTokLiveConnection)
// quanto para v1.x (WebcastPushConnection)
const TikTokConnectionClass =
  tiktokLib.TikTokLiveConnection || tiktokLib.WebcastPushConnection;
const ControlEvent = tiktokLib.ControlEvent || {};
const WebcastEvent = tiktokLib.WebcastEvent || {};

// Configurações vindas exclusivamente das variáveis de ambiente
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const RAW_TIKTOK_USERNAME = (process.env.TIKTOK_USERNAME || 'tokisaki7_').trim();

function sanitizeUsername(name) {
  return String(name || '').trim().replace(/^@+/, '');
}

let activeUsername = sanitizeUsername(RAW_TIKTOK_USERNAME);
let tiktokConnected = false;
let currentViewerCount = 0;
let tiktokConnection = null;
let reconnectTimeout = null;
let isConnecting = false;

// Controle anti-spam: 1 comando por usuário a cada 1 segundo (1000 ms)
const ANTI_SPAM_MS = 1000;
const lastCommandByUser = new Map();

// ============================================================================
// SERVIDOR EXPRESS + HTTP + WEBSOCKET
// ============================================================================
const app = express();
app.use(cors());
app.use(express.json());

// Rota de saúde exigida para monitoramento (PM2 / Cloudflare / Vercel)
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    tiktokConnected,
  });
});

// Rota raiz informativa simples
app.get('/', (_req, res) => {
  res.json({
    service: 'TikTok Live Game Backend',
    ok: true,
    tiktokConnected,
    clients: wss.clients.size,
    usernameConfigured: Boolean(activeUsername),
    viewerCount: currentViewerCount,
  });
});

// Rota /live: entrega o jogo pronto em tela cheia vertical para o navegador da VPS (ou navegador local)
app.get('/live', (_req, res) => {
  const candidates = [
    path.join(__dirname, 'game.html'),
    path.join(__dirname, '..', 'public', 'racha-standalone.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ];
  const gameFile = candidates.find((filePath) => fs.existsSync(filePath));
  if (!gameFile) {
    return res
      .status(404)
      .send('Arquivo game.html não encontrado na pasta backend/.');
  }
  return res.sendFile(gameFile);
});

// ============================================================================
// ROTA DE TESTE: POST /test
// Simula um comentário e um presente sem precisar de live ativa
// ============================================================================
app.post('/test', (req, res) => {
  try {
    const body = req.body || {};
    const testUser = sanitizeUsername(body.user || 'piloto_teste') || 'piloto_teste';
    const testAvatar =
      body.avatar ||
      'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=' + encodeURIComponent(testUser);

    // Evento 1: Comentário simulado (pode passar { text: "!atacar" } no body se quiser)
    const chatPayload = buildPayload({
      type: 'chat',
      user: testUser,
      avatar: testAvatar,
      text: body.text || '!turbo',
      giftName: '',
      giftCount: 1,
      diamonds: 0,
    });

    // Evento 2: Presente simulado (pode passar { giftName, giftCount, diamonds } no body)
    const giftPayload = buildPayload({
      type: 'gift',
      user: sanitizeUsername(body.giftUser || testUser) || testUser,
      avatar: testAvatar,
      text: `Enviou ${body.giftName || 'Rosa'}`,
      giftName: body.giftName || 'Rosa',
      giftCount: Number(body.giftCount) || 1,
      diamonds: Number(body.diamonds) || 5,
    });

    broadcastEvent(chatPayload);
    broadcastEvent(giftPayload);

    res.json({
      ok: true,
      message: 'Eventos de teste (chat e gift) enviados via WebSocket.',
      clientsNotified: wss.clients.size,
      events: [chatPayload, giftPayload],
    });
  } catch (err) {
    console.error('[TEST] Erro ao simular eventos:', err);
    res.status(500).json({ ok: false, error: 'Erro ao disparar eventos de teste' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ============================================================================
// PADRONIZAÇÃO E BROADCAST DOS EVENTOS PARA O JOGO
// ============================================================================
function buildPayload({
  type,
  user = 'espectador',
  avatar = '',
  text = '',
  giftName = '',
  giftCount = 1,
  diamonds = 0,
}) {
  return {
    type,
    user: String(user || 'espectador'),
    avatar: String(avatar || ''),
    text: String(text || ''),
    giftName: String(giftName || ''),
    giftCount: Number.isFinite(Number(giftCount)) ? Number(giftCount) : 1,
    diamonds: Number.isFinite(Number(diamonds)) ? Number(diamonds) : 0,
  };
}

function broadcastEvent(payload) {
  const serialized = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(serialized);
      } catch (err) {
        console.error('[WS] Falha ao enviar mensagem para cliente:', err.message);
      }
    }
  });
}

function sendStatusToClient(ws) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(
      JSON.stringify({
        type: 'status',
        tiktokConnected,
        viewerCount: currentViewerCount,
        username: activeUsername,
      })
    );
  } catch (err) {
    console.error('[WS] Erro ao enviar status inicial:', err.message);
  }
}

// ============================================================================
// CONEXÕES WEBSOCKET + HEARTBEAT PING A CADA 30 SEGUNDOS
// ============================================================================
wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  const clientIp = req.socket?.remoteAddress || 'desconhecido';
  console.log(`[WS] Cliente conectado (${clientIp}). Total: ${wss.clients.size}`);

  // Envia o status atual da live assim que o cliente conecta
  sendStatusToClient(ws);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Responde a ping customizado enviado pelo navegador (fallback além do ping de protocolo)
      if (msg && msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', tiktokConnected }));
        return;
      }

      // Permite atualizar o @username via painel de configuração do jogo, se enviado
      if (msg && msg.type === 'set_user' && msg.username) {
        const nextUser = sanitizeUsername(msg.username);
        if (nextUser && nextUser !== activeUsername) {
          console.log(`[CONFIG] Alterando live alvo para @${nextUser}`);
          activeUsername = nextUser;
          restartTikTokConnection();
        } else {
          sendStatusToClient(ws);
        }
      }
    } catch {
      // Ignora payloads inválidos sem derrubar o servidor
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Erro em cliente WebSocket:', err.message);
  });

  ws.on('close', () => {
    console.log(`[WS] Cliente desconectado. Restantes: ${wss.clients.size}`);
  });
});

// Envia ping a cada 30s para manter túneis (Cloudflare/Nginx) vivos e limpar zumbis
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      // Ignora erro de socket já fechado
    }
  });
}, 30000);

// Limpeza periódica do mapa anti-spam para evitar acúmulo de memória
const antiSpamCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [userKey, timestamp] of lastCommandByUser.entries()) {
    if (now - timestamp > 60000) {
      lastCommandByUser.delete(userKey);
    }
  }
}, 60000);

// ============================================================================
// EXTRAÇÃO DE DADOS DO USUÁRIO (COMPATÍVEL COM v1 E v2 DA BIBLIOTECA)
// ============================================================================
function extractUserData(data) {
  const userObj = data?.user || data || {};
  const username =
    userObj.uniqueId ||
    userObj.displayId ||
    userObj.nickname ||
    data?.uniqueId ||
    data?.displayId ||
    data?.nickname ||
    'espectador';

  const avatar =
    userObj.profilePicture?.urls?.[0] ||
    userObj.profilePicture?.url?.[0] ||
    userObj.profilePictureUrl ||
    data?.profilePicture?.urls?.[0] ||
    data?.profilePictureUrl ||
    userObj.avatarThumb?.urlList?.[0] ||
    userObj.avatarThumb?.url?.[0] ||
    userObj.avatarMedium?.urlList?.[0] ||
    '';

  return {
    user: String(username),
    avatar: String(avatar),
  };
}

// Verifica limite anti-spam: 1 comando por usuário a cada 1 segundo
function isRateLimited(userKey) {
  const key = String(userKey || '').toLowerCase();
  if (!key) return false;
  const now = Date.now();
  const last = lastCommandByUser.get(key) || 0;
  if (now - last < ANTI_SPAM_MS) {
    return true;
  }
  lastCommandByUser.set(key, now);
  return false;
}

// ============================================================================
// CONEXÃO E RECONEXÃO AUTOMÁTICA COM A LIVE DO TIKTOK (A CADA 10 SEGUNDOS)
// ============================================================================
function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectToTikTokLive();
  }, 10000);
}

function cleanupTikTokListeners() {
  if (!tiktokConnection) return;
  try {
    tiktokConnection.removeAllListeners();
    if (typeof tiktokConnection.disconnect === 'function') {
      tiktokConnection.disconnect();
    }
  } catch {
    // Ignora falha ao desconectar instância antiga
  }
  tiktokConnection = null;
}

function restartTikTokConnection() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  tiktokConnected = false;
  isConnecting = false;
  cleanupTikTokListeners();
  connectToTikTokLive();
}

async function connectToTikTokLive() {
  if (isConnecting) return;

  if (!activeUsername) {
    console.warn(
      '[TIKTOK] Variável TIKTOK_USERNAME não definida no .env. Aguardando configuração...'
    );
    scheduleReconnect();
    return;
  }

  if (!TikTokConnectionClass) {
    console.error('[TIKTOK] Biblioteca tiktok-live-connector não carregada corretamente.');
    return;
  }

  isConnecting = true;
  cleanupTikTokListeners();

  console.log(`[TIKTOK] Tentando conectar à live de @${activeUsername}...`);

  try {
    tiktokConnection = new TikTokConnectionClass(activeUsername, {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      requestPollingIntervalMs: 1000,
    });

    const EVT_CONNECTED = ControlEvent.CONNECTED || 'connected';
    const EVT_DISCONNECTED = ControlEvent.DISCONNECTED || 'disconnected';
    const EVT_STREAM_END = ControlEvent.STREAM_END || 'streamEnd';
    const EVT_ERROR = ControlEvent.ERROR || 'error';
    const EVT_CHAT = WebcastEvent.CHAT || 'chat';
    const EVT_GIFT = WebcastEvent.GIFT || 'gift';
    const EVT_LIKE = WebcastEvent.LIKE || 'like';
    const EVT_FOLLOW = WebcastEvent.FOLLOW || 'follow';
    const EVT_SHARE = WebcastEvent.SHARE || 'share';
    const EVT_SOCIAL = WebcastEvent.SOCIAL || 'social';
    const EVT_MEMBER = WebcastEvent.MEMBER || 'member';
    const EVT_ROOM_USER = WebcastEvent.ROOM_USER || 'roomUser';

    // Evento: Conectado à sala da live
    tiktokConnection.on(EVT_CONNECTED, (state) => {
      tiktokConnected = true;
      isConnecting = false;
      console.log(`[TIKTOK] Conectado à live de @${activeUsername} (roomId: ${state?.roomId || '?'})`);
      wss.clients.forEach(sendStatusToClient);
    });

    // Evento: Desconectado da live -> agenda reconexão em 10s
    tiktokConnection.on(EVT_DISCONNECTED, () => {
      const wasConnected = tiktokConnected;
      tiktokConnected = false;
      isConnecting = false;
      if (wasConnected) {
        console.warn('[TIKTOK] Desconectado da live. Reconectando em 10 segundos...');
      }
      wss.clients.forEach(sendStatusToClient);
      scheduleReconnect();
    });

    // Evento: Live encerrada pelo streamer -> agenda reconexão em 10s
    tiktokConnection.on(EVT_STREAM_END, () => {
      tiktokConnected = false;
      isConnecting = false;
      console.warn('[TIKTOK] A live foi encerrada. Tentando novamente em 10 segundos...');
      wss.clients.forEach(sendStatusToClient);
      scheduleReconnect();
    });

    // Evento: Erro interno da conexão TikTok (nunca deixa derrubar o Node.js)
    tiktokConnection.on(EVT_ERROR, (err) => {
      console.error('[TIKTOK] Erro na conexão:', err?.info || err?.message || err);
    });

    // 1) Comentários (chat) com anti-spam de 1s por usuário
    tiktokConnection.on(EVT_CHAT, (data) => {
      try {
        const { user, avatar } = extractUserData(data);
        const text = String(data?.comment || data?.content || data?.text || '').trim();
        if (!text) return;

        // Anti-spam: 1 comando por usuário a cada 1 segundo
        if (isRateLimited(user)) {
          return;
        }

        const payload = buildPayload({
          type: 'chat',
          user,
          avatar,
          text,
          giftName: '',
          giftCount: 1,
          diamonds: 0,
        });

        console.log(`[CHAT] @${user}: ${text}`);
        broadcastEvent(payload);
      } catch (err) {
        console.error('[CHAT] Erro ao processar comentário:', err.message);
      }
    });

    // 2) Presentes (gift) - trata combos contínuos (streak) sem duplicar
    tiktokConnection.on(EVT_GIFT, (data) => {
      try {
        // Em presentes repetíveis (giftType === 1), aguarda o fim do combo ou envia apenas ao finalizar
        if (data?.giftType === 1 && !data?.repeatEnd) {
          return;
        }

        const { user, avatar } = extractUserData(data);
        const giftName =
          data?.giftDetails?.giftName ||
          data?.giftName ||
          data?.extendedGiftInfo?.name ||
          'Presente';
        const giftCount = Number(data?.repeatCount) || 1;
        const unitDiamonds =
          Number(
            data?.giftDetails?.diamondCount ??
              data?.diamondCount ??
              data?.extendedGiftInfo?.diamond_count
          ) || 1;
        const totalDiamonds = unitDiamonds * giftCount;

        const payload = buildPayload({
          type: 'gift',
          user,
          avatar,
          text: `Enviou ${giftCount}x ${giftName}`,
          giftName,
          giftCount,
          diamonds: totalDiamonds,
        });

        console.log(`[GIFT] @${user} -> ${giftCount}x ${giftName} (${totalDiamonds} diamantes)`);
        broadcastEvent(payload);
      } catch (err) {
        console.error('[GIFT] Erro ao processar presente:', err.message);
      }
    });

    // 3) Curtidas (like)
    tiktokConnection.on(EVT_LIKE, (data) => {
      try {
        const { user, avatar } = extractUserData(data);
        const likeCount = Number(data?.likeCount) || 1;

        const payload = buildPayload({
          type: 'like',
          user,
          avatar,
          text: `Curtiu ${likeCount}x`,
          giftName: '',
          giftCount: likeCount,
          diamonds: 0,
        });

        broadcastEvent(payload);
      } catch (err) {
        console.error('[LIKE] Erro ao processar curtida:', err.message);
      }
    });

    // 4) Novos seguidores (follow)
    tiktokConnection.on(EVT_FOLLOW, (data) => {
      try {
        const { user, avatar } = extractUserData(data);

        const payload = buildPayload({
          type: 'follow',
          user,
          avatar,
          text: 'Seguiu a live!',
          giftName: '',
          giftCount: 1,
          diamonds: 0,
        });

        console.log(`[FOLLOW] @${user} seguiu!`);
        broadcastEvent(payload);
      } catch (err) {
        console.error('[FOLLOW] Erro ao processar follow:', err.message);
      }
    });

    // 5) Compartilhamentos (share)
    tiktokConnection.on(EVT_SHARE, (data) => {
      try {
        const { user, avatar } = extractUserData(data);

        const payload = buildPayload({
          type: 'share',
          user,
          avatar,
          text: 'Compartilhou a live!',
          giftName: '',
          giftCount: 1,
          diamonds: 0,
        });

        console.log(`[SHARE] @${user} compartilhou!`);
        broadcastEvent(payload);
      } catch (err) {
        console.error('[SHARE] Erro ao processar share:', err.message);
      }
    });

    // 5b) Eventos sociais unificados no v2 (follow / share via WebcastEvent.SOCIAL)
    if (EVT_SOCIAL !== EVT_FOLLOW && EVT_SOCIAL !== EVT_SHARE) {
      tiktokConnection.on(EVT_SOCIAL, (data) => {
        try {
          const { user, avatar } = extractUserData(data);
          const displayType = String(data?.common?.displayText?.key || data?.displayType || '').toLowerCase();
          const isShare = displayType.includes('share') || Number(data?.action) === 3;
          const isFollow = displayType.includes('follow') || Number(data?.action) === 1;
          if (!isShare && !isFollow) return;

          const type = isShare ? 'share' : 'follow';
          const payload = buildPayload({
            type,
            user,
            avatar,
            text: isShare ? 'Compartilhou a live!' : 'Seguiu a live!',
            giftName: '',
            giftCount: 1,
            diamonds: 0,
          });
          broadcastEvent(payload);
        } catch (err) {
          console.error('[SOCIAL] Erro ao processar evento social:', err.message);
        }
      });
    }

    // 6) Entrada de novos espectadores na sala (member -> type: "join")
    tiktokConnection.on(EVT_MEMBER, (data) => {
      try {
        const { user, avatar } = extractUserData(data);

        const payload = buildPayload({
          type: 'join',
          user,
          avatar,
          text: 'Entrou na live!',
          giftName: '',
          giftCount: 1,
          diamonds: 0,
        });

        broadcastEvent(payload);
      } catch (err) {
        console.error('[MEMBER] Erro ao processar entrada:', err.message);
      }
    });

    // 7) Contagem de espectadores ao vivo (roomUser)
    tiktokConnection.on(EVT_ROOM_USER, (data) => {
      try {
        const count = Number(data?.viewerCount) || 0;
        currentViewerCount = count;
        broadcastEvent({
          type: 'roomUser',
          user: 'system',
          avatar: '',
          text: String(count),
          giftName: '',
          giftCount: count,
          diamonds: 0,
          viewerCount: count,
        });
      } catch (err) {
        console.error('[ROOM_USER] Erro ao processar espectadores:', err.message);
      }
    });

    const state = await tiktokConnection.connect();
    tiktokConnected = true;
    isConnecting = false;
    console.log(`[TIKTOK] Live conectada! Room ID: ${state?.roomId || 'ativo'}`);
    wss.clients.forEach(sendStatusToClient);
  } catch (err) {
    tiktokConnected = false;
    isConnecting = false;
    console.warn(
      `[TIKTOK] Não foi possível conectar à live de @${activeUsername} (${err?.message || 'live offline'}). Nova tentativa em 10s...`
    );
    wss.clients.forEach(sendStatusToClient);
    scheduleReconnect();
  }
}

// ============================================================================
// PROTEÇÃO CONTRA QUEDAS INESPERADAS DO PROCESSO NODE.JS
// ============================================================================
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Exceção não capturada (servidor mantido ativo):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Promise rejeitada não tratada (servidor mantido ativo):', reason);
});

process.on('SIGTERM', () => {
  clearInterval(heartbeatInterval);
  clearInterval(antiSpamCleanupInterval);
  cleanupTikTokListeners();
  server.close(() => process.exit(0));
});

// Inicia o servidor HTTP + WebSocket e a conexão com a live
server.listen(PORT, HOST, () => {
  console.log(`🚀 Backend TikTok Live rodando em http://${HOST}:${PORT}`);
  console.log(`🩺 Healthcheck disponível em http://localhost:${PORT}/health`);
  console.log(`🧪 Teste simulado disponível via POST http://localhost:${PORT}/test`);
  connectToTikTokLive();
});
