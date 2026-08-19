// Bdjobs.com — UNOFFICIAL, reverse-engineered internal API. Fragile by nature:
// Bdjobs can rename, block, or change these endpoints without notice, so this
// module is deliberately isolated, keyword-driven, aggressively timeboxed, and
// allowed to fail without affecting the rest of the search (the orchestrator
// reports it as a degraded source instead).
//
// Endpoints observed in the public bdjobs.com/h/ web app bundle (Aug 2026):
//   search:  GET https://api.bdjobs.com/Jobs/api/JobSearch/GetJobSearch?pg=&rpp=&isPro=0&keyword=
//   details: GET https://gateway.bdjobs.com/jobapply/api/JobSubsystem/Job-Details?jobId=
// These serve Bdjobs' own public job listings (same data as the website).
// Re-check Bdjobs' Terms of Service before using this beyond a personal
// prototype, keep rpp modest, and never hammer it — util/http.js enforces a
// ~1s minimum gap between requests to *.bdjobs.com.
import { fetchJson, evictFromMemo } from '../util/http.js';
import { makeJob, sanitizeHtml, htmlToText } from '../normalize.js';
import { BD_CATEGORY_ID, bdJobLevelFor } from '../bdcategories.js';

export const id = 'bdjobs';
export const name = 'Bdjobs.com';
export const enabled = () => true;

const SEARCH_URL = 'https://api.bdjobs.com/Jobs/api/JobSearch/GetJobSearch';
const DETAILS_URL = 'https://gateway.bdjobs.com/jobapply/api/JobSubsystem/Job-Details';
const MAX_CATEGORY_QUERIES = 3; // politeness cap; queries run ~1s apart per host

// Present ourselves as the web app the API was built for.
const HEADERS = { Origin: 'https://bdjobs.com', Referer: 'https://bdjobs.com/' };

function applyUrlFor(jobId) {
  // Server-rendered legacy detail page; redirects to the current details UI.
  return `https://jobs.bdjobs.com/jobdetails.asp?id=${jobId}&ln=1`;
}

async function runQuery({ keyword, categoryId, jobLevel, rpp }) {
  const params = new URLSearchParams({ pg: '1', rpp: String(rpp), isPro: '0' });
  if (keyword) params.set('keyword', keyword);
  if (categoryId) params.set('category', String(categoryId));
  if (jobLevel) params.set('jobLevel', jobLevel);
  const url = `${SEARCH_URL}?${params}`;
  const data = await fetchJson(url, { timeoutMs: 10000, headers: HEADERS });
  if (data?.statuscode !== '1' || !Array.isArray(data.data)) {
    throw new Error(`Bdjobs API shape changed (statuscode=${data?.statuscode})`);
  }
  // Bdjobs occasionally answers a valid-but-empty payload during hiccups;
  // don't let the 5-minute response memo pin that emptiness — evict so the
  // user's next search retries fresh.
  if (data.data.length === 0) evictFromMemo(url);
  return data.data;
}

export async function search({ keyword, filters }) {
  // Selected roles (Bdjobs designations) and fields (Bdjobs categories) both
  // map to precise category ids; roles first since they're more specific.
  const categories = [...(filters?.roles || []), ...(filters?.fields || [])]
    .map((label) => ({ label, id: BD_CATEGORY_ID[label] }))
    .filter((c) => c.id)
    .slice(0, MAX_CATEGORY_QUERIES);
  const jobLevel = bdJobLevelFor(filters?.levels);

  // Progressively broaden: precise query set first, then without the level
  // restriction, then plain keyword — so a too-narrow filter combination (or a
  // transient empty answer from Bdjobs) degrades to *some* local results
  // instead of zero.
  const attempts = [];
  attempts.push(
    categories.length
      ? categories.map((c) => ({ keyword, categoryId: c.id, jobLevel, rpp: 40, fieldLabel: c.label }))
      : [{ keyword, jobLevel, rpp: 50, fieldLabel: '' }]
  );
  if (jobLevel) {
    attempts.push(
      categories.length
        ? categories.map((c) => ({ keyword, categoryId: c.id, jobLevel: '', rpp: 40, fieldLabel: c.label }))
        : [{ keyword, jobLevel: '', rpp: 50, fieldLabel: '' }]
    );
  }
  if (categories.length || keyword) attempts.push([{ keyword, jobLevel: '', rpp: 50, fieldLabel: '' }]);

  // The final entry re-runs the precise query once more: Bdjobs occasionally
  // answers a transient empty batch, and empty responses are evicted from the
  // memo, so this retry is a genuinely fresh fetch.
  attempts.push(attempts[0]);

  let settled = [];
  let queries = [];
  for (const attempt of attempts) {
    queries = attempt;
    settled = await Promise.allSettled(queries.map((q) => runQuery(q)));
    if (settled.some((s) => s.status === 'fulfilled' && s.value.length)) break;
  }

  const jobs = [];
  const seen = new Set();
  settled.forEach((s, i) => {
    if (s.status !== 'fulfilled') return;
    for (const j of s.value) {
      if (seen.has(j.Jobid)) continue;
      seen.add(j.Jobid);
      const job = makeJob({
        source: id,
        sourceId: j.Jobid,
        title: j.jobTitle,
        company: j.companyName,
        location: j.location || 'Bangladesh',
        postedDate: j.publishDate,
        // Search response only carries an education/summary blurb; the real
        // description is fetched lazily via fullDescription() on card expand.
        descriptionHtml: j.jobDescription || j.eduRec || '',
        applyUrl: applyUrlFor(j.Jobid),
        jobType: j.JobType || '',
        salary: j.Salary && !['negotiable', '--', 'n/a'].includes(j.Salary.trim().toLowerCase()) ? j.Salary : '',
        tags: ['bangladesh'],
        needsFullDescription: true,
      });
      if (!job) continue;
      // Category-filtered results are field matches by definition — record it
      // so ranking doesn't demand a textual synonym match on top.
      job.field = queries[i].fieldLabel;
      jobs.push(job);
    }
  });
  if (!jobs.length && settled.every((s) => s.status === 'rejected')) {
    throw new Error(settled[0].reason?.message || 'all Bdjobs queries failed');
  }
  return jobs;
}

// Lazy full-description fetch for one job, called when the user expands a
// card. Returns the description HTML plus company-direct apply channels
// (company website / CV email / direct apply URL) so the UI can send the user
// to the employer instead of through Bdjobs.
export async function fullDescription(jobId) {
  if (!/^\d+$/.test(String(jobId))) throw new Error('invalid Bdjobs job id');
  const data = await fetchJson(`${DETAILS_URL}?jobId=${jobId}`, { timeoutMs: 10000, headers: HEADERS });
  const d = data?.data?.[0];
  if (!d || d.JobFound === 'False') throw new Error('job not found on Bdjobs');

  const section = (label, html) =>
    html && htmlToText(html) ? `<h3>${label}</h3>${html}` : '';
  const raw = [
    d.JobKeyPoints ? `<p><em>${htmlToText(d.JobKeyPoints)}</em></p>` : '',
    section('Responsibilities', d.JobDescription),
    section('Education & Requirements', d.EducationRequirements || d.AdditionJobRequirements),
    section('Experience', d.experience),
    section('Skills', d.SkillsRequired),
    section('Other benefits', d.JobOtherBenifits),
    d.JobSalaryRangeText ? `<p><strong>Salary:</strong> ${htmlToText(d.JobSalaryRangeText)}</p>` : '',
    d.JobLocation ? `<p><strong>Location:</strong> ${htmlToText(d.JobLocation)}</p>` : '',
    d.Deadline ? `<p><strong>Application deadline:</strong> ${htmlToText(String(d.Deadline))}</p>` : '',
    section('How to apply', d.ApplyInstruction),
    d.ApplyEmail ? `<p>${htmlToText(d.ApplyEmail)}</p>` : '',
    section('Hard copy', d.HardCopy),
    section('Walk-in interview', d.WalkInInterview),
  ].join('');
  const html = sanitizeHtml(raw);
  if (!htmlToText(html)) throw new Error('empty description from Bdjobs');

  const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());
  const emailMatch = htmlToText(`${d.ApplyEmail || ''} ${d.ApplyInstruction || ''}`).match(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/
  );
  return {
    html,
    company: String(d.CompanyNameENG || d.CompnayName || '').trim(),
    company_website: isHttp(d.CompanyWeb) ? String(d.CompanyWeb).trim() : '',
    apply_email: emailMatch ? emailMatch[0] : '',
    apply_url_direct: isHttp(d.ApplyURL) ? String(d.ApplyURL).trim() : '',
  };
}
