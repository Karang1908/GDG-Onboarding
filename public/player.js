const socket = io();
const STORAGE_KEY = 'ttl-player-id';

const stages = {
  name: document.getElementById('stage-name'),
  statements: document.getElementById('stage-statements'),
  waiting: document.getElementById('stage-waiting'),
  turn: document.getElementById('stage-turn'),
};

const stepper = document.getElementById('stepper');
const stepDots = [...document.querySelectorAll('.step-dot')];
const nameField = document.getElementById('name-field');
const nameInput = document.getElementById('name-input');
const nameError = document.getElementById('name-error');
const joinBtn = document.getElementById('join-btn');
const submitBtn = document.getElementById('submit-btn');
const submitError = document.getElementById('submit-error');
const textareas = [...document.querySelectorAll('textarea[data-statement]')];
const lieOptions = [...document.querySelectorAll('.lie-option')];

let selectedLie = null;

const ERROR_ICON =
  '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-error" /></svg>';

function setError(el, message) {
  el.innerHTML = message ? ERROR_ICON + '<span></span>' : '';
  if (message) el.querySelector('span').textContent = message;
}

// Steps 1 and 2 are the two things the player does; step 3 is being in the game.
function setStep(n) {
  stepper.setAttribute('aria-valuenow', String(n));
  stepDots.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === n - 1);
    dot.classList.toggle('is-done', i < n - 1);
  });
}

function show(stage) {
  for (const [key, el] of Object.entries(stages)) {
    el.classList.toggle('hidden', key !== stage);
  }
}

function renderStatementList(el, statements, lieIndex) {
  el.innerHTML = '';
  (statements || []).forEach((text, i) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (Number.isInteger(lieIndex)) {
      const isLie = i === lieIndex;
      li.classList.add(isLie ? 'is-lie' : 'is-truth');
      const tag = document.createElement('strong');
      tag.className = 'verdict';
      tag.textContent = isLie ? ' — Lie' : ' — True';
      li.appendChild(tag);
    }
    el.appendChild(li);
  });
}

function render(view) {
  if (!view || view.stage === 'name') {
    localStorage.removeItem(STORAGE_KEY);
    setStep(1);
    show('name');
    return;
  }

  if (view.stage === 'statements') {
    const first = String(view.name || '').split(' ')[0];
    document.getElementById('greet-heading').textContent = first
      ? `Over to you, ${first}`
      : 'Your three statements';
    setStep(2);
    show('statements');
    return;
  }

  setStep(3);

  if (view.isCurrent) {
    renderStatementList(
      document.getElementById('turn-statements'),
      view.statements,
      view.revealed ? view.lieIndex : null
    );
    show('turn');
    return;
  }

  document.getElementById('waiting-title').textContent = view.done
    ? 'That was your turn'
    : `You're in, ${String(view.name || '').split(' ')[0]}`;
  document.getElementById('waiting-note').textContent = view.done
    ? 'Thanks for playing along. Sit back and watch everyone else squirm.'
    : 'Your answers are locked. Keep this screen open — it will tell you the moment the wheel lands on you.';
  renderStatementList(
    document.getElementById('waiting-statements'),
    view.statements,
    null
  );
  show('waiting');
}

/* ---------- name ---------- */

function join() {
  const name = nameInput.value.trim();
  setError(nameError, '');
  nameField.classList.remove('field-error');
  if (!name) {
    setError(nameError, 'Enter your name to continue.');
    nameField.classList.add('field-error');
    nameInput.focus();
    return;
  }
  joinBtn.disabled = true;
  socket.emit('player:join', name, (res) => {
    joinBtn.disabled = false;
    if (res.error) {
      setError(nameError, res.error);
      nameField.classList.add('field-error');
      nameInput.focus();
      return;
    }
    localStorage.setItem(STORAGE_KEY, res.state.id);
    render(res.state);
  });
}

joinBtn.addEventListener('click', join);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') join();
});

/* ---------- statements ---------- */

lieOptions.forEach((opt) => {
  opt.addEventListener('click', () => {
    selectedLie = Number(opt.dataset.lie);
    lieOptions.forEach((o) =>
      o.setAttribute('aria-pressed', String(o === opt))
    );
    setError(submitError, '');
  });
});

submitBtn.addEventListener('click', () => {
  setError(submitError, '');
  const statements = textareas.map((t) => t.value.trim());

  const firstEmpty = statements.findIndex((s) => !s);
  if (firstEmpty !== -1) {
    setError(submitError, 'Fill in all three statements before locking in.');
    textareas[firstEmpty].focus();
    return;
  }
  if (selectedLie === null) {
    setError(submitError, 'Mark which one is the lie.');
    lieOptions[0].focus();
    return;
  }

  submitBtn.disabled = true;
  socket.emit('player:submit', { statements, lieIndex: selectedLie }, (res) => {
    submitBtn.disabled = false;
    if (res.error) {
      setError(submitError, res.error);
      return;
    }
    render(res.state);
  });
});

/* ---------- live ---------- */

socket.on('player:state', render);

// Master Reset from the host: drop the stored session AND empty the form, so
// the next round starts genuinely blank rather than pre-filled with old answers.
socket.on('game:reset', () => {
  localStorage.removeItem(STORAGE_KEY);
  selectedLie = null;
  nameInput.value = '';
  textareas.forEach((t) => {
    t.value = '';
  });
  lieOptions.forEach((o) => o.setAttribute('aria-pressed', 'false'));
  nameField.classList.remove('field-error');
  setError(nameError, '');
  setError(submitError, '');
  joinBtn.disabled = false;
  submitBtn.disabled = false;
  render({ stage: 'name' });
});

socket.on('connect', () => {
  socket.emit('player:hello', localStorage.getItem(STORAGE_KEY), render);
});
