/**
 * CHAOS GUARD — Cosmica SaaS Resilience Engine
 * Handles multi-tab, double-submit, unsaved changes, and auto-recovery.
 */

const DRAFT_PREFIX = 'cosmica_draft_';
const TTL = 30 * 60 * 1000; // 30 minutes

// ─── 1. Double Submit Guard ──────────────────────────────────────────────────

/**
 * Prevents double execution of a button action.
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

export function setDirty(dirty = true) {
  isDirty = dirty;
}

export function initUnsavedChangesGuard() {
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
      // Revert hash if canceled
      const oldUrl = e.oldURL.split('#')[1] || '';
      window.location.hash = oldUrl;
    } else {
      isDirty = false;
    }
  });
}

// ─── 3. Auto Recovery (Drafts) ───────────────────────────────────────────────

/**
 * Saves a form draft to localStorage.
 * @param {string} key 
 * @param {Object} data 
 */
export function saveDraft(key, data) {
  const entry = {
    data,
    ts: Date.now()
  };
  localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(entry));
}

/**
 * Loads a form draft if not expired.
 * @param {string} key 
 * @returns {Object|null}
 */
export function loadDraft(key) {
  const raw = localStorage.getItem(DRAFT_PREFIX + key);
  if (!raw) return null;
  
  try {
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Clears a specific draft.
 */
export function clearDraft(key) {
  localStorage.removeItem(DRAFT_PREFIX + key);
  isDirty = false;
}

// ─── 4. Multitab Protection ──────────────────────────────────────────────────

/**
 * Checks if a specific entity (like a ticket) is being edited in another tab.
 */
export function initMultitabCheck(entityId, onConflict) {
  const key = `cosmica_editing_${entityId}`;
  const tabId = Math.random().toString(36).substr(2, 9);
  
  localStorage.setItem(key, tabId);
  
  window.addEventListener('storage', (e) => {
    if (e.key === key && e.newValue !== tabId) {
      onConflict();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (localStorage.getItem(key) === tabId) {
      localStorage.removeItem(key);
    }
  });
}
