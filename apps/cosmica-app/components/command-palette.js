// Singleton Command Palette — Ctrl+K / Cmd+K global search.

import { openTicketQuickView } from './ticket-quick-view.js';
import { canAccess } from '../core/session.js';
import { getTickets } from '../services/tickets.js';
import { getClientes } from '../services/clientes.js';

// ── Module-level state ───────────────────────────────────────────────────────

const _cache = { tickets: null, clients: null };

let _overlay    = null;
let _modal      = null;
let _input      = null;
let _resultsEl  = null;
let _isOpen     = false;
let _results    = [];   // flat ordered array — index matches rendered .cp-item[data-idx]
let _activeIdx  = 0;
let _debTimer   = null;
let _offEsc     = null;
let _scrollPos  = 0;
let _prevActiveElement = null;

function _lockBody() {
  const n = parseInt(document.body.dataset.scrollLocks || '0', 10) + 1;
  document.body.dataset.scrollLocks = n;
  if (n > 1) return; // Ya bloqueado por otro overlay — no sobreescribir scrollPos
  _scrollPos = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${_scrollPos}px`;
  document.body.style.width = '100%';
  document.body.style.overflowY = 'scroll';
}

function _unlockBody() {
  const n = Math.max(0, parseInt(document.body.dataset.scrollLocks || '1', 10) - 1);
  document.body.dataset.scrollLocks = n;
  if (n > 0) return; // Todavía retenido por otro overlay
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflowY = '';
  window.scrollTo(0, _scrollPos);
}

// ── Data ─────────────────────────────────────────────────────────────────────

/**
 * Called by views after their data loads to pre-populate the cache,
 * so the palette never needs its own fetch during normal usage.
 */
export function seedPaletteCache({ tickets, clients } = {}) {
  if (tickets !== undefined) _cache.tickets = tickets;
  if (clients !== undefined) _cache.clients = clients;
}

async function ensureCache() {
  const needT = _cache.tickets === null;
  const needC = _cache.clients === null;
  if (!needT && !needC) return;
  try {
    const [t, c] = await Promise.all([
      needT ? getTickets()  : Promise.resolve(_cache.tickets),
      needC ? getClientes() : Promise.resolve(_cache.clients),
    ]);
    _cache.tickets = t;
    _cache.clients = c;
  } catch (err) {
    console.error('[CommandPalette] lazy fetch failed:', err);
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

function getActions() {
  const all = [
    { icon: '📊', label: 'Dashboard',     sub: 'Panel principal',        action: () => _nav('dashboard')      },
    { icon: '🛠️', label: 'Trabajos',      sub: 'Listado de tickets',     action: () => _nav('tickets')        },
    { icon: '👥', label: 'Clientes',      sub: 'Listado de clientes',    action: () => _nav('clientes')       },
    { icon: '➕', label: 'Nuevo Ticket',  sub: 'Crear orden de trabajo', action: () => _nav('ticket-nuevo'),  guard: () => canAccess('create-ticket') || canAccess('edit-ticket') },
    { icon: '👤', label: 'Nuevo Cliente', sub: 'Registrar nuevo cliente',action: () => _nav('cliente-nuevo'), guard: () => canAccess('create-client') },
  ];
  return all.filter(a => !a.guard || a.guard());
}

function _nav(route) {
  closePalette();
  window.location.hash = route;
}

// ── Search ────────────────────────────────────────────────────────────────────

function search(rawQuery) {
  const q = rawQuery.toLowerCase().trim();

  if (!q) {
    // Empty query: show all available actions as quick-launch
    return getActions().map(a => ({ type: 'action', ...a }));
  }

  const tickets = (_cache.tickets || []).filter(t =>
    (t.numeroOrden && String(t.numeroOrden).toLowerCase().includes(q)) ||
    ([t.nombre, t.apellido].join(' ').toLowerCase().includes(q)) ||
    (t.equipo && t.equipo.toLowerCase().includes(q)) ||
    (t.problema && t.problema.toLowerCase().includes(q))
  ).slice(0, 6);

  const clients = (_cache.clients || []).filter(c =>
    ([c.nombre, c.apellido].join(' ').toLowerCase().includes(q)) ||
    (c.dni && c.dni.toLowerCase().includes(q)) ||
    (c.telefono && String(c.telefono).toLowerCase().includes(q))
  ).slice(0, 5);

  const actions = getActions().filter(a =>
    a.label.toLowerCase().includes(q) || a.sub.toLowerCase().includes(q)
  );

  return [
    ...tickets.map(t => ({
      type:   'ticket',
      icon:   '🛠️',
      label:  `#${t.numeroOrden || '—'} — ${[t.nombre, t.apellido].filter(Boolean).join(' ') || 'Sin nombre'}`,
      sub:    [t.equipo, t.estado].filter(Boolean).join(' · ') || '',
      action: () => { closePalette(); openTicketQuickView(t); },
    })),
    ...clients.map(c => ({
      type:   'client',
      icon:   '👤',
      label:  [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre',
      sub:    `DNI: ${c.dni || '—'} · Tel: ${c.telefono || '—'}`,
      action: () => { closePalette(); window.location.hash = `cliente-edit?id=${c.id}`; },
    })),
    ...actions.map(a => ({ type: 'action', ...a })),
  ];
}

// ── Render ────────────────────────────────────────────────────────────────────

const GROUP_ORDER = ['ticket', 'client', 'action'];
const GROUP_LABEL = { ticket: 'Tickets', client: 'Clientes', action: 'Acciones' };

function renderResults(results) {
  if (!results.length) {
    return `<div class="cp-empty">Sin resultados para esta búsqueda</div>`;
  }

  let html = '';
  let idx = 0;

  GROUP_ORDER.forEach(type => {
    const items = results.filter(r => r.type === type);
    if (!items.length) return;

    html += `<div class="cp-group"><div class="cp-group-label">${GROUP_LABEL[type]}</div>`;
    items.forEach(item => {
      html += `
        <div class="cp-item ${idx === _activeIdx ? 'is-active' : ''}" data-idx="${idx}" role="option">
          <div class="cp-item-icon">${item.icon}</div>
          <div class="cp-item-text">
            <div class="cp-item-label">${item.label}</div>
            ${item.sub ? `<div class="cp-item-sub">${item.sub}</div>` : ''}
          </div>
        </div>`;
      idx++;
    });
    html += `</div>`;
  });

  return html;
}

function _updateResults(results) {
  _results = results;
  if (_resultsEl) _resultsEl.innerHTML = renderResults(results);
  _scrollActive();
}

function _scrollActive() {
  if (!_resultsEl) return;
  const el = _resultsEl.querySelector('.cp-item.is-active');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function _setActive(idx) {
  if (!_results.length) return;
  _activeIdx = Math.max(0, Math.min(_results.length - 1, idx));
  _resultsEl.querySelectorAll('.cp-item').forEach((el, i) => {
    el.classList.toggle('is-active', i === _activeIdx);
  });
  _scrollActive();
}

// ── DOM ───────────────────────────────────────────────────────────────────────

function ensureDom() {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.className = 'cp-overlay';
  _overlay.setAttribute('aria-hidden', 'true');

  _modal = document.createElement('div');
  _modal.className = 'cp-modal';
  _modal.setAttribute('role', 'dialog');
  _modal.setAttribute('aria-modal', 'true');
  _modal.setAttribute('aria-label', 'Búsqueda global');
  _modal.innerHTML = `
    <div class="cp-search-row">
      <span class="cp-search-icon">🔍</span>
      <input
        id="cp-input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="Buscar tickets, clientes o acciones…"
        aria-autocomplete="list"
        aria-controls="cp-results"
      />
      <kbd class="cp-esc-hint">ESC</kbd>
    </div>
    <div class="cp-results" id="cp-results" role="listbox"></div>
    <div class="cp-footer">
      <span>↑↓ navegar</span>
      <span>Enter seleccionar</span>
      <span>ESC cerrar</span>
    </div>
  `;

  _input    = _modal.querySelector('#cp-input');
  _resultsEl = _modal.querySelector('#cp-results');

  _overlay.appendChild(_modal);
  document.body.appendChild(_overlay);

  // Click outside modal closes
  _overlay.addEventListener('click', (e) => {
    if (!_modal.contains(e.target)) closePalette();
  });

  // Click on result item
  _resultsEl.addEventListener('click', (e) => {
    const item = e.target.closest('.cp-item');
    if (!item) return;
    const result = _results[Number(item.dataset.idx)];
    if (result) result.action();
  });

  // Hover sets active (mouse navigation)
  _resultsEl.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.cp-item');
    if (item) _setActive(Number(item.dataset.idx));
  });
}

// ── Event handlers (named so they can be removed cleanly) ────────────────────

function _onInput() {
  clearTimeout(_debTimer);
  _debTimer = setTimeout(() => {
    _activeIdx = 0;
    _updateResults(search(_input.value));
  }, 120);
}

function _onModalKey(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      _setActive(_activeIdx + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      _setActive(_activeIdx - 1);
      break;
    case 'Enter':
      e.preventDefault();
      if (_results[_activeIdx]) _results[_activeIdx].action();
      break;
    case 'Tab':
      // Trap focus inside modal
      e.preventDefault();
      break;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function openPalette() {
  ensureDom();
  if (_isOpen) return;

  _isOpen    = true;
  _activeIdx = 0;
  _prevActiveElement = document.activeElement;

  _lockBody();
  _overlay.removeAttribute('aria-hidden');
  _overlay.classList.add('is-open');

  // Render immediately with actions while data possibly loads
  _updateResults(search(''));

  // Lazy fetch if cache empty — re-render when done
  if (_cache.tickets === null || _cache.clients === null) {
    ensureCache().then(() => {
      if (_isOpen) _updateResults(search(_input?.value || ''));
    });
  }

  _input.value = '';
  requestAnimationFrame(() => _input?.focus());

  _offEsc = (e) => { if (e.key === 'Escape') closePalette(); };
  document.addEventListener('keydown', _offEsc);
  _modal.addEventListener('keydown', _onModalKey);
  _input.addEventListener('input', _onInput);
}

export function closePalette() {
  if (!_isOpen || !_overlay) return;
  _isOpen = false;

  _overlay.classList.remove('is-open');
  _overlay.setAttribute('aria-hidden', 'true');
  _unlockBody();
  
  if (_prevActiveElement && typeof _prevActiveElement.focus === 'function') {
    _prevActiveElement.focus();
    _prevActiveElement = null;
  }

  if (_offEsc) { document.removeEventListener('keydown', _offEsc); _offEsc = null; }
  if (_modal)  { _modal.removeEventListener('keydown', _onModalKey); }
  if (_input)  { _input.removeEventListener('input', _onInput); }
  if (_debTimer) { clearTimeout(_debTimer); _debTimer = null; }

  setTimeout(() => {
    if (!_isOpen && _resultsEl) _resultsEl.innerHTML = '';
  }, 200);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Call once after session is confirmed (in app.js).
 * Registers Ctrl+K / Cmd+K and the optional navbar trigger button.
 */
export function initCommandPalette() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (_isOpen) closePalette();
      else openPalette();
    }
  });

  const triggerBtn = document.getElementById('cp-trigger-btn');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (_isOpen) closePalette();
      else openPalette();
    });
  }
}
