// ChakriChai API — stateless by design. No database: every request proxies or
// scrapes live sources and returns JSON; all persistence (result cache, saved
// jobs, last filters) lives in the browser's localStorage.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSearch } from './search.js';
import { sourceById } from './sources/index.js';
import { FIELD_GROUPS, ROLE_GROUPS, LEVEL_OPTIONS, FIELD_ROLE_MAP } from './bdcategories.js';
import { resolveCareerPage } from './careerpage.js';
import { withTimeout } from './util/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '100kb' }));

// Permissive CORS so the Vite dev server (5173) can call us directly too.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sources: Object.keys(sourceById) });
});

// Dropdown options for the search form — single source of truth for the
// field/role lists (Bdjobs categories live in bdcategories.js).
app.get('/api/filters', (_req, res) => {
  res.json({
    fieldGroups: FIELD_GROUPS,
    roleGroups: ROLE_GROUPS,
    levels: LEVEL_OPTIONS,
    // field label -> suggested roles; the client rebuilds the Role dropdown
    // from this whenever the selected fields change.
    fieldRoles: FIELD_ROLE_MAP,
  });
});

app.post('/api/search', async (req, res) => {
  const f = req.body || {};
  const filters = {
    fields: Array.isArray(f.fields) ? f.fields.slice(0, 15) : [],
    fieldOther: String(f.fieldOther || '').slice(0, 100),
    roles: Array.isArray(f.roles) ? f.roles.slice(0, 15) : [],
    roleOther: String(f.roleOther || '').slice(0, 100),
    levels: Array.isArray(f.levels) ? f.levels.filter((l) => LEVEL_OPTIONS.includes(l)) : [],
    location: String(f.location || '').slice(0, 100),
    experience: ['0-1', '1-3', '3-5', '5+'].includes(f.experience) ? f.experience : '',
    jobType: ['full_time', 'part_time', 'contract', 'internship'].includes(f.jobType) ? f.jobType : '',
    keywords: String(f.keywords || '').slice(0, 200),
    salaryMin: Number(f.salaryMin) || 0,
    salaryMax: Number(f.salaryMax) || 0,
  };
  try {
    res.json(await runSearch(filters));
  } catch (err) {
    console.error('search failed:', err);
    res.status(500).json({ error: 'Search failed unexpectedly. Please try again.' });
  }
});

// Lazy full-description fetch for sources whose search payload only carries a
// snippet (currently Bdjobs). Only whitelisted source ids reach outbound
// fetches, and only with a validated job id — never an arbitrary URL (SSRF).
app.get('/api/description', async (req, res) => {
  const { source, id } = req.query;
  const mod = sourceById[String(source)];
  if (!mod || typeof mod.fullDescription !== 'function') {
    return res.status(400).json({ error: 'Unknown source for description fetch' });
  }
  try {
    const result = await mod.fullDescription(String(id));
    res.json(typeof result === 'string' ? { html: result } : result);
  } catch (err) {
    res.status(502).json({ error: `Could not load the full description: ${err.message}` });
  }
});

// Resolve the employer's official careers page for a job: re-uses the (memoized)
// source details for company name/website, then discovers + scans the company
// site server-side. Source-whitelisted and id-validated like /api/description —
// the client never supplies a URL to fetch.
app.get('/api/careerpage', async (req, res) => {
  const { source, id } = req.query;
  const mod = sourceById[String(source)];
  if (!mod || typeof mod.fullDescription !== 'function') {
    return res.status(400).json({ error: 'Unknown source for career page lookup' });
  }
  try {
    const details = await mod.fullDescription(String(id));
    const { company = '', company_website = '' } = typeof details === 'string' ? {} : details;
    const resolved = await withTimeout(resolveCareerPage(company, company_website), 15000, 'career page lookup');
    res.json({
      company_website: resolved.company_website || company_website || '',
      career_page: resolved.career_page || '',
    });
  } catch (err) {
    res.status(502).json({ error: `Career page lookup failed: ${err.message}` });
  }
});

// Serve the built frontend when it exists (production mode).
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`ChakriChai API listening on http://localhost:${port}`);
});

