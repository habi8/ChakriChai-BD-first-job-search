// Polite outbound HTTP shared by every source adapter.
//
// Politeness rules (we are guests on these sites/APIs):
//  - per-host minimum interval between requests (serialized per host)
//  - short-lived in-memory memo of GET responses so repeated searches within a
//    few minutes don't re-hit the source at all. This is transient rate-limit
//    protection, not persistence — the server stays stateless across restarts.
//  - hard timeout on every request so one slow source can't stall a search.

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 ChakriChaiPrototype/0.1';

const MIN_INTERVAL_MS = {
  'api.bdjobs.com': 900,
  'gateway.bdjobs.com': 900,
  'jobs.bdjobs.com': 900,
  'remoteok.com': 600,
  default: 250,
};

const MEMO_TTL_MS = 5 * 60 * 1000;

const hostQueues = new Map(); // host -> promise chain enforcing the interval
const memo = new Map(); // url -> { at, promise }

function minIntervalFor(host) {
  return MIN_INTERVAL_MS[host] ?? MIN_INTERVAL_MS.default;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Serialize requests per host with a minimum gap between them.
function throttled(host, fn) {
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => sleep(minIntervalFor(host)))
    .then(fn);
  hostQueues.set(host, next.catch(() => {}));
  return next;
}

export async function politeFetch(url, { timeoutMs = 10000, headers = {}, method = 'GET' } = {}) {
  const host = new URL(url).host;
  return throttled(host, async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': UA, ...headers },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  });
}

// Memoized GET — one live fetch per URL per TTL window, shared across
// concurrent searches. Failed fetches are evicted so the next search retries.
export function politeFetchCached(url, opts = {}) {
  const now = Date.now();
  const hit = memo.get(url);
  if (hit && now - hit.at < MEMO_TTL_MS) return hit.promise;

  const promise = politeFetch(url, opts);
  memo.set(url, { at: now, promise });
  promise.catch(() => {
    if (memo.get(url)?.promise === promise) memo.delete(url);
  });

  // Opportunistic pruning to keep the memo bounded.
  if (memo.size > 300) {
    for (const [k, v] of memo) {
      if (now - v.at >= MEMO_TTL_MS) memo.delete(k);
    }
  }
  return promise;
}

// Drop a URL from the memo (e.g. a source answered successfully but with a
// suspicious empty payload — let the next search retry it fresh).
export function evictFromMemo(url) {
  memo.delete(url);
}

export async function fetchJson(url, opts = {}) {
  const text = await politeFetchCached(url, opts);
  return JSON.parse(text);
}

export function withTimeout(promise, ms, label = 'source') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}
