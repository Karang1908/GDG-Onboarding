const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

// Local dev reads .env; on Render the vars come from the dashboard instead, so a
// missing file here is normal and must not be fatal.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  /* no .env present - fall back to the real environment */
}

const PORT = process.env.PORT || 3000;
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'state.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_STATEMENT_LENGTH = 240;
const MAX_NAME_LENGTH = 32;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/*
 * Game state lives in this process. Render runs one long-lived container, so a
 * plain object is the shared source of truth for every connected client.
 * state.json is a crash-restart safety net only - it does not survive a redeploy.
 *
 * A player record holds `statements` already shuffled and `lieIndex` pointing
 * into that shuffled array. Nothing outside adminView()/playerView() should ever
 * hand a raw player record to a socket.
 */
let state = {
  players: [],
  currentPlayerId: null,
  revealed: false,
};

/* ---------- persistence ---------- */

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.players)) {
      state = {
        players: parsed.players,
        currentPlayerId: parsed.currentPlayerId ?? null,
        revealed: Boolean(parsed.revealed),
      };
      console.log(`Restored ${state.players.length} player(s) from ${STATE_FILE}`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Could not read saved state, starting fresh:', err.message);
    }
  }
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(state), (err) => {
      if (err) console.warn('Could not save state:', err.message);
    });
  }, 250);
}

/* ---------- helpers ---------- */

function findPlayer(id) {
  return state.players.find((p) => p.id === id) || null;
}

// Constant-time compare so the password can't be probed a character at a time.
function passwordMatches(supplied) {
  if (!ADMIN_PASSWORD) return false;
  const given = Buffer.from(String(supplied ?? ''));
  const real = Buffer.from(ADMIN_PASSWORD);
  if (given.length !== real.length) return false;
  return crypto.timingSafeEqual(given, real);
}

function shuffleStatements(statements, lieIndex) {
  const items = statements.map((text, i) => ({ text, isLie: i === lieIndex }));
  for (let i = items.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return {
    statements: items.map((it) => it.text),
    lieIndex: items.findIndex((it) => it.isLie),
  };
}

// What the admin screen is allowed to know. The lie is withheld until reveal.
function adminView() {
  const current = state.currentPlayerId ? findPlayer(state.currentPlayerId) : null;
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      submitted: p.submitted,
      done: p.done,
    })),
    revealed: state.revealed,
    current: current
      ? {
          id: current.id,
          name: current.name,
          statements: current.statements,
          // Only ever present once the admin has pressed Reveal.
          lieIndex: state.revealed ? current.lieIndex : null,
        }
      : null,
  };
}

function playerView(playerId) {
  const player = findPlayer(playerId);
  if (!player) return { stage: 'name' };
  return {
    stage: player.submitted ? 'submitted' : 'statements',
    id: player.id,
    name: player.name,
    isCurrent: state.currentPlayerId === player.id,
    revealed: state.currentPlayerId === player.id && state.revealed,
    done: player.done,
    statements: player.submitted ? player.statements : null,
    lieIndex:
      player.submitted && state.currentPlayerId === player.id && state.revealed
        ? player.lieIndex
        : null,
  };
}

function broadcast() {
  io.to('admin').emit('admin:state', adminView());
  for (const player of state.players) {
    io.to(`player:${player.id}`).emit('player:state', playerView(player.id));
  }
  saveState();
}

/* ---------- routes ---------- */

app.use(express.static(path.join(__dirname, 'public')));

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Plain 200 endpoint for UptimeRobot to ping so Render's free tier stays awake.
app.get('/healthz', (req, res) => {
  res.type('text').send('ok');
});

/* ---------- sockets ---------- */

io.on('connection', (socket) => {
  // Gate every admin action, not just the handshake - otherwise anyone could
  // open a raw socket and emit admin:spin without ever loading the page.
  const isAdmin = () => socket.data.isAdmin === true;

  socket.on('admin:hello', (password, ack) => {
    if (!ADMIN_PASSWORD) {
      return ack?.({ error: 'Server has no ADMIN_PASSWORD set. See README.' });
    }
    if (!passwordMatches(password)) {
      return ack?.({ error: 'Wrong password.' });
    }
    socket.data.isAdmin = true;
    socket.join('admin');
    ack?.({ ok: true });
    socket.emit('admin:state', adminView());
  });

  // Resume an existing player session after a refresh.
  socket.on('player:hello', (playerId, ack) => {
    const player = typeof playerId === 'string' ? findPlayer(playerId) : null;
    if (player) {
      socket.data.playerId = player.id;
      socket.join(`player:${player.id}`);
    }
    if (typeof ack === 'function') ack(playerView(player ? player.id : null));
  });

  socket.on('player:join', (rawName, ack) => {
    const name = String(rawName || '').trim().slice(0, MAX_NAME_LENGTH);
    if (!name) {
      return ack?.({ error: 'Please enter your name.' });
    }
    const taken = state.players.some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (taken) {
      return ack?.({ error: 'That name is already taken. Try adding a surname.' });
    }

    const player = {
      id: crypto.randomUUID(),
      name,
      statements: [],
      lieIndex: null,
      submitted: false,
      done: false,
    };
    state.players.push(player);

    socket.data.playerId = player.id;
    socket.join(`player:${player.id}`);

    ack?.({ state: playerView(player.id) });
    broadcast();
  });

  socket.on('player:submit', (payload, ack) => {
    const player = findPlayer(socket.data.playerId);
    if (!player) return ack?.({ error: 'Session expired. Please rejoin.' });
    if (player.submitted) return ack?.({ error: 'You have already submitted.' });

    const raw = Array.isArray(payload?.statements) ? payload.statements : [];
    const statements = raw.map((s) =>
      String(s || '').trim().slice(0, MAX_STATEMENT_LENGTH)
    );
    const lieIndex = Number(payload?.lieIndex);

    if (statements.length !== 3 || statements.some((s) => !s)) {
      return ack?.({ error: 'Please fill in all three statements.' });
    }
    if (!Number.isInteger(lieIndex) || lieIndex < 0 || lieIndex > 2) {
      return ack?.({ error: 'Please mark which statement is the lie.' });
    }

    // Shuffle so the lie is not always in the slot the player typed it into.
    const shuffled = shuffleStatements(statements, lieIndex);
    player.statements = shuffled.statements;
    player.lieIndex = shuffled.lieIndex;
    player.submitted = true;

    ack?.({ state: playerView(player.id) });
    broadcast();
  });

  /* ----- admin actions ----- */

  socket.on('admin:spin', (ack) => {
    if (!isAdmin()) return ack?.({ error: 'Not signed in as host.' });
    const pool = state.players.filter((p) => p.submitted && !p.done);
    if (pool.length === 0) {
      return ack?.({ error: 'Nobody left to pick.' });
    }
    const winner = pool[crypto.randomInt(pool.length)];
    state.currentPlayerId = winner.id;
    state.revealed = false;

    // The client animates the wheel to this player; the server decides who won
    // so every screen agrees and only eligible players can be picked.
    ack?.({ winnerId: winner.id });
    broadcast();
  });

  socket.on('admin:reveal', () => {
    if (!isAdmin()) return;
    if (!state.currentPlayerId) return;
    state.revealed = true;
    broadcast();
  });

  // Finish the current turn: grey the player out so they are never picked again.
  socket.on('admin:next', () => {
    if (!isAdmin()) return;
    const current = findPlayer(state.currentPlayerId);
    if (current) current.done = true;
    state.currentPlayerId = null;
    state.revealed = false;
    broadcast();
  });

  // Put the current player back in the pool without burning their turn.
  socket.on('admin:skip', () => {
    if (!isAdmin()) return;
    state.currentPlayerId = null;
    state.revealed = false;
    broadcast();
  });

  socket.on('admin:remove', (playerId) => {
    if (!isAdmin()) return;
    state.players = state.players.filter((p) => p.id !== playerId);
    if (state.currentPlayerId === playerId) {
      state.currentPlayerId = null;
      state.revealed = false;
    }
    io.to(`player:${playerId}`).emit('player:state', { stage: 'name' });
    broadcast();
  });

  // Master Reset: wipe the game and send every player screen back to the start
  // so the same room can play again.
  socket.on('admin:reset', () => {
    if (!isAdmin()) return;
    state = { players: [], currentPlayerId: null, revealed: false };

    // Broadcast to everyone connected, not just the players we still hold a
    // record for — a client whose record already went (removed, or joined
    // mid-reset) must also drop its stored session.
    io.emit('game:reset');
    broadcast();
  });
});

loadState();
server.listen(PORT, () => {
  if (!ADMIN_PASSWORD) {
    console.error(
      '\n  !!  ADMIN_PASSWORD is not set - the host page will refuse to sign in.\n' +
        '      Local: put ADMIN_PASSWORD=... in .env   Render: set it in the dashboard.\n'
    );
  }
  console.log(`Two Truths and a Lie running on http://localhost:${PORT}`);
});
