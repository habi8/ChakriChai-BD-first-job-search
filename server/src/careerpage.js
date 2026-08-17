// Career-page resolver: given a company (and optionally its website from the
// job posting), find the company's official careers/jobs page so the user can
// apply on the employer's own site.
//
// Strategy, cheapest first:
//   1. no website known → discover the official site via DuckDuckGo HTML
//      search (skipped for confidential/generic employer names)
//   2. scan the homepage for links whose text/href look like a careers page
//   3. probe common paths (/careers, /career, /jobs)
// All outbound fetches are polite (throttled + memoized) and time-boxed; any
// failure just degrades to whatever we already know.
import * as cheerio from 'cheerio';
import { politeFetchCached } from './util/http.js';

const CAREER_RX = /career|careers|jobs|vacanc|recruit|join\s?-?_?us|opportunit|work\s?with\s?us/i;
const BLOCKED_RESULT_HOSTS = /(facebook|linkedin|twitter|youtube|instagram|tiktok|wikipedia|bdjobs|glassdoor|indeed|chakri|skill\.jobs)\./i;
const GENERIC_COMPANY_RX = /confidential|a leading|one of the|reputed|renowned|undisclosed|multinational company$/i;

// Never fetch private/loopback targets (we fetch third-party URLs here).
function isSafeHttpUrl(raw, base) {
  try {
    const u = new URL(raw, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (
      !host.includes('.') ||
      host === 'localhost' ||
      host.endsWith('.local') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) || // any bare IP: refuse, avoids private-range checks
      host.startsWith('[') // IPv6 literal
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

// DuckDuckGo HTML results wrap targets as /l/?uddg=<encoded-url>.
function extractDdgUrl(href) {
  try {
    const u = new URL(href, 'https://html.duckduckgo.com');
    const target = u.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : href;
  } catch {
    return null;
  }
}

async function discoverWebsite(company) {
  if (!company || GENERIC_COMPANY_RX.test(company)) return '';
  const q = encodeURIComponent(`${company} Bangladesh official website`);
  const html = await politeFetchCached(`https://html.duckduckgo.com/html/?q=${q}`, { timeoutMs: 7000 });
  const $ = cheerio.load(html);
  for (const a of $('a.result__a, a.result__url').toArray()) {
    const target = extractDdgUrl($(a).attr('href') || '');
    const u = target && isSafeHttpUrl(target);
    if (u && !BLOCKED_RESULT_HOSTS.test(u.hostname)) return u.origin;
  }
  return '';
}

// Look through homepage links for the best careers-page candidate.
async function scanHomepage(website) {
  const html = await politeFetchCached(website, { timeoutMs: 7000 });
  const $ = cheerio.load(html);
  const siteHost = new URL(website).hostname.replace(/^www\./, '');
  let best = null;
  let bestScore = 0;
  for (const a of $('a[href]').toArray()) {
    const href = $(a).attr('href') || '';
    const text = $(a).text().trim();
    const u = isSafeHttpUrl(href, website);
    if (!u) continue;
    let score = 0;
    if (CAREER_RX.test(text)) score += 2;
    if (CAREER_RX.test(u.pathname)) score += 2;
    if (!score) continue;
    const sameSite = u.hostname.replace(/^www\./, '').endsWith(siteHost);
    // Off-site careers links are fine when they point at an ATS the company
    // uses (greenhouse/lever/workable/etc.), otherwise prefer same-site.
    if (sameSite) score += 2;
    else if (/greenhouse|lever\.co|workable|bamboohr|smartrecruiters|recruitee|zoho/i.test(u.hostname)) score += 1;
    else continue;
    if (score > bestScore) {
      bestScore = score;
      best = u.href;
    }
  }
  return best || '';
}

async function probeCommonPaths(website) {
  const origin = new URL(website).origin;
  for (const path of ['careers', 'career', 'jobs']) {
    try {
      await politeFetchCached(`${origin}/${path}`, { timeoutMs: 5000 });
      return `${origin}/${path}`; // non-2xx throws, so reaching here means it exists
    } catch {
      /* try next */
    }
  }
  return '';
}

export async function resolveCareerPage(company, knownWebsite) {
  let website = isSafeHttpUrl(knownWebsite || '')?.href || '';
  if (!website) website = await discoverWebsite(company).catch(() => '');
  if (!website) return { company_website: '', career_page: '' };

  let careerPage = await scanHomepage(website).catch(() => '');
  if (!careerPage) careerPage = await probeCommonPaths(website).catch(() => '');
  return { company_website: website, career_page: careerPage };
}
