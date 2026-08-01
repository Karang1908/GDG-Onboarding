/* Connection status. Loaded after the page script, so `socket` is already in
   scope. A dropped wifi mid-meeting otherwise looks like a frozen screen. */
(function () {
  if (typeof socket === 'undefined') return;

  const el = document.createElement('div');
  el.className = 'conn-banner hidden';
  el.setAttribute('role', 'status');
  el.textContent = 'Reconnecting…';
  document.body.appendChild(el);

  let showTimer = null;

  // Sit just above the footer. Measured rather than hardcoded, because the
  // footer stacks taller on narrow screens and a guessed offset overlaps it.
  function place() {
    const footer = document.querySelector('.footer');
    el.style.bottom = (footer ? footer.offsetHeight + 16 : 24) + 'px';
  }

  // A blip during a normal reconnect is not worth a banner; only surface it
  // once the outage has actually lasted a moment.
  function scheduleShow() {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      place();
      el.classList.remove('hidden');
    }, 1200);
  }

  window.addEventListener('resize', () => {
    if (!el.classList.contains('hidden')) place();
  });

  function hide() {
    clearTimeout(showTimer);
    el.classList.add('hidden');
  }

  socket.on('disconnect', scheduleShow);
  socket.on('connect_error', scheduleShow);
  socket.on('connect', hide);
})();
