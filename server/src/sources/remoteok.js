// RemoteOK — free public JSON API, no key. All listings are remote; the
// `location` field ("Worldwide", "Asia", "US timezones"...) tells us whether a
// BD-based applicant is realistically eligible — ranking uses that.
// API ToS asks integrators to link back to the RemoteOK job URL and credit
// "Remote OK" as the source — apply_url + the source badge do exactly that.
import { fetchJson } from '../util/http.js';
import { makeJob } from '../normalize.js';

export const id = 'remoteok';
export const name = 'RemoteOK';
export const enabled = () => true;

export async function search() {
  const data = await fetchJson('https://remoteok.com/api', { timeoutMs: 12000 });
  if (!Array.isArray(data)) throw new Error('unexpected RemoteOK payload');
  return data
    .slice(1) // first element is the legal notice, not a job
    .map((j) =>
      makeJob({
        source: id,
        sourceId: j.id || j.slug,
        title: j.position,
        company: j.company,
        location: j.location ? `Remote (${j.location})` : 'Remote',
        postedDate: j.date || j.epoch,
        descriptionHtml: j.description || '',
        applyUrl: j.url,
        salary:
          j.salary_min && j.salary_max
            ? `$${Number(j.salary_min).toLocaleString()} – $${Number(j.salary_max).toLocaleString()}/yr`
            : '',
        tags: j.tags || [],
        remote: true,
      })
    )
    .filter(Boolean);
}
