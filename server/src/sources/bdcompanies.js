// Direct career-page scraping for top Bangladeshi tech companies.
//
// Why this exists: the API sources (Bdjobs, Greenhouse, Lever, RemoteOK,
// Arbeitnow) only know about jobs that were posted to *them*. Plenty of BD
// companies publish openings solely on their own careers page, so this module
// goes and reads those pages directly on every search.
//
// Three parser strategies, in order of reliability:
//   1. `easyjobs`  — easy.jobs is a Bangladeshi ATS with clean, stable,
//                    server-rendered markup. One parser covers every company
//                    hosted there.
//   2. `hrythmic`  — another BD-built ATS, same idea.
//   3. `generic`   — heuristic scrape of a custom careers page: collect links
//                    whose text reads like a job title and reject nav/marketing.
//
// Reality check (verified Aug 2026): coverage varies a lot. Some companies
// render their openings with JavaScript (nothing to scrape without a headless
// browser), and some genuinely have no openings. Both look like "0 jobs" here,
// which is fine — this source is additive and never fails the whole search.
import * as cheerio from 'cheerio';
import { politeFetchCached } from '../util/http.js';
import { makeJob } from '../normalize.js';

export const id = 'bdcompanies';
export const name = 'BD company career pages';
export const enabled = () => true;

const PER_COMPANY_TIMEOUT_MS = 9000;

// Registry — add companies freely; a broken entry contributes zero jobs and is
// reported in the per-source status, never an error for the search.
const COMPANIES = [
  { company: 'Brain Station 23', platform: 'easyjobs', url: 'https://brainstation-23.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Dynamic Solution Innovators', platform: 'hrythmic', url: 'https://app.hrythmic.com/recruit/openings/company/dsinnovators/', location: 'Dhaka, Bangladesh' },
  { company: 'Vivasoft', platform: 'easyjobs', url: 'https://vivasoft.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Chaldal', platform: 'easyjobs', url: 'https://chaldal.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Pathao', platform: 'easyjobs', url: 'https://pathao.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'DataSoft Systems', platform: 'easyjobs', url: 'https://datasoft.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Startise (WPDeveloper)', platform: 'easyjobs', url: 'https://wpdeveloper.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Misfit Technologies', platform: 'easyjobs', url: 'https://misfit.easy.jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Kaz Software', platform: 'generic', url: 'https://www.kaz.com.bd/company/career', location: 'Dhaka, Bangladesh' },
  { company: 'Cefalo Bangladesh', platform: 'generic', url: 'https://career.cefalo.com/', location: 'Dhaka, Bangladesh' },
  { company: 'SELISE', platform: 'generic', url: 'https://selisegroup.com/careers/', location: 'Dhaka, Bangladesh' },
  { company: 'Streams Tech', platform: 'generic', url: 'https://www.streamstech.com/careers', location: 'Dhaka, Bangladesh' },
  { company: 'REVE Systems', platform: 'generic', url: 'https://www.revesoft.com/career', location: 'Dhaka, Bangladesh' },
  { company: 'SSL Wireless', platform: 'generic', url: 'https://sslwireless.com/career/', location: 'Dhaka, Bangladesh' },
  { company: 'BJIT Group', platform: 'generic', url: 'https://bjitgroup.com/career', location: 'Dhaka, Bangladesh' },
  { company: 'LEADS Corporation', platform: 'generic', url: 'https://leads.com.bd/recruitment-steps/', location: 'Dhaka, Bangladesh' },
  { company: 'Augmedix Bangladesh', platform: 'generic', url: 'https://www.augmedix.com/careers', location: 'Dhaka, Bangladesh' },
  { company: 'Therap BD', platform: 'generic', url: 'https://therapbd.com/careers/', location: 'Dhaka, Bangladesh' },
  { company: 'Nagad', platform: 'generic', url: 'https://nagad.com.bd/career', location: 'Dhaka, Bangladesh' },
  { company: 'bKash', platform: 'generic', url: 'https://www.bkash.com/career', location: 'Dhaka, Bangladesh' },
];
// Dropped after probing (Aug 2026): Enosis Solutions (careers URL answers a
// 307 redirect loop) and Divine IT (careers URL 404s). Re-add if they change.

// A link's text must look like a job title…
const JOB_TITLE_RX =
  /\b(engineer|developer|programmer|officer|manager|executive|analyst|designer|intern|trainee|architect|specialist|consultant|administrator|scientist|lead|head of|qa|sqa|devops|tester|writer|accountant|associate|coordinator|technician|marketer|strategist)\b/i;

// …and must not be navigation or marketing copy that happens to contain a
// job-ish word ("Hire Developers", "Why Choose Us", "Meet our Engineers").
const NOT_A_JOB_RX =
  /\b(why|hire|meet|our team|about|learn more|read more|contact|home|blog|news|apply now|see all|view all|privacy|terms|login|sign|share your|open application|life at|benefits|perks|culture|services|solutions?|products?|clients?|portfolio|case stud)\b/i;

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function absUrl(href, base) {
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

// easy.jobs board: <h4 class="job-header__title"><a href=…>Title</a></h4>
// plus location/remote metadata in sibling .job-header__component elements.
function parseEasyJobs($, entry) {
  const out = [];
  $('.job-header').each((_, el) => {
    const a = $(el).find('.job-header__title a').first();
    const title = cleanText(a.text());
    const url = absUrl(a.attr('href'), entry.url);
    if (!title || !url) return;
    const meta = $(el)
      .find('.job-header__component__text')
      .map((_, m) => cleanText($(m).text()))
      .get();
    // First meta cell is the company name, later ones carry the location.
    const location = meta.slice(1).find((m) => /bangladesh|dhaka|remote|,/i.test(m)) || entry.location;
    const labels = $(el)
      .find('.skill-label')
      .map((_, m) => cleanText($(m).text()))
      .get()
      .join(' ');
    out.push({ title, url, location, remote: /remote/i.test(`${labels} ${location}`) });
  });
  return out;
}

// hrythmic openings list: job title links followed by an "Apply now" link.
function parseHrythmic($, entry) {
  const out = [];
  $('a[href]').each((_, a) => {
    const title = cleanText($(a).text());
    if (!title || title.length < 6 || title.length > 90) return;
    if (!JOB_TITLE_RX.test(title) || NOT_A_JOB_RX.test(title)) return;
    const url = absUrl($(a).attr('href'), entry.url);
    if (!url) return;
    out.push({ title, url, location: entry.location, remote: false });
  });
  return out;
}

// A job link's href should look like a posting, not a product/marketing page.
// (Without this, e.g. SELISE's "Blocks Language Manager" product page at /uilm
// scrapes as if it were a job opening.)
const JOB_HREF_RX = /job|career|vacanc|position|opening|recruit|apply|hiring/i;

// Custom careers page: keep links that read like job titles *and* point at a
// plausible posting URL.
function parseGeneric($, entry) {
  const out = [];
  $('a[href]').each((_, a) => {
    const title = cleanText($(a).text());
    if (!title || title.length < 6 || title.length > 90) return;
    if (!JOB_TITLE_RX.test(title) || NOT_A_JOB_RX.test(title)) return;
    // Require a word count typical of a job title, not a sentence.
    if (title.split(' ').length > 9) return;
    const href = $(a).attr('href') || '';
    const url = absUrl(href, entry.url);
    if (!url || /^mailto:|^tel:/.test(url)) return;
    if (!JOB_HREF_RX.test(url)) return;
    // Skip the careers index itself linking back to itself.
    if (url.replace(/\/$/, '') === entry.url.replace(/\/$/, '')) return;
    out.push({ title, url, location: entry.location, remote: /remote/i.test(title) });
  });
  return out;
}

const PARSERS = { easyjobs: parseEasyJobs, hrythmic: parseHrythmic, generic: parseGeneric };

async function scrapeCompany(entry) {
  const html = await politeFetchCached(entry.url, { timeoutMs: PER_COMPANY_TIMEOUT_MS });
  const $ = cheerio.load(html);
  const parsed = (PARSERS[entry.platform] || parseGeneric)($, entry);

  const seen = new Set();
  const jobs = [];
  for (const p of parsed) {
    const key = p.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const job = makeJob({
      source: id,
      sourceId: `${entry.company}-${key}`.replace(/\s+/g, '-').slice(0, 120),
      title: p.title,
      company: entry.company,
      location: p.location || entry.location,
      // Career pages rarely publish a machine-readable posted date; leaving it
      // null is honest — ranking just skips the freshness bonus.
      postedDate: null,
      descriptionHtml: `<p>Open position at ${entry.company}. Full details are on the company's careers page.</p>`,
      applyUrl: p.url,
      remote: p.remote,
      tags: ['bangladesh', 'company career page'],
    });
    if (job) jobs.push(job);
  }
  return jobs;
}

export async function search() {
  const settled = await Promise.allSettled(COMPANIES.map(scrapeCompany));
  const jobs = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  // Only a total wipeout counts as a source failure.
  if (!jobs.length && settled.every((s) => s.status === 'rejected')) {
    throw new Error(settled[0].reason?.message || 'all BD company career pages failed');
  }
  return jobs;
}
