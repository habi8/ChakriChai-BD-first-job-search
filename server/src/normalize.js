// Normalization helpers: every source adapter funnels its raw payload through
// makeJob() so the rest of the app only ever sees the common schema.

import * as cheerio from 'cheerio';

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’',
  lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•',
};

// Greenhouse ships job content HTML-escaped ("&lt;p&gt;..."); decode it first.
export function decodeEntities(str = '') {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// Strip dangerous/irrelevant markup before the client renders it with
// dangerouslySetInnerHTML. Allowlist-ish: structural + text tags survive,
// scripts/styles/forms/embeds and event handlers do not.
const STRIP_TAGS = 'script, style, iframe, object, embed, form, input, button, select, textarea, link, meta, svg, video, audio, canvas';

export function sanitizeHtml(html = '') {
  if (!html.trim()) return '';
  const $ = cheerio.load(html, null, false);
  $(STRIP_TAGS).remove();
  $('*').each((_, el) => {
    const attribs = el.attribs || {};
    for (const name of Object.keys(attribs)) {
      const val = attribs[name] || '';
      const keepHref = name === 'href' && /^https?:/i.test(val.trim());
      const keepSrc = name === 'src' && el.tagName === 'img' && /^https?:/i.test(val.trim());
      if (!keepHref && !keepSrc) $(el).removeAttr(name);
    }
  });
  $('a').attr('target', '_blank').attr('rel', 'noopener noreferrer');
  return $.html();
}

export function htmlToText(html = '') {
  if (!html) return '';
  const $ = cheerio.load(html, null, false);
  $('script, style').remove();
  return $.root().text().replace(/\s+/g, ' ').trim();
}

export function makeSnippet(htmlOrText, maxLen = 240) {
  const text = htmlToText(htmlOrText);
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), maxLen - 30)) + '…';
}

export function normalizeJobType(raw = '') {
  const s = String(raw).toLowerCase();
  if (!s) return '';
  if (/intern|trainee|apprentice/.test(s)) return 'internship';
  if (/part[\s_-]?time/.test(s)) return 'part_time';
  if (/contract|freelance|temporary/.test(s)) return 'contract';
  if (/full[\s_-]?time|permanent|professional/.test(s)) return 'full_time';
  return '';
}

export function toIsoDate(value) {
  if (!value) return null;
  const d = typeof value === 'number'
    ? new Date(value < 1e12 ? value * 1000 : value) // seconds vs ms epoch
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// The common job schema. Everything downstream (ranking, API response,
// frontend) relies on exactly these fields.
export function makeJob({
  source, sourceId, title, company, location, postedDate, descriptionHtml,
  applyUrl, jobType = '', salary = '', tags = [], remote = false,
  needsFullDescription = false,
}) {
  if (!title || !applyUrl) return null;
  const full = descriptionHtml ? sanitizeHtml(descriptionHtml) : '';
  return {
    id: `${source}:${sourceId}`,
    title: String(title).trim(),
    company: String(company || 'Unknown company').trim(),
    location: String(location || (remote ? 'Remote' : 'Not specified')).trim(),
    field: '',       // filled by ranking (best-effort classification)
    role_level: '',  // filled by ranking (best-effort classification)
    posted_date: toIsoDate(postedDate),
    snippet: makeSnippet(full || ''),
    full_description_html: needsFullDescription ? '' : full,
    needs_full_description: Boolean(needsFullDescription),
    apply_url: applyUrl,
    source,
    job_type: normalizeJobType(jobType),
    salary: String(salary || '').trim(),
    tags: (tags || []).map((t) => String(t).toLowerCase()).slice(0, 20),
    remote: Boolean(remote),
  };
}
