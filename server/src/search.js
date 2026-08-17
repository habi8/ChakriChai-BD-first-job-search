// Search orchestrator: fan out to all enabled sources in parallel, tolerate
// individual failures, dedupe, rank BD-first, and report per-source status so
// the frontend can tell the user when a source (e.g. the Bdjobs scraper) is
// down without failing the whole search.
import { sources } from './sources/index.js';
import { rankJobs, primaryKeyword } from './rank.js';
import { withTimeout } from './util/http.js';

const SOURCE_TIMEOUT_MS = 15000;
const MAX_RESULTS = 120;

export async function runSearch(filters) {
  const query = { keyword: primaryKeyword(filters), filters };
  const active = sources.filter((s) => s.enabled());

  const settled = await Promise.allSettled(
    active.map(async (s) => {
      const started = Date.now();
      const jobs = await withTimeout(s.search(query), SOURCE_TIMEOUT_MS, s.name);
      return { jobs, tookMs: Date.now() - started };
    })
  );

  const allJobs = [];
  const statuses = [];
  active.forEach((s, i) => {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      allJobs.push(...r.value.jobs);
      statuses.push({ id: s.id, name: s.name, ok: true, count: r.value.jobs.length, tookMs: r.value.tookMs });
    } else {
      statuses.push({ id: s.id, name: s.name, ok: false, count: 0, error: r.reason?.message || 'unknown error' });
    }
  });

  const ranked = rankJobs(dedupe(allJobs), filters);
  return {
    jobs: ranked.slice(0, MAX_RESULTS),
    total: ranked.length,
    truncated: ranked.length > MAX_RESULTS,
    sources: statuses,
    searchedAt: new Date().toISOString(),
  };
}

function dedupe(jobs) {
  const seen = new Set();
  const out = [];
  for (const job of jobs) {
    const keys = [job.apply_url, `${job.title.toLowerCase()}|${job.company.toLowerCase()}`];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(job);
  }
  return out;
}
