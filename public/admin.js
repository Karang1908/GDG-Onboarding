const socket = io();

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const wheelEmpty = document.getElementById('wheel-empty');
const pointer = document.getElementById('pointer');
const spinBtn = document.getElementById('spin-btn');
const resetBtn = document.getElementById('reset-btn');
const revealBtn = document.getElementById('reveal-btn');
const nextBtn = document.getElementById('next-btn');
const skipBtn = document.getElementById('skip-btn');
const spotlight = document.getElementById('spotlight');
const spotlightEmpty = document.getElementById('spotlight-empty');
const roster = document.getElementById('roster');
const rosterEmpty = document.getElementById('roster-empty');
const playerCount = document.getElementById('player-count');

// The four Google brand colours, in brand order.
const BRAND = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
const SPIN_MS = 5200;

let state = { players: [], current: null, revealed: false };
let pendingState = null;
let spinning = false;
let rotation = 0;

/* ---------- theme-aware palette ---------- */

function readPalette() {
  const s = getComputedStyle(document.documentElement);
  const v = (n, fallback) => (s.getPropertyValue(n) || fallback).trim();
  return {
    rim: v('--wheel-rim', '#ffffff'),
    ink: v('--wheel-ink', '#202124'),
    doneFill: v('--surface-3', '#f1f3f4'),
    doneInk: v('--text-3', '#80868b'),
    hubBg: v('--bg', '#ffffff'),
    hubBorder: v('--border', '#dadce0'),
    hubInk: v('--text', '#202124'),
  };
}

let palette = readPalette();

window.addEventListener('themechange', () => {
  palette = readPalette();
  drawWheel();
});

/* ---------- wheel ---------- */

function segments() {
  return state.players.filter((p) => p.submitted);
}

// Cycling four colours would make the first and last slice match whenever the
// count leaves a remainder of one; nudge the last slice so neighbours differ.
function sliceColor(i, n) {
  if (n > 1 && i === n - 1 && n % 4 === 1) return BRAND[1];
  return BRAND[i % 4];
}

// 20-35 players is the real roster size, so the label has to degrade: full
// name, then first name, then a clipped first name.
function fitLabel(name, maxWidth) {
  if (ctx.measureText(name).width <= maxWidth) return name;
  const first = String(name).split(/\s+/)[0];
  if (ctx.measureText(first).width <= maxWidth) return first;
  let s = first;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

function drawWheel() {
  const items = segments();
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 16;
  const hub = Math.max(70, radius * 0.17);

  ctx.clearRect(0, 0, size, size);

  if (items.length === 0) {
    canvas.classList.add('hidden');
    pointer.classList.add('hidden');
    wheelEmpty.classList.remove('hidden');
    return;
  }
  canvas.classList.remove('hidden');
  pointer.classList.remove('hidden');
  wheelEmpty.classList.add('hidden');

  const n = items.length;
  const seg = (Math.PI * 2) / n;
  const textRadius = radius * 0.62;
  const arcPerSlice = (Math.PI * 2 * textRadius) / n;
  const fontSize = Math.min(52, Math.max(13, arcPerSlice * 0.62));
  const maxWidth = radius - hub - 46;

  ctx.font = `700 ${fontSize}px 'Google Sans', system-ui, sans-serif`;

  items.forEach((player, i) => {
    const start = rotation + i * seg;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + seg);
    ctx.closePath();
    ctx.fillStyle = player.done ? palette.doneFill : sliceColor(i, n);
    ctx.fill();

    // The rim is the page background, so slices read as separated tiles even
    // after a video call re-compresses the frame.
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = n > 24 ? 3 : 5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    const mid = start + seg / 2;
    ctx.rotate(mid);

    let angle = mid % (Math.PI * 2);
    if (angle < 0) angle += Math.PI * 2;
    const flipped = angle > Math.PI / 2 && angle < (Math.PI * 3) / 2;
    if (flipped) ctx.rotate(Math.PI);

    ctx.textAlign = flipped ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    // Dark ink on every brand colour: it clears 4.2:1 on all four, where white
    // would fall to 3.0:1 on the green.
    ctx.fillStyle = player.done ? palette.doneInk : palette.ink;
    ctx.font = `700 ${fontSize}px 'Google Sans', system-ui, sans-serif`;

    const label = fitLabel(player.name, maxWidth);
    ctx.fillText(label, flipped ? -(radius - 30) : radius - 30, 0);
    ctx.restore();
  });

  // Hub
  ctx.beginPath();
  ctx.arc(cx, cy, hub, 0, Math.PI * 2);
  ctx.fillStyle = palette.hubBg;
  ctx.fill();
  ctx.strokeStyle = palette.hubBorder;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = palette.hubInk;
  ctx.font = `700 ${hub * 0.44}px 'Google Sans', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GDG', cx, cy);
}

function targetRotationFor(index, count) {
  const twoPi = Math.PI * 2;
  const seg = twoPi / count;
  let target = -Math.PI / 2 - (index + 0.5) * seg;
  target -= twoPi * Math.floor((target - rotation) / twoPi);
  return target + twoPi * 6;
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function spinTo(index, count) {
  const from = rotation;
  const to = targetRotationFor(index, count);
  const start = performance.now();
  spinning = true;
  updateControls();

  function frame(now) {
    const t = Math.min(1, (now - start) / SPIN_MS);
    rotation = from + (to - from) * easeOutQuart(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      spinning = false;
      applyPending();
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- rendering ---------- */

function icon(id, cls = 'icon icon-sm') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#${id}" /></svg>`;
}

function renderRoster() {
  roster.innerHTML = '';
  playerCount.textContent = String(state.players.length);
  rosterEmpty.classList.toggle('hidden', state.players.length > 0);

  const wheelOrder = segments();

  for (const player of state.players) {
    const li = document.createElement('li');
    if (state.current && state.current.id === player.id) {
      li.classList.add('is-current');
    }
    if (player.done) li.classList.add('is-done');

    // Swatch matches this player's slice, so a name on screen maps to the wheel.
    const swatch = document.createElement('span');
    swatch.className = 'roster-swatch';
    const idx = wheelOrder.findIndex((p) => p.id === player.id);
    swatch.style.background =
      idx === -1
        ? 'var(--border-strong)'
        : player.done
          ? 'var(--text-3)'
          : sliceColor(idx, wheelOrder.length);

    const name = document.createElement('span');
    name.className = 'roster-name';
    name.textContent = player.name;

    const chip = document.createElement('span');
    chip.className = 'chip';
    if (player.done) {
      chip.textContent = 'Done';
      chip.classList.add('chip-done');
    } else if (player.submitted) {
      chip.textContent = 'Ready';
      chip.classList.add('chip-ready');
    } else {
      chip.textContent = 'Writing';
    }

    const remove = document.createElement('button');
    remove.className = 'roster-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${player.name}`);
    remove.innerHTML = icon('i-close');
    remove.addEventListener('click', () => {
      socket.emit('admin:remove', player.id);
    });

    li.append(swatch, name, chip, remove);
    roster.appendChild(li);
  }
}

function renderSpotlight() {
  const current = state.current;
  spotlight.classList.toggle('hidden', !current);
  spotlightEmpty.classList.toggle('hidden', Boolean(current));
  if (!current) return;

  document.getElementById('spotlight-name').textContent = current.name;

  const list = document.getElementById('spotlight-statements');
  list.innerHTML = '';
  current.statements.forEach((text, i) => {
    const li = document.createElement('li');

    const body = document.createElement('span');
    body.textContent = text;
    li.appendChild(body);

    // lieIndex is null until the host reveals — the server withholds it, so
    // there is nothing here to read ahead in devtools.
    if (state.revealed && current.lieIndex !== null) {
      const isLie = i === current.lieIndex;
      li.classList.add(isLie ? 'is-lie' : 'is-truth');
      const verdict = document.createElement('span');
      verdict.className = 'verdict';
      // A word and a glyph, never colour alone.
      verdict.innerHTML =
        icon(isLie ? 'i-close' : 'i-check') +
        `<span>${isLie ? 'Lie' : 'True'}</span>`;
      li.appendChild(verdict);
    } else {
      li.appendChild(document.createElement('span'));
    }
    list.appendChild(li);
  });

  revealBtn.disabled = state.revealed;
  revealBtn.textContent = state.revealed ? 'Revealed' : 'Reveal the lie';

  // No moving on until the room has actually been shown the answer.
  nextBtn.disabled = !state.revealed;
  nextBtn.title = state.revealed ? '' : 'Reveal the lie first';
}

function updateControls() {
  const eligible = state.players.filter((p) => p.submitted && !p.done).length;
  spinBtn.disabled = spinning || eligible === 0 || Boolean(state.current);
  spinBtn.textContent = spinning
    ? 'Spinning…'
    : eligible === 0
      ? state.players.length === 0
        ? 'Waiting for players'
        : 'Everyone has had a turn'
      : 'Spin the wheel';
}

function renderAll() {
  drawWheel();
  renderRoster();
  renderSpotlight();
  updateControls();
}

function applyPending() {
  if (!pendingState) {
    renderAll();
    return;
  }
  state = pendingState;
  pendingState = null;
  renderAll();
}

/* ---------- events ---------- */

socket.on('admin:state', (next) => {
  if (spinning) {
    pendingState = next;
    return;
  }
  state = next;
  renderAll();
});

spinBtn.addEventListener('click', () => {
  if (spinning) return;
  socket.emit('admin:spin', (res) => {
    if (res?.error) return;

    let items = segments();
    let index = items.findIndex((p) => p.id === res.winnerId);

    if (index === -1 && pendingState) {
      state = pendingState;
      pendingState = null;
      drawWheel();
      items = segments();
      index = items.findIndex((p) => p.id === res.winnerId);
    }
    if (index === -1) return;

    spinTo(index, items.length);
  });
});

revealBtn.addEventListener('click', () => socket.emit('admin:reveal'));
nextBtn.addEventListener('click', () => socket.emit('admin:next'));
skipBtn.addEventListener('click', () => socket.emit('admin:skip'));

resetBtn.addEventListener('click', () => {
  const n = state.players.length;
  const msg =
    `Master Reset\n\nThis wipes the whole game — all ${n} player${n === 1 ? '' : 's'}, ` +
    'their statements, and every turn taken so far.\n\n' +
    'Everyone gets sent back to the start to enter their name again. ' +
    'This cannot be undone.';
  if (confirm(msg)) {
    socket.emit('admin:reset');
  }
});

/* ---------- sign-in gate ---------- */

const lock = document.getElementById('lock');
const consolePanel = document.getElementById('console');
const pwField = document.getElementById('pw-field');
const pwInput = document.getElementById('pw-input');
const pwBtn = document.getElementById('pw-btn');
const pwError = document.getElementById('pw-error');
const PW_KEY = 'ttl-admin-pw';

function setPwError(message) {
  pwError.innerHTML = message
    ? `${icon('i-error')}<span></span>`
    : '';
  if (message) pwError.querySelector('span').textContent = message;
  pwField.classList.toggle('field-error', Boolean(message));
}

function signIn(password, fromStorage) {
  socket.emit('admin:hello', password, (res) => {
    if (res?.ok) {
      sessionStorage.setItem(PW_KEY, password);
      lock.classList.add('hidden');
      consolePanel.classList.remove('hidden');
      palette = readPalette();
      drawWheel(); // the canvas only has real dimensions now that it is visible
      return;
    }
    sessionStorage.removeItem(PW_KEY);
    lock.classList.remove('hidden');
    consolePanel.classList.add('hidden');
    if (!fromStorage) {
      setPwError(res?.error || 'Wrong password.');
      pwInput.focus();
      pwInput.select();
    }
    pwBtn.disabled = false;
  });
}

pwBtn.addEventListener('click', () => {
  setPwError('');
  const value = pwInput.value;
  if (!value) {
    setPwError('Enter the host password.');
    pwInput.focus();
    return;
  }
  pwBtn.disabled = true;
  signIn(value, false);
});

pwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') pwBtn.click();
});

socket.on('connect', () => {
  const saved = sessionStorage.getItem(PW_KEY);
  if (saved) signIn(saved, true);
});

drawWheel();
