#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TRANSMISSÃO 24/7 NA VPS UBUNTU (720x1280 @ 30 FPS) -> RTMP (Restream / TikTok)
# Otimizado para VPS com 4 GB RAM e 2 vCPUs (AMD EPYC)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Carrega variáveis do .env
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

PORT="${PORT:-8080}"
RTMP_URL="${RTMP_URL:-rtmp://live.restream.io/live}"
RTMP_STREAM_KEY="${RTMP_STREAM_KEY:-}"
GAME_URL="http://127.0.0.1:${PORT}/live?ws=ws://127.0.0.1:${PORT}"

if [ -z "$RTMP_STREAM_KEY" ] || [ "$RTMP_STREAM_KEY" = "COLE_SUA_STREAM_KEY_AQUI" ]; then
  echo "❌ Defina RTMP_STREAM_KEY no arquivo backend/.env antes de iniciar."
  exit 1
fi

RTMP_TARGET="${RTMP_URL%/}/${RTMP_STREAM_KEY}"
DISPLAY_NUM=":99"
BROWSER_PROFILE="/tmp/racha-live-chrome-profile"

# Garante XDG_RUNTIME_DIR válido (necessário ao rodar PulseAudio como root na VPS)
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-racha-live}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Detecta Google Chrome ou Chromium instalado
BROWSER_BIN=""
for bin in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$bin" >/dev/null 2>&1; then
    BROWSER_BIN="$bin"
    break
  fi
done

if [ -z "$BROWSER_BIN" ]; then
  echo "❌ Google Chrome/Chromium não encontrado. Instale o google-chrome-stable primeiro."
  exit 1
fi

if ! command -v Xvfb >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  echo "❌ Instale xvfb e ffmpeg antes de rodar."
  exit 1
fi

cleanup() {
  echo "🛑 Encerrando stream da VPS..."
  kill "${BROWSER_PID:-}" "${XVFB_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Limpa travas antigas do Xvfb caso o processo anterior tenha caído
rm -f "/tmp/.X99-lock" "/tmp/.X11-unix/X99" 2>/dev/null || true
rm -rf "$BROWSER_PROFILE"

# 1) Áudio virtual (PulseAudio null sink) para capturar efeitos sonoros + locutor IA
AUDIO_ARGS=(-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100)
if command -v pulseaudio >/dev/null 2>&1 && command -v pactl >/dev/null 2>&1; then
  pulseaudio --check 2>/dev/null || pulseaudio -D --exit-idle-time=-1 --disallow-exit >/tmp/pulse.log 2>&1 || true
  sleep 1
  if ! pactl list short sinks 2>/dev/null | grep -q "virtual_live"; then
    pactl load-module module-null-sink sink_name=virtual_live sink_properties=device.description=VirtualLive >/dev/null 2>&1 || true
  fi
  pactl set-default-sink virtual_live >/dev/null 2>&1 || true
  if pactl list short sources 2>/dev/null | grep -q "virtual_live.monitor"; then
    AUDIO_ARGS=(-thread_queue_size 512 -f pulse -i virtual_live.monitor)
    echo "🔊 Áudio virtual PulseAudio (virtual_live.monitor) ativo."
  fi
fi

# 2) Tela virtual vertical 720x1280 (ideal para 2 vCPUs sem GPU)
echo "🖥️ Iniciando display virtual ${DISPLAY_NUM} (720x1280)..."
Xvfb "$DISPLAY_NUM" -screen 0 720x1280x24 -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!
sleep 2

export DISPLAY="$DISPLAY_NUM"

# 3) Abre o jogo em tela cheia dentro do display virtual
echo "🎮 Abrindo jogo em $GAME_URL via $BROWSER_BIN..."
"$BROWSER_BIN" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --autoplay-policy=no-user-gesture-required \
  --no-first-run \
  --no-default-browser-check \
  --disable-infobars \
  --kiosk \
  --app="$GAME_URL" \
  --window-size=720,1280 \
  --window-position=0,0 \
  --user-data-dir="$BROWSER_PROFILE" \
  >/tmp/chrome-live.log 2>&1 &
BROWSER_PID=$!

# Aguarda o canvas e o WebSocket estabilizarem antes de iniciar o RTMP
sleep 5

echo "📡 Transmitindo 720x1280 @ 30fps para ${RTMP_URL}/*** ..."
ffmpeg -hide_banner -loglevel warning \
  -thread_queue_size 512 -f x11grab -video_size 720x1280 -framerate 30 -i "${DISPLAY_NUM}.0" \
  "${AUDIO_ARGS[@]}" \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -b:v 2200k -maxrate 2400k -bufsize 4400k \
  -pix_fmt yuv420p -g 60 -keyint_min 60 \
  -c:a aac -b:a 128k -ar 44100 -ac 2 \
  -f flv "$RTMP_TARGET"
