// Filtering + BD-first ranking.
//
// Tiering (the product's core rule):
//   Bangladesh-located jobs  >  remote jobs open to BD/Asia/Worldwide
//   >  other remote jobs     >  everything else
// Relevance to the user's field/role/keywords is scored on top of the tier.

const FIELD_TERMS = {
  CSE: ['software', 'developer', 'software engineer', 'programmer', 'computer science', 'computer engineer', 'backend', 'frontend', 'full stack', 'fullstack', 'devops', 'sre', 'qa engineer', 'mobile app', 'android', 'ios', 'web develop', 'machine learning', ' ai '],
  EEE: ['electrical', 'electronic', 'power', 'embedded', 'hardware', 'circuit', 'telecom', 'instrumentation'],
  IT: ['information technology', ' it ', 'sysadmin', 'system admin', 'network', 'support engineer', 'cloud', 'cyber security', 'information security', 'it security', 'infrastructure', 'helpdesk', 'database'],
  'Data Analysis': ['data analyst', 'data analysis', 'analytics', 'business intelligence', ' bi ', 'data science', 'data scientist', 'sql', 'tableau', 'power bi', 'statistician'],
  Economics: ['economist', 'economics', 'economic', 'research analyst', 'policy analyst', 'market research'],
  // Bdjobs professional categories (labels must match bdcategories.js).
  'Accounting/Finance': ['accounting', 'accountant', 'finance', 'financial', 'audit', 'tax', 'vat', 'bookkeep', 'treasury'],
  'Agro (Plant/Animal/Fisheries)': ['agro', 'agriculture', 'farm', 'fisheries', 'livestock', 'veterinary', 'poultry', 'hatchery'],
  'Bank/Non-Bank Fin. Institution': ['bank', 'banking', 'financial institution', 'microfinance', 'credit', 'loan', 'insurance'],
  'Beauty Care/Health & Fitness': ['beauty', 'salon', 'spa', 'fitness', 'wellness', 'parlour'],
  Commercial: ['commercial', 'export', 'import', 'customs', 'shipment', 'l/c', 'documentation officer'],
  'Company Secretary/Regulatory affairs': ['company secretary', 'regulatory', 'corporate affairs', 'compliance'],
  'Customer Service/Call Centre': ['customer service', 'call centre', 'call center', 'customer care', 'support executive', 'client service'],
  'Data Entry/Operator/BPO': ['data entry', 'bpo', 'operator', 'back office', 'typist', 'annotation'],
  'Design/Creative': ['design', 'creative', 'ui', 'ux', 'graphic', 'illustrator', 'motion', 'animator', 'visual'],
  'Driving/Motor Technician': ['driver', 'driving', 'motor technician', 'chauffeur'],
  'E-commerce/Digital Marketing': ['e-commerce', 'ecommerce', 'digital marketing', 'social media', 'seo', 'content marketing', 'performance marketing'],
  'Education/Training': ['teacher', 'lecturer', 'professor', 'education', 'training', 'tutor', 'academic', 'instructor', 'curriculum'],
  'Electrician/Construction/Repair': ['electrician', 'construction', 'repair', 'maintenance', 'site engineer', 'foreman'],
  'Engineer/Architect': ['engineer', 'engineering', 'architect', 'civil', 'mechanical', 'structural', 'surveyor'],
  'Garments/Textile': ['garment', 'textile', 'apparel', 'merchandis', 'knit', 'dyeing', 'fabric', 'rmg'],
  'General Management/Admin': ['admin', 'administration', 'management', 'operations manager', 'office manager', 'coordinator'],
  'Healthcare/Medical': ['medical', 'doctor', 'physician', 'healthcare', 'hospital', 'clinic', 'dental', 'health officer'],
  'Hospitality/Travel/Tourism': ['hospitality', 'hotel', 'travel', 'tourism', 'restaurant', 'resort', 'ticketing', 'reservation'],
  'HR/Org. Development': ['hr ', 'human resource', 'recruitment', 'talent', 'payroll', 'organizational development'],
  'IT/Telecommunication': ['software', 'developer', 'programmer', 'information technology', ' it ', 'network', 'telecom', 'devops', 'sysadmin', 'database', 'cloud', 'cyber security', 'information security', 'qa', 'data', 'web'],
  'Law/Legal': ['law', 'legal', 'lawyer', 'advocate', 'litigation', 'barrister'],
  'Marketing/Sales': ['marketing', 'sales', 'business development', 'brand', 'campaign', 'territory'],
  'Media/Advertisement/Event Mgt.': ['media', 'journalist', 'advertising', 'advertisement', 'event', 'content', 'copywriter', 'video', 'broadcast'],
  'NGO/Development': ['ngo', 'development', 'humanitarian', 'program officer', 'field officer', 'donor', 'livelihood'],
  Pharmaceutical: ['pharma', 'pharmaceutical', 'pharmacist', 'clinical', 'formulation', 'medical promotion'],
  'Production/Operation': ['production', 'operation', 'plant', 'factory', 'manufacturing', 'quality control', 'qc ', 'shift'],
  'Receptionist/PS': ['receptionist', 'front desk', 'secretary', 'personal assistant'],
  'Research/Consultancy': ['research', 'consultant', 'consultancy', 'analyst', 'survey', 'policy'],
  'Security/Support Service': ['security', 'guard', 'support service', 'surveillance'],
  'Supply Chain/Procurement': ['supply chain', 'procurement', 'purchase', 'logistics', 'warehouse', 'inventory', 'sourcing'],
};

// Fields without a curated list (e.g. Bdjobs skilled trades like "Welder",
// "Chef/Cook") match on the label itself and its slash-separated parts.
function generatedTerms(label) {
  const parts = label
    .toLowerCase()
    .split(/[/(),]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);
  return [...new Set([label.toLowerCase(), ...parts])];
}

export function termsForField(label) {
  return FIELD_TERMS[label] || generatedTerms(label);
}

const ROLE_TERMS = {
  Manager: ['manager', 'management', 'head of', 'lead ', 'team lead', 'supervisor'],
  'Junior Frontend Developer': ['junior frontend', 'frontend developer', 'front-end', 'front end', 'react', 'vue', 'angular', 'ui developer', 'web developer', 'junior developer'],
  'Trainee/Intern': ['intern', 'internship', 'trainee', 'apprentice', 'entry level', 'entry-level', 'fresher', 'graduate'],
  // Field-suggested roles (FIELD_ROLE_MAP in bdcategories.js). Roles without
  // an entry here match on their own name via generatedTerms().
  'Software Engineer': ['software engineer', 'software developer', 'sde', 'software development'],
  'Frontend Developer': ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'ui developer'],
  'Backend Developer': ['backend', 'back-end', 'back end', 'node', 'django', 'laravel', 'spring boot', 'api developer'],
  'Full Stack Developer': ['full stack', 'fullstack', 'mern', 'mean stack'],
  'Mobile App Developer': ['mobile app', 'android', 'ios', 'flutter', 'react native'],
  'Web Developer': ['web developer', 'web development', 'wordpress', 'php developer'],
  'DevOps Engineer': ['devops', 'sre', 'site reliability', 'platform engineer'],
  'QA/Test Engineer': ['qa', 'sqa', 'quality assurance', 'test engineer', 'tester', 'automation test'],
  'Data Engineer': ['data engineer', 'etl', 'data pipeline'],
  'Machine Learning Engineer': ['machine learning', 'ml engineer', ' ai ', 'deep learning'],
  'Data Analyst': ['data analyst', 'data analysis', 'analytics'],
  'Business Analyst': ['business analyst'],
  'Data Scientist': ['data scientist', 'data science'],
  'BI Analyst': ['business intelligence', ' bi ', 'power bi', 'tableau'],
  'System Administrator': ['system admin', 'sysadmin', 'systems administrator'],
  'Network Engineer': ['network engineer', 'network admin', 'network administrator'],
  'Database Administrator': ['database administrator', 'database admin', ' dba '],
  'IT Support Engineer': ['it support', 'support engineer', 'helpdesk', 'technical support'],
  'Cyber Security Analyst': ['cyber security', 'security analyst', 'information security', 'soc analyst'],
  'Cloud Engineer': ['cloud engineer', 'aws', 'azure', 'gcp'],
  'UI/UX Designer': ['ui/ux', 'ui designer', 'ux designer', 'product designer'],
  'Customer Service Representative': ['customer service', 'customer care', 'customer support'],
  'Call Centre Agent': ['call centre', 'call center'],
  'Content Writer': ['content writer', 'content writing', 'copywriter'],
  'Digital Marketing Executive': ['digital marketing', 'digital marketer'],
  'SEO Specialist': ['seo'],
  'Social Media Manager': ['social media'],
};

// Seniority-level hints (Entry/Mid/Top, mirroring Bdjobs' Job Level filter).
// Soft signals only — plenty of titles carry no level wording, so levels
// boost/penalize rather than hard-filter (Bdjobs filters server-side anyway).
const LEVEL_HINTS = {
  Entry: { boost: ['entry', 'junior', 'intern', 'trainee', 'fresher', 'graduate', 'associate', 'assistant'], penalty: ['senior', 'lead ', 'principal', 'head of', 'director', 'chief'] },
  Mid: { boost: ['mid-level', 'mid level', 'senior', 'executive', 'specialist', 'officer'], penalty: ['intern', 'trainee', 'director', 'chief'] },
  Top: { boost: ['head of', 'director', 'chief', 'vp ', 'vice president', 'principal', 'general manager', 'manager'], penalty: ['intern', 'trainee', 'junior', 'fresher'] },
};

const BD_PLACES = ['bangladesh', 'dhaka', 'chattogram', 'chittagong', 'sylhet', 'khulna', 'rajshahi', 'barishal', 'barisal', 'rangpur', 'mymensingh', 'gazipur', 'narayanganj', 'cumilla', 'comilla', "cox's bazar"];
const BD_FRIENDLY_REMOTE = ['worldwide', 'anywhere', 'global', 'asia', 'apac', 'south asia', 'international'];
const REGION_LOCKED = ['us only', 'usa only', 'united states', 'us timezones', 'north america', 'americas', 'europe', 'european', ' eu ', 'emea', 'germany', 'united kingdom', ' uk ', 'canada', 'australia', 'latam', 'cet timezone', 'est timezone', 'pst'];

const norm = (s) => ` ${String(s || '').toLowerCase()} `;

function haystackOf(job) {
  return norm([job.title, job.company, job.location, job.snippet, job.tags.join(' ')].join(' \n '));
}

function anyMatch(hay, terms) {
  return terms.some((t) => hay.includes(t.toLowerCase()));
}

// 0 = other, 1 = region-locked remote, 2 = remote (unclear region),
// 3 = BD-friendly remote, 4 = located in Bangladesh
export function locationTier(job) {
  const loc = norm(job.location);
  const hay = haystackOf(job);
  if (job.source === 'bdjobs' || anyMatch(loc, BD_PLACES)) return 4;
  const remoteish = job.remote || loc.includes('remote');
  if (!remoteish) return 0;
  if (anyMatch(loc, BD_FRIENDLY_REMOTE) || anyMatch(hay, BD_FRIENDLY_REMOTE)) return 3;
  if (anyMatch(loc, REGION_LOCKED)) return 1;
  return 2;
}

const TIER_SCORE = { 4: 100, 3: 60, 2: 40, 1: 15, 0: 0 };
const TIER_LABEL = {
  4: 'Bangladesh',
  3: 'Remote · open worldwide/Asia',
  2: 'Remote',
  1: 'Remote · region-restricted',
  0: 'On-site abroad',
};

function collectTermGroups(filters) {
  const groups = [];
  for (const f of filters.fields || []) {
    if (f === 'Other') continue;
    groups.push({ kind: 'field', label: f, terms: termsForField(f) });
  }
  if (filters.fieldOther?.trim()) {
    groups.push({ kind: 'field', label: filters.fieldOther.trim(), terms: [filters.fieldOther.trim().toLowerCase()] });
  }
  for (const r of filters.roles || []) {
    if (r === 'Other') continue;
    groups.push({ kind: 'role', label: r, terms: ROLE_TERMS[r] || generatedTerms(r) });
  }
  if (filters.roleOther?.trim()) {
    groups.push({ kind: 'role', label: filters.roleOther.trim(), terms: [filters.roleOther.trim().toLowerCase()] });
  }
  const kw = (filters.keywords || '').trim().toLowerCase();
  if (kw) {
    const words = kw.split(/[,;]+|\s{2,}/).map((w) => w.trim()).filter(Boolean);
    groups.push({ kind: 'keywords', label: kw, terms: words.length ? words : [kw] });
  }
  return groups;
}

const EXP_HINTS = {
  '0-1': { boost: ['intern', 'trainee', 'junior', 'entry', 'fresher', 'graduate', 'associate'], penalty: ['senior', 'lead', 'principal', 'staff ', 'director', 'head of'] },
  '1-3': { boost: ['junior', 'associate', 'mid'], penalty: ['principal', 'director', 'head of', 'staff '] },
  '3-5': { boost: ['mid', 'senior'], penalty: ['intern', 'trainee', 'director'] },
  '5+': { boost: ['senior', 'lead', 'principal', 'staff ', 'manager', 'head of', 'director'], penalty: ['intern', 'trainee', 'junior', 'fresher'] },
};

// Seniority inferred from the job title, for the "Top jobs" browse view.
// Scraped career-page jobs carry no structured level field, but titles are
// reliable enough to order by: 6 = C-level … 0 = intern.
const SENIORITY_RULES = [
  [6, /\b(chief|cto|ceo|cfo|coo|vp|vice president)\b/i],
  [5, /\b(head of|director|principal)\b/i],
  [4, /\b(lead|manager|architect)\b/i],
  [3, /\b(senior|sr\.?|specialist|consultant)\b/i],
  [1, /\b(junior|jr\.?|associate|assistant)\b/i],
  [0, /\b(intern|internship|trainee|apprentice|fresher|graduate)\b/i],
];

export function seniorityRank(title = '') {
  for (const [rank, rx] of SENIORITY_RULES) if (rx.test(title)) return rank;
  return 2; // unmarked titles read as mid-level
}

export const SENIORITY_LABEL = {
  6: 'C-level',
  5: 'Principal / Director',
  4: 'Lead / Manager',
  3: 'Senior',
  2: 'Mid level',
  1: 'Junior',
  0: 'Intern / Trainee',
};

// Highest number found in a salary string, for sorting. 0 = unknown.
export function salaryValue(salary = '') {
  const nums = parseSalaryNumbers(salary);
  return nums.length ? Math.max(...nums) : 0;
}

function parseSalaryNumbers(s) {
  const nums = (String(s).match(/\d[\d,]*/g) || []).map((n) => Number(n.replace(/,/g, '')));
  return nums.filter((n) => n > 0);
}

// Renamed districts still appear under old spellings in many postings.
const DISTRICT_ALIASES = {
  chattogram: ['chittagong'],
  barishal: ['barisal'],
  bogura: ['bogra'],
  cumilla: ['comilla'],
  jashore: ['jessore'],
  chapainawabganj: ['nawabganj'],
};

function districtMatches(jobLocation, districts) {
  const loc = norm(jobLocation);
  return districts.some((d) => loc.includes(d) || (DISTRICT_ALIASES[d] || []).some((a) => loc.includes(a)));
}

// Mutates nothing; returns filtered + ranked copy with _score/_tier annotations.
export function rankJobs(jobs, filters) {
  const groups = collectTermGroups(filters);
  const selectedLocations = filters.locations || [];
  const wantRemote = selectedLocations.includes('Remote');
  const wantDistricts = selectedLocations.filter((l) => l !== 'Remote').map((l) => l.toLowerCase());
  const exp = EXP_HINTS[filters.experience] || null;
  const now = Date.now();

  const scored = [];
  for (const job of jobs) {
    const title = norm(job.title);
    const tags = norm(job.tags.join(' '));
    // Term matching deliberately excludes company name and location — in BD
    // half the market is "XYZ Developer Company" (real estate), which used to
    // false-match CSE/IT searches.
    const body = norm(job.snippet);
    const text = `${title} ${tags} ${body}`;

    // Hard filter with AND semantics: every filter kind the user set (fields,
    // roles, keywords) must be satisfied by at least one of its groups —
    // selecting field IT + role Manager means IT-ish AND manager-ish, not
    // "any manager job".
    const kindsRequired = new Set(groups.map((g) => g.kind));
    const matchedKinds = new Set();
    let relevance = 0;
    for (const g of groups) {
      // A source-side category match (Bdjobs queried by this exact category or
      // designation) counts even without a textual synonym hit.
      const preMatched = job.field === g.label;
      const inTitle = anyMatch(title, g.terms) || anyMatch(tags, g.terms);
      // Roles must show in the title (or be source-verified); fields and
      // keywords may also match the snippet text.
      const matched = g.kind === 'role' ? inTitle || preMatched : inTitle || preMatched || anyMatch(body, g.terms);
      if (!matched) continue;
      matchedKinds.add(g.kind);
      relevance += inTitle ? 30 : preMatched ? 20 : 12;
      if (!job.field && g.kind === 'field') job.field = g.label;
      if (!job.role_level && g.kind === 'role') job.role_level = g.label;
    }
    if (matchedKinds.size < kindsRequired.size) continue;

    // Hard filter: explicit job type against jobs whose type is known.
    // Unknown-type jobs are kept but demoted — except for internship searches,
    // where an unknown type with no intern-ish wording is almost never a match.
    if (filters.jobType && job.job_type && job.job_type !== filters.jobType) continue;
    if (
      filters.jobType === 'internship' &&
      !job.job_type &&
      !anyMatch(text, ['intern', 'trainee', 'apprentice', 'graduate program'])
    ) {
      continue;
    }

    const tier = locationTier(job);
    let score = TIER_SCORE[tier] + relevance;

    if (filters.jobType && !job.job_type) score -= 5; // unknown type: keep, demote a bit

    if (wantDistricts.length && tier === 4) {
      // District filter is hard for Bangladesh-located jobs — but postings
      // that say "Anywhere in Bangladesh" qualify for every district.
      const anywhere = norm(job.location).includes('anywhere');
      if (districtMatches(job.location, wantDistricts)) score += 20;
      else if (!anywhere) continue;
    }
    if (wantRemote) score += tier === 3 ? 15 : tier === 2 ? 10 : 0;

    if (exp) {
      if (anyMatch(text, exp.boost)) score += 10;
      if (anyMatch(title, exp.penalty)) score -= 12;
    }

    for (const lvl of filters.levels || []) {
      const hints = LEVEL_HINTS[lvl];
      if (!hints) continue;
      if (anyMatch(title, hints.boost)) score += 10;
      if (anyMatch(title, hints.penalty)) score -= 12;
    }

    const min = Number(filters.salaryMin) || 0;
    const max = Number(filters.salaryMax) || 0;
    if ((min || max) && job.salary) {
      const nums = parseSalaryNumbers(job.salary);
      if (nums.length) {
        const jobMax = Math.max(...nums);
        const jobMin = Math.min(...nums);
        const overlaps = (!min || jobMax >= min) && (!max || jobMin <= max);
        score += overlaps ? 8 : -8;
      }
    }

    // Freshness: up to +10 for jobs posted in the last 30 days.
    if (job.posted_date) {
      const days = (now - new Date(job.posted_date).getTime()) / 86400000;
      if (days >= 0 && days < 30) score += Math.round(10 * (1 - days / 30));
    }

    scored.push({ ...job, location_tier: tier, location_tier_label: TIER_LABEL[tier], _score: score });
  }

  // Location tier is the primary sort key: Bangladesh jobs always come before
  // BD-friendly remote, which come before the rest — text relevance only
  // orders jobs *within* a tier. (Exception: selecting only "Remote" keeps
  // pure score order, where remote jobs already carry the boost.)
  const remoteOnly = wantRemote && !wantDistricts.length;
  scored.sort(
    (a, b) =>
      (remoteOnly ? 0 : b.location_tier - a.location_tier) ||
      b._score - a._score ||
      String(b.posted_date).localeCompare(String(a.posted_date))
  );
  return scored;
}

// Best single keyword to feed keyword-driven sources (Bdjobs, Adzuna).
export function primaryKeyword(filters) {
  const kw = (filters.keywords || '').trim();
  if (kw) return kw.split(/[,;]/)[0].trim();
  if (filters.roleOther?.trim()) return filters.roleOther.trim();
  const ROLE_KW = { Manager: 'manager', 'Junior Frontend Developer': 'frontend developer', 'Trainee/Intern': 'intern' };
  for (const r of filters.roles || []) {
    if (r === 'Other') continue;
    if (ROLE_KW[r]) return ROLE_KW[r];
    return r.replace(/\//g, ' '); // e.g. "QA/Test Engineer" → "QA Test Engineer"
  }
  if (filters.fieldOther?.trim()) return filters.fieldOther.trim();
  const FIELD_KW = { CSE: 'software engineer', EEE: 'electrical engineer', IT: 'IT', 'Data Analysis': 'data analyst', Economics: 'economist' };
  for (const f of filters.fields || []) {
    if (FIELD_KW[f]) return FIELD_KW[f];
    if (f !== 'Other') return f.split('/')[0].trim(); // e.g. "Marketing/Sales" → "Marketing"
  }
  return '';
}
