// Simple in-memory TTL cache. No external dependencies.
// Provides deduplication of in-flight fetches to prevent parallel duplicate requests.

const _store    = new Map(); // key → { data, expiresAt }
const _inflight = new Map(); // key → Promise — prevents parallel identical fetches

const DEFAULT_TTL = 60_000; // 1 minute

export function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet(key, data, ttl = DEFAULT_TTL) {
  _store.set(key, { data, expiresAt: Date.now() + ttl });
  return data;
}

export function cacheInvalidate(...keys) {
  keys.forEach(k => { _store.delete(k); _inflight.delete(k); });
}

export function cacheClear() {
  _store.clear();
  _inflight.clear();
}

/**
 * Wraps an async factory with cache + in-flight deduplication.
 * If two callers request the same key simultaneously, only one Firestore
 * fetch is made and both receive the same result.
 *
 * @param {string}   key     Cache key
 * @param {Function} factory Async function that fetches fresh data
 * @param {number}   [ttl]   TTL in ms (default 60 s)
 */
export async function cacheWrap(key, factory, ttl = DEFAULT_TTL) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;

  if (_inflight.has(key)) return _inflight.get(key);

  const promise = factory().then(data => {
    cacheSet(key, data, ttl);
    _inflight.delete(key);
    return data;
  }).catch(err => {
    _inflight.delete(key);
    throw err;
  });

  _inflight.set(key, promise);
  return promise;
}
