// Adzuna — global fallback, official API but needs free keys. Disabled unless
// ADZUNA_APP_ID/ADZUNA_APP_KEY are set. Adzuna has no Bangladesh market, so
// this only supplements thin results with global listings (ranked last).
import { fetchJson } from '../util/http.js';
import { makeJob } from '../normalize.js';

export const id = 'adzuna';
export const name = 'Adzuna (global fallback)';
export const enabled = () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

export async function search({ keyword }) {
  const country = (process.env.ADZUNA_COUNTRY || 'gb').toLowerCase();
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID,
    app_key: process.env.ADZUNA_APP_KEY,
    results_per_page: '30',
    'content-type': 'application/json',
  });
  if (keyword) params.set('what', keyword);
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
  const data = await fetchJson(url, { timeoutMs: 10000 });
  return (data.results || [])
    .map((j) =>
      makeJob({
        source: id,
        sourceId: j.id,
        title: j.title?.replace(/<[^>]+>/g, ''),
        company: j.company?.display_name,
        location: j.location?.display_name,
        postedDate: j.created,
        descriptionHtml: j.description ? `<p>${j.description}</p>` : '',
        applyUrl: j.redirect_url,
        jobType: j.contract_time || '',
        salary:
          j.salary_min && j.salary_max
            ? `${Math.round(j.salary_min).toLocaleString()} – ${Math.round(j.salary_max).toLocaleString()}`
            : '',
      })
    )
    .filter(Boolean);
}
