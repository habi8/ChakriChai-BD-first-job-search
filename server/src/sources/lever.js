// Lever-hosted job boards — official public JSON API.
// https://api.lever.co/v0/postings/<site>?mode=json
// Same drill as Greenhouse: verified tokens, individually failure-tolerant,
// add BD companies here if you find any hosted on Lever.
import { fetchJson } from '../util/http.js';
import { makeJob } from '../normalize.js';

const SITES = [
  { token: 'kraken', company: 'Kraken', remote: true },
  { token: 'spotify', company: 'Spotify' },
];

export const id = 'lever';
export const name = 'Company boards (Lever)';
export const enabled = () => true;

async function fetchSite(site) {
  const url = `https://api.lever.co/v0/postings/${site.token}?mode=json`;
  const postings = await fetchJson(url, { timeoutMs: 9000 });
  return (postings || []).map((p) =>
    makeJob({
      source: id,
      sourceId: `${site.token}-${p.id}`,
      title: p.text,
      company: site.company,
      location: p.categories?.location || (site.remote ? 'Remote' : ''),
      postedDate: p.createdAt,
      descriptionHtml: p.description || p.descriptionPlain || '',
      applyUrl: p.hostedUrl || p.applyUrl,
      jobType: p.categories?.commitment || '',
      remote: p.workplaceType === 'remote' || site.remote,
      tags: [p.categories?.team, p.categories?.department].filter(Boolean),
    })
  );
}

export async function search() {
  const settled = await Promise.allSettled(SITES.map(fetchSite));
  const jobs = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  if (!jobs.length && settled.every((s) => s.status === 'rejected')) {
    throw new Error(settled[0].reason?.message || 'all Lever sites failed');
  }
  return jobs.filter(Boolean);
}
