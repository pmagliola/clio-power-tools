// Clio Power Tools — floating timer content script
// Runs on app.clio.com. No imports — communicates with background.js via chrome.runtime.sendMessage.

(function () {
  'use strict';

  // ─── Guard against double injection ─────────────────────────────────────────

  if (document.getElementById('cpt-timer')) return;

  // ─── Matter detection ────────────────────────────────────────────────────────

  function getMatterIdFromUrl() {
    const hash = window.location.hash;
    const match = hash.match(/\/matters\/(\d+)/);
    return match ? match[1] : null;
  }

  // ─── Build the widget DOM ────────────────────────────────────────────────────

  function buildWidget() {
    const el = document.createElement('div');
    el.id = 'cpt-timer';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Clio Power Tools timer');
    el.innerHTML = `
      <div id="cpt-header">
        <span id="cpt-matter-name">No matter selected</span>
        <button id="cpt-minimize" title="Minimise" aria-label="Minimise timer">&#8722;</button>
      </div>
      <div id="cpt-body">
        <div id="cpt-display" aria-live="polite">0:00:00</div>
        <div id="cpt-controls">
          <button id="cpt-start-stop" class="cpt-btn cpt-btn-primary">Start</button>
          <button id="cpt-reset" class="cpt-btn">Reset</button>
          <button id="cpt-log" class="cpt-btn cpt-btn-log" disabled>Log</button>
        </div>
      </div>
    `;
    return el;
  }

  // ─── Timer display ───────────────────────────────────────────────────────────

  let tickInterval = null;

  function formatSeconds(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateDisplay(seconds) {
    const el = document.getElementById('cpt-display');
    if (el) el.textContent = formatSeconds(seconds);
  }

  function updateMatterDisplay(name) {
    const el = document.getElementById('cpt-matter-name');
    if (el) el.textContent = name || 'No matter selected';
  }

  function setRunningUI(running) {
    const startStop = document.getElementById('cpt-start-stop');
    const logBtn = document.getElementById('cpt-log');
    if (!startStop) return;
    startStop.textContent = running ? 'Pause' : 'Start';
    startStop.classList.toggle('cpt-btn-running', running);
    if (logBtn) logBtn.disabled = running;
  }

  // ─── Timer state (chrome.storage.local) ─────────────────────────────────────
  // Keys: timerState ('idle'|'running'|'paused'), startTime (ms), accumulatedSeconds,
  //       currentMatterId, currentMatterName

  async function restoreState() {
    const state = await chrome.storage.local.get([
      'timerState',
      'startTime',
      'accumulatedSeconds',
      'currentMatterName',
    ]);

    const accumulated = state.accumulatedSeconds || 0;

    if (state.timerState === 'running' && state.startTime) {
      const elapsed = accumulated + Math.floor((Date.now() - state.startTime) / 1000);
      updateDisplay(elapsed);
      startTicking(accumulated, state.startTime);
      setRunningUI(true);
    } else {
      updateDisplay(accumulated);
      setRunningUI(false);
    }

    updateMatterDisplay(state.currentMatterName || null);
    refreshMatterContext();
  }

  function startTicking(accumulatedSeconds, startTime) {
    stopTicking();
    tickInterval = setInterval(() => {
      const elapsed = accumulatedSeconds + Math.floor((Date.now() - startTime) / 1000);
      updateDisplay(elapsed);
    }, 1000);
  }

  function stopTicking() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  // ─── Controls ────────────────────────────────────────────────────────────────

  async function onStartStop() {
    const state = await chrome.storage.local.get([
      'timerState',
      'startTime',
      'accumulatedSeconds',
    ]);

    if (state.timerState === 'running') {
      // Pause
      const elapsed =
        (state.accumulatedSeconds || 0) +
        Math.floor((Date.now() - state.startTime) / 1000);
      stopTicking();
      await chrome.storage.local.set({
        timerState: 'paused',
        accumulatedSeconds: elapsed,
      });
      updateDisplay(elapsed);
      setRunningUI(false);
    } else {
      // Start / resume
      const startTime = Date.now();
      await chrome.storage.local.set({ timerState: 'running', startTime });
      startTicking(state.accumulatedSeconds || 0, startTime);
      setRunningUI(true);
      refreshMatterContext();
    }
  }

  async function onReset() {
    stopTicking();
    await chrome.storage.local.set({
      timerState: 'idle',
      startTime: null,
      accumulatedSeconds: 0,
    });
    updateDisplay(0);
    setRunningUI(false);
  }

  // ─── Log dialog ──────────────────────────────────────────────────────────────

  async function onLog() {
    const state = await chrome.storage.local.get([
      'accumulatedSeconds',
      'currentMatterId',
      'currentMatterName',
    ]);

    const seconds = state.accumulatedSeconds || 0;
    if (seconds === 0) return;

    document.getElementById('cpt-dialog')?.remove();

    const today = new Date().toISOString().slice(0, 10);
    const matterLabel = state.currentMatterName
      || (state.currentMatterId ? `Matter ${state.currentMatterId}` : 'No matter — will log without matter');

    const dialog = document.createElement('div');
    dialog.id = 'cpt-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Log time entry');
    dialog.innerHTML = `
      <div id="cpt-dialog-inner">
        <h3>Log Time Entry</h3>
        <div class="cpt-field">
          <label>Matter</label>
          <div class="cpt-field-value">${escapeHtml(matterLabel)}</div>
        </div>
        <div class="cpt-field">
          <label>Duration</label>
          <div class="cpt-field-value">${formatSeconds(seconds)}</div>
        </div>
        <div class="cpt-field">
          <label for="cpt-dialog-date">Date</label>
          <input type="date" id="cpt-dialog-date" value="${today}">
        </div>
        <div class="cpt-field">
          <label for="cpt-dialog-desc">Description</label>
          <input type="text" id="cpt-dialog-desc" placeholder="Optional note">
        </div>
        <div class="cpt-dialog-actions">
          <button id="cpt-dialog-cancel" class="cpt-btn">Cancel</button>
          <button id="cpt-dialog-save" class="cpt-btn cpt-btn-primary">Save to Clio</button>
        </div>
        <div id="cpt-dialog-status" aria-live="polite"></div>
      </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('cpt-dialog-cancel').addEventListener('click', () => dialog.remove());
    document.getElementById('cpt-dialog-save').addEventListener('click', () =>
      submitTimeEntry(dialog, state),
    );

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  async function submitTimeEntry(dialog, state) {
    const saveBtn = document.getElementById('cpt-dialog-save');
    const statusEl = document.getElementById('cpt-dialog-status');
    const date = document.getElementById('cpt-dialog-date').value;
    const description = document.getElementById('cpt-dialog-desc').value.trim();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    statusEl.textContent = '';
    statusEl.className = '';

    const result = await chrome.runtime.sendMessage({
      type: 'CREATE_TIME_ENTRY',
      payload: {
        matterId: state.currentMatterId || null,
        seconds: state.accumulatedSeconds,
        date,
        description: description || null,
      },
    });

    if (result.error) {
      statusEl.textContent = result.error;
      statusEl.className = 'cpt-status-error';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to Clio';
      return;
    }

    statusEl.textContent = 'Saved!';
    statusEl.className = 'cpt-status-success';
    setTimeout(async () => {
      dialog.remove();
      await onReset();
    }, 800);
  }

  // ─── Minimise ─────────────────────────────────────────────────────────────────

  function onMinimise() {
    const body = document.getElementById('cpt-body');
    const btn = document.getElementById('cpt-minimize');
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';
    if (btn) btn.innerHTML = isHidden ? '&#8722;' : '&#43;';
  }

  // ─── Drag ─────────────────────────────────────────────────────────────────────

  function makeDraggable(el) {
    const header = el.querySelector('#cpt-header');
    let dragging = false;
    let startX, startY, origLeft, origTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = `${origLeft + e.clientX - startX}px`;
      el.style.top = `${origTop + e.clientY - startY}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  // ─── Matter context ───────────────────────────────────────────────────────────

  async function refreshMatterContext() {
    const matterId = getMatterIdFromUrl();

    const stored = await chrome.storage.local.get('currentMatterId');
    if (stored.currentMatterId === matterId) return;

    await chrome.storage.local.set({
      currentMatterId: matterId || null,
      currentMatterName: null,
    });
    updateMatterDisplay(null);

    if (!matterId) return;

    // Fetch matter name from background service worker
    const matter = await chrome.runtime.sendMessage({
      type: 'GET_MATTER',
      matterId,
    });

    if (matter && !matter.error) {
      const name = matter.display_number || matter.description || `Matter ${matterId}`;
      await chrome.storage.local.set({ currentMatterName: name });
      updateMatterDisplay(name);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    const widget = buildWidget();
    document.body.appendChild(widget);

    document.getElementById('cpt-start-stop').addEventListener('click', onStartStop);
    document.getElementById('cpt-reset').addEventListener('click', onReset);
    document.getElementById('cpt-log').addEventListener('click', onLog);
    document.getElementById('cpt-minimize').addEventListener('click', onMinimise);

    makeDraggable(widget);
    restoreState();

    // Clio is a SPA — watch for route changes via hash
    window.addEventListener('hashchange', refreshMatterContext);
  }

  // Detect and store the regional Clio URL for the background service worker
  chrome.storage.local.set({ clioBaseUrl: window.location.origin });

  // Wait until Clio's app shell has rendered
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
