// Arbeitnow job board — free public JSON API, no key.
// Mostly Europe/Germany listings but flags `remote` and carries visa
// sponsorship tags; ranking demotes region-locked entries for BD users.
import { fetchJson } from '../util/http.js';
import { makeJob } from '../normalize.js';

export const id = 'arbeitnow';
export const name = 'Arbeitnow';
export const enabled = () => true;

export async function search() {
  const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api', { timeoutMs: 10000 });
  return (data.data || [])
    .map((j) =>
      makeJob({
        source: id,
        sourceId: j.slug,
        title: j.title,
        company: j.company_name,
        location: j.remote ? `Remote (${j.location || 'unspecified'})` : j.location,
        postedDate: j.created_at,
        descriptionHtml: j.description || '',
        applyUrl: j.url,
        jobType: (j.job_types || []).join(' '),
        tags: j.tags || [],
        remote: Boolean(j.remote),
      })
    )
    .filter(Boolean);
}
