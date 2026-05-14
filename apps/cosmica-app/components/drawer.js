// Singleton lateral drawer — one instance shared across the whole app.

let _overlay = null;
let _panel   = null;
let _bodyEl  = null;
let _isOpen  = false;
let _offEsc  = null;
let _offHash = null;

function ensureDom() {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.className = 'drawer-overlay';

  _panel = document.createElement('aside');
  _panel.className = 'drawer-panel';
  _panel.setAttribute('role', 'dialog');
  _panel.setAttribute('aria-modal', 'true');
  _panel.setAttribute('aria-labelledby', 'drawer-title');
  _panel.innerHTML = `
    <div class="drawer-header">
      <div id="drawer-title"></div>
      <button class="drawer-close" id="drawer-close-btn" aria-label="Cerrar panel">✕</button>
    </div>
    <div class="drawer-body" id="drawer-body"></div>
  `;

  _bodyEl = _panel.querySelector('#drawer-body');

  document.body.appendChild(_overlay);
  document.body.appendChild(_panel);

  _overlay.addEventListener('click', () => closeDrawer());
  _panel.querySelector('#drawer-close-btn').addEventListener('click', () => closeDrawer());
}

function _setupListeners() {
  _offEsc = (e) => { if (e.key === 'Escape') closeDrawer(); };
  document.addEventListener('keydown', _offEsc);

  _offHash = () => closeDrawer();
  window.addEventListener('hashchange', _offHash, { once: true });

  _panel.addEventListener('keydown', _trapFocus);
}

function _teardownListeners() {
  if (_offEsc)  { document.removeEventListener('keydown', _offEsc);    _offEsc  = null; }
  if (_offHash) { window.removeEventListener('hashchange', _offHash);  _offHash = null; }
  if (_panel)   { _panel.removeEventListener('keydown', _trapFocus); }
}

function _trapFocus(e) {
  if (e.key !== 'Tab' || !_panel) return;
  const focusable = Array.from(_panel.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
  if (focusable.length < 2) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
  }
}

/**
 * Opens the drawer (or swaps content if already open).
 *
 * @param {string}   titleHtml   HTML injected into the header title slot.
 * @param {string}   contentHtml HTML injected into the scrollable body.
 * @param {Function} onMounted   Called synchronously after content is in the DOM.
 *                               Receives the body element as first argument.
 */
export function openDrawer(titleHtml, contentHtml, onMounted) {
  ensureDom();

  if (_isOpen) {
    // Swap content without re-animating — instant feel when browsing cards quickly
    _teardownListeners();
    _panel.querySelector('#drawer-title').innerHTML = titleHtml;
    _bodyEl.innerHTML = contentHtml;
    _setupListeners();
    if (onMounted) onMounted(_bodyEl);
    return;
  }

  _panel.querySelector('#drawer-title').innerHTML = titleHtml;
  _bodyEl.innerHTML = contentHtml;

  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    _overlay.classList.add('is-open');
    _panel.classList.add('is-open');
  });

  _isOpen = true;
  _setupListeners();
  if (onMounted) onMounted(_bodyEl);

  // Focus first interactive element after transition starts
  requestAnimationFrame(() => {
    const first = _panel.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled])'
    );
    if (first) first.focus();
  });
}

/**
 * Closes the drawer with slide-out animation.
 */
export function closeDrawer() {
  if (!_isOpen || !_panel) return;
  _isOpen = false;

  _overlay.classList.remove('is-open');
  _panel.classList.remove('is-open');
  document.body.style.overflow = '';
  _teardownListeners();

  // Clear content after the CSS transition finishes
  setTimeout(() => {
    if (!_isOpen && _bodyEl) {
      _bodyEl.innerHTML = '';
      if (_panel) _panel.querySelector('#drawer-title').innerHTML = '';
    }
  }, 300);
}
