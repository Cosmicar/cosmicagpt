/**
 * CHAOS GUARD — Cósmica App Resilience Engine
 * Handles multi-tab conflicts, double-submit prevention, unsaved-changes guard,
 * and auto-recovery drafts with staleness/checksum validation.
 */

const DRAFT_PREFIX = 'cosmica_draft_';
const LOCK_PREFIX  = 'ticket-edit-lock-';
const DRAFT_TTL    = 30 * 60 * 1000; // 30 minutes

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Fast djb2-variant checksum of a serialized object.
 * Used to detect corrupted or tampered draft data.
 * @param {Object} obj
 * @returns {number}
 */
function simpleChecksum(obj) {
  const str = JSON.stringify(obj);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ─── 1. Double Submit Guard ──────────────────────────────────────────────────

/**
 * Prevents double execution of an async button action.
 * Always restores button state in a `finally` block.
 *
 * @param {HTMLButtonElement} btn
 * @param {Function} asyncFn
 */
export async function guardBtn(btn, asyncFn) {
  if (btn.disabled) return;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> Procesando...`;

  try {
    await asyncFn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ─── 2. Unsaved Changes Guard ────────────────────────────────────────────────

let isDirty = false;
let _guardInitialized = false;

export function setDirty(dirty = true) {
  isDirty = dirty;
}

export function initUnsavedChangesGuard() {
  if (_guardInitialized) return;
  _guardInitialized = true;

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = 'Tienes cambios sin guardar. ¿Deseas salir?';
      return e.returnValue;
    }
  });

  // Hash change guard (internal navigation)
  window.addEventListener('hashchange', (e) => {
    if (isDirty && !confirm('Tienes cambios sin guardar. ¿Deseas abandonar este formulario?')) {
      const oldUrl = e.oldURL.split('#')[1] || '';
      window.location.hash = oldUrl;
    } else {
      isDirty = false;
    }
  });
}

// ─── 3. Auto Recovery (Drafts) ───────────────────────────────────────────────

/**
 * Saves a form draft to localStorage with TTL, checksum, and optional ticket
 * updatedAt snapshot to detect stale restores.
 *
 * @param {string}      key
 * @param {Object}      data              Form field values
 * @param {string|null} ticketUpdatedAt   Stringified ticket.updatedAt at save time
 */
export function saveDraft(key, data, ticketUpdatedAt = null) {
  const entry = {
    data,
    ts:             Date.now(),
    ticketUpdatedAt,
    checksum:       simpleChecksum(data),
  };
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // Storage quota exceeded — silently skip
    console.warn('[chaos-guard] saveDraft: localStorage write failed', e);
  }
}

/**
 * Loads a draft if it is fresh, checksum-valid, and the ticket has not been
 * modified since the draft was saved.
 *
 * @param {string}      key
 * @param {string|null} currentTicketUpdatedAt  Current ticket.updatedAt as string
 * @returns {Object|null}
 */
export function loadDraft(key, currentTicketUpdatedAt = null) {
  const raw = localStorage.getItem(DRAFT_PREFIX + key);
  if (!raw) return null;

  try {
    const entry = JSON.parse(raw);

    // 1. TTL check
    if (Date.now() - (entry.ts || 0) > DRAFT_TTL) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }

    // 2. Checksum validation — discard corrupted or tampered drafts
    if (entry.checksum !== undefined && entry.checksum !== simpleChecksum(entry.data)) {
      console.warn('[chaos-guard] Draft checksum mismatch — discarding:', key);
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }

    // 3. Staleness check — discard if ticket was modified after draft was saved
    if (currentTicketUpdatedAt && entry.ticketUpdatedAt &&
        currentTicketUpdatedAt !== entry.ticketUpdatedAt) {
      console.warn('[chaos-guard] Draft stale — ticket modified since draft was saved:', key);
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    localStorage.removeItem(DRAFT_PREFIX + key);
    return null;
  }
}

/**
 * Clears a specific draft and resets dirty state.
 */
export function clearDraft(key) {
  localStorage.removeItem(DRAFT_PREFIX + key);
  isDirty = false;
}

/**
 * Removes all expired drafts from localStorage.
 * Safe to call at app startup — only touches cosmica_draft_* keys.
 */
export function cleanupExpiredDrafts() {
  const keysToRemove = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(DRAFT_PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(k) || '{}');
        if (Date.now() - (entry.ts || 0) > DRAFT_TTL) keysToRemove.push(k);
      } catch { keysToRemove.push(k); }
    }
  } catch (e) {
    console.warn('[chaos-guard] cleanupExpiredDrafts: localStorage iteration failed', e);
  }
  keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

// ─── 4. Multitab Protection ──────────────────────────────────────────────────

const LOCK_TTL     = 45_000; // A lock is considered stale after 45 s without heartbeat
const HEARTBEAT_MS = 15_000; // Heartbeat interval

/**
 * Acquires a lightweight edit-lock in localStorage for a specific entity.
 * Warns via `onConflict` if another live tab already holds the lock.
 *
 * Guarantees:
 *   - Stale locks (tab crashed / was closed > 45 s ago) are ignored automatically.
 *   - Heartbeat every 15 s keeps the lock alive while the tab is open.
 *   - Cleanup function (returned) MUST be called from the view's destroy() to
 *     release the lock and clear the heartbeat interval.
 *
 * @param {string}   entityId    Ticket or entity ID used as part of the lock key
 * @param {Function} onConflict  Called with the existing lock object {tabId, userId, userEmail}
 * @returns {Function}  cleanup — call on view destroy to release the lock
 */
export function initMultitabCheck(entityId, onConflict) {
  const key   = LOCK_PREFIX + entityId;
  const tabId = Math.random().toString(36).slice(2, 11);

  const makeLockValue = () => {
    // Access session info safely — it lives on the window after app boot
    const session = (typeof getCurrentSessionSafe === 'function') ? getCurrentSessionSafe() : {};
    return JSON.stringify({
      tabId,
      userId:    session?.user?.uid    || 'unknown',
      userEmail: session?.user?.email  || '',
      timestamp: Date.now(),
    });
  };

  const isLockFresh = (parsed) =>
    parsed?.timestamp && (Date.now() - parsed.timestamp) < LOCK_TTL;

  // Check for an existing live lock from another tab
  try {
    const existingRaw = localStorage.getItem(key);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      if (existing.tabId !== tabId && isLockFresh(existing)) {
        onConflict(existing);
      }
    }
  } catch { /* ignore */ }

  // Claim the lock
  try { localStorage.setItem(key, makeLockValue()); } catch {}

  // Heartbeat: renew timestamp every 15 s so other tabs know we're still alive
  const heartbeatId = setInterval(() => {
    try {
      const current = localStorage.getItem(key);
      const parsed  = current ? JSON.parse(current) : null;
      if (!parsed || parsed.tabId === tabId) {
        localStorage.setItem(key, makeLockValue());
      }
    } catch {}
  }, HEARTBEAT_MS);

  // Listen for other tabs claiming the same lock
  const storageHandler = (e) => {
    if (e.key !== key || !e.newValue) return;
    try {
      const newLock = JSON.parse(e.newValue);
      if (newLock.tabId !== tabId && isLockFresh(newLock)) {
        onConflict(newLock);
      }
    } catch {}
  };
  window.addEventListener('storage', storageHandler);

  // Release lock when tab closes
  const releaseLock = () => {
    try {
      const current = localStorage.getItem(key);
      const parsed  = current ? JSON.parse(current) : null;
      if (!parsed || parsed.tabId === tabId) localStorage.removeItem(key);
    } catch { try { localStorage.removeItem(key); } catch {} }
  };
  window.addEventListener('beforeunload', releaseLock);

  // ── Cleanup: MUST be called by the view's destroy() ───────────────────────
  return function cleanup() {
    clearInterval(heartbeatId);
    window.removeEventListener('storage', storageHandler);
    window.removeEventListener('beforeunload', releaseLock);
    releaseLock();
  };
}

// ─── Internal session accessor (avoids circular imports) ─────────────────────
// ticket-form.js passes session data through the lock value indirectly;
// chaos-guard never directly imports session.js to keep the dep tree clean.
function getCurrentSessionSafe() {
  try {
    // session.js exports are available globally after boot via the module graph;
    // we call it via a dynamic import cache stored on window by session.js itself.
    return window.__cosmicaCurrentSession__ || null;
  } catch { return null; }
}
