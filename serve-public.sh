#!/usr/bin/env bash
# Start the game and expose it on public HTTPS via a Cloudflare tunnel.
#
#   ./serve-public.sh
#
# No port forwarding, no certificate, no router access - the tunnel dials out,
# so it works behind NAT, double NAT, or an ISP that blocks inbound traffic.
# Ctrl-C stops both the tunnel and the server.

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"
LOG="$(mktemp -t gdg-tunnel)"

command -v cloudflared >/dev/null || {
  echo "cloudflared is not installed.  macOS: brew install cloudflared" >&2
  echo "                               Debian/Kali: see cloudflare docs" >&2
  exit 1
}

[ -f .env ] || {
  echo "No .env - the host console will refuse every sign-in." >&2
  echo "Create it with:  echo 'ADMIN_PASSWORD=your-password' > .env" >&2
  exit 1
}

cleanup() {
  echo
  echo "shutting down..."
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null || true
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

echo "building..."
npm run build >/dev/null

echo "starting the game on :${PORT}..."
node server.js &
APP_PID=$!

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:${PORT}/healthz" && break
  sleep 0.25
done
curl -sf -o /dev/null "http://127.0.0.1:${PORT}/healthz" || {
  echo "the server never came up - check the output above" >&2
  exit 1
}

echo "opening the tunnel..."
cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TUNNEL_PID=$!

URL=""
for _ in $(seq 1 60); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

[ -n "$URL" ] || { echo "tunnel did not come up:"; tail -20 "$LOG"; exit 1; }

cat <<BANNER

  ------------------------------------------------------------
   PLAYERS   $URL/player
   HOST      $URL/admin
  ------------------------------------------------------------

  This URL is new every run - share it after starting, not before.
  Leave this window open for the whole meeting. Ctrl-C ends it.

BANNER

wait $TUNNEL_PID
