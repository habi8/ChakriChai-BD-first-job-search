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
  { company: 'Therap Services', platform: 'generic', url: 'https://www.therapservices.net/jobs/', location: 'Dhaka, Bangladesh' },
  { company: 'Nagad', platform: 'generic', url: 'https://nagad.com.bd/career', location: 'Dhaka, Bangladesh' },
  { company: 'bKash', platform: 'generic', url: 'https://www.bkash.com/career', location: 'Dhaka, Bangladesh' },
];
// Dropped after probing (Aug 2026): Enosis Solutions (careers URL answers a
// 307 redirect loop) and Divine IT (careers URL 404s). Re-add if they change.

// Company names for the "Top jobs" view, so the UI can say whose pages it read.
export const COMPANY_NAMES = COMPANIES.map((c) => c.company);

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

// "Ashif Iqbal, Lead Software Engineer" — an employee testimonial byline, not
// an opening. Reject Name-comma-Title shapes.
const TESTIMONIAL_RX = /^[A-Z][a-z]+ [A-Z][a-z.]+( [A-Z][a-z.]+)?,\s/;

function isJobTitle(t) {
  if (!t || t.length < 6 || t.length > 90) return false;
  if (!JOB_TITLE_RX.test(t) || NOT_A_JOB_RX.test(t)) return false;
  if (TESTIMONIAL_RX.test(t)) return false;
  if (t.endsWith('.')) return false; // a sentence, not a title
  return t.split(' ').length <= 9;
}

// The text-only fallback has no URL to corroborate it, so it demands a real
// job-title shape: at least two words ending in a role noun. Without this,
// service/skill headings scrape as jobs ("DevOps", "QA and Test Automation"
// on BJIT's page are capability blurbs, not openings).
const ROLE_NOUN_TAIL_RX =
  /\b(engineer|engineers|developer|developers|officer|manager|executive|analyst|designer|architect|administrator|specialist|consultant|scientist|lead|intern|trainee|associate|coordinator|technician|writer|accountant)\)?$/i;

// Pages that state outright that nothing is open.
const NO_OPENINGS_RX =
  /no (current |open |available )?(vacanc|opening|position)|not (currently )?hiring|check back (later|soon)|no openings? (at the moment|currently|right now)/i;

function isTextOnlyJobTitle(t) {
  if (!isJobTitle(t)) return false;
  if (t.split(' ').length < 2) return false;
  return ROLE_NOUN_TAIL_RX.test(t.replace(/[),.]+$/, ''));
}

const sameUrl = (a, b) => a.replace(/\/$/, '') === b.replace(/\/$/, '');

// Custom careers page. Two passes, because employers structure these wildly
// differently:
//   1. Links to a posting. The title is a heading *inside* the link when there
//      is one — anchors often wrap the title plus location, type and an "Apply"
//      label, and using that whole blob as the title fails every length check.
//   2. Fallback for pages that list openings as plain text with no per-job link
//      (e.g. Wix-built sites). Those jobs are real, so surface them and point
//      Apply at the careers page itself rather than inventing a URL.
function parseGeneric($, entry) {
  const out = [];
  const seen = new Set();
  const push = (title, url, viaLink) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, url, location: entry.location, remote: /remote/i.test(title), viaLink });
  };

  $('a[href]').each((_, a) => {
    const $a = $(a);
    const url = absUrl($a.attr('href'), entry.url);
    if (!url || !JOB_HREF_RX.test(url) || sameUrl(url, entry.url)) return;
    const heading = $a.find('h1,h2,h3,h4,h5,h6').first();
    const title = cleanText(heading.length ? heading.text() : $a.text());
    if (!isJobTitle(title)) return;
    push(title, url, true);
  });

  if (!out.length && !NO_OPENINGS_RX.test(cleanText($('body').text()))) {
    $('h1,h2,h3,h4,h5,h6,span,p,li,strong,div').each((_, el) => {
      const $el = $(el);
      if ($el.children().length) return; // leaf text nodes only
      const title = cleanText($el.text());
      if (!isTextOnlyJobTitle(title)) return;
      push(title, entry.url, false);
    });
  }
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
      descriptionHtml: p.viaLink === false
        ? `<p>Open position at ${entry.company}, listed on their careers page. That page doesn't link each opening separately, so Apply opens the careers page — look for this role there.</p>`
        : `<p>Open position at ${entry.company}. Full details are on the company's careers page.</p>`,
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
