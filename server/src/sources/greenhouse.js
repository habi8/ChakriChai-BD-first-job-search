// Greenhouse job boards — official public JSON API, the "safe" source.
// https://boards-api.greenhouse.io/v1/boards/<token>/jobs?content=true
//
// Board tokens verified reachable Aug 2026. Edit this list freely; a board
// that 404s (company moved ATS) just contributes zero jobs, never an error
// for the whole source. If you find BD companies on Greenhouse (check their
// careers page URL for boards.greenhouse.io/<token>), add them here with
// bdOffice: true so ranking treats them as local-friendly.
import { fetchJson } from '../util/http.js';
import { makeJob, decodeEntities } from '../normalize.js';

const BOARDS = [
  { token: 'gitlab', company: 'GitLab', remote: true },
  { token: 'vercel', company: 'Vercel', remote: true },
  { token: 'canonical', company: 'Canonical', remote: true },
  { token: 'postman', company: 'Postman' },
  { token: 'remotecom', company: 'Remote.com', remote: true },
  { token: 'wise', company: 'Wise' },
  { token: 'invisibletech', company: 'Invisible Technologies', remote: true },
];

export const id = 'greenhouse';
export const name = 'Company boards (Greenhouse)';
export const enabled = () => true;

async function fetchBoard(board) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`;
  const data = await fetchJson(url, { timeoutMs: 9000 });
  return (data.jobs || []).map((j) =>
    makeJob({
      source: id,
      sourceId: `${board.token}-${j.id}`,
      title: j.title,
      company: board.company,
      location: j.location?.name || (board.remote ? 'Remote' : ''),
      postedDate: j.updated_at || j.first_published,
      descriptionHtml: decodeEntities(j.content || ''),
      applyUrl: j.absolute_url,
      remote: board.remote || /remote/i.test(j.location?.name || ''),
      tags: (j.departments || []).map((d) => d.name).filter(Boolean),
    })
  );
}

export async function search() {
  const settled = await Promise.allSettled(BOARDS.map(fetchBoard));
  const jobs = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  // Only fail the source if every single board failed.
  if (!jobs.length && settled.every((s) => s.status === 'rejected')) {
    throw new Error(settled[0].reason?.message || 'all Greenhouse boards failed');
  }
  return jobs.filter(Boolean);
}
