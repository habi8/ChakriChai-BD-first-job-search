// All persistence is browser localStorage — the backend keeps nothing.
// Keys:
//   jobsearch:cache:<filterHash>  -> { results, fetchedAt }
//   jobsearch:lastFilters         -> last submitted filter object
//   jobsearch:bookmarks           -> array of saved job objects
//
// Trade-off (accepted for this prototype): localStorage is per-browser and
// per-device with a ~5MB quota — no cross-device sync. If that's ever needed,
// this module is the seam where a real backend DB would slot in.

const CACHE_PREFIX = 'jobsearch:cache:';
const LAST_FILTERS_KEY = 'jobsearch:lastFilters';
const BOOKMARKS_KEY = 'jobsearch:bookmarks';
export const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const MAX_CACHE_ENTRIES = 12;

// Stable stringify (sorted keys) + djb2 → short deterministic filter hash.
export function hashFilters(filters) {
  const stable = JSON.stringify(filters, Object.keys(filters).sort());
  let h = 5381;
  for (let i = 0; i < stable.length; i++) h = ((h << 5) + h + stable.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage disabled — caching is optional
  }
}

export function getCachedResults(filters) {
  const entry = read(CACHE_PREFIX + hashFilters(filters));
  if (!entry || !entry.fetchedAt) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    localStorage.removeItem(CACHE_PREFIX + hashFilters(filters));
    return null;
  }
  return entry;
}

export function setCachedResults(filters, results) {
  pruneCache();
  if (!write(CACHE_PREFIX + hashFilters(filters), { results, fetchedAt: Date.now() })) {
    // Quota blown: drop all cached searches and retry once.
    listCacheKeys().forEach((k) => localStorage.removeItem(k));
    write(CACHE_PREFIX + hashFilters(filters), { results, fetchedAt: Date.now() });
  }
}

function listCacheKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  return keys;
}

function pruneCache() {
  const keys = listCacheKeys();
  if (keys.length < MAX_CACHE_ENTRIES) return;
  const dated = keys
    .map((k) => ({ k, at: read(k)?.fetchedAt || 0 }))
    .sort((a, b) => a.at - b.at);
  dated.slice(0, keys.length - MAX_CACHE_ENTRIES + 1).forEach(({ k }) => localStorage.removeItem(k));
}

export const getLastFilters = () => read(LAST_FILTERS_KEY);
export const setLastFilters = (filters) => write(LAST_FILTERS_KEY, filters);

export const getBookmarks = () => read(BOOKMARKS_KEY) || [];

// Applied-jobs tracker: { [jobId]: appliedAtTimestamp }
const APPLIED_KEY = 'jobsearch:applied';

export const getApplied = () => read(APPLIED_KEY) || {};

export function toggleApplied(jobId) {
  const map = getApplied();
  if (map[jobId]) delete map[jobId];
  else map[jobId] = Date.now();
  write(APPLIED_KEY, map);
  return { ...map };
}

// View preference (not a search filter — it never affects the cache key).
const SHOW_APPLIED_KEY = 'jobsearch:showApplied';

export const getShowApplied = () => read(SHOW_APPLIED_KEY) !== false;
export const setShowApplied = (value) => write(SHOW_APPLIED_KEY, Boolean(value));

export function toggleBookmark(job) {
  const list = getBookmarks();
  const idx = list.findIndex((j) => j.id === job.id);
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift(job);
  write(BOOKMARKS_KEY, list);
  return list;
}
