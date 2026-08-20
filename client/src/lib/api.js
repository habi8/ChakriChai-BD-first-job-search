export async function searchJobs(filters) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Search failed (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchFilterOptions() {
  const res = await fetch('/api/filters');
  if (!res.ok) throw new Error('filters unavailable');
  return res.json();
}

// Returns { html, company_website?, apply_email?, apply_url_direct? }
export async function fetchDescription(source, id) {
  const res = await fetch(`/api/description?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not load description');
  return body;
}

// Live openings at the tracked BD companies, read from their careers pages.
export async function fetchTopJobs() {
  const res = await fetch('/api/topjobs');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not load top company jobs');
  return body;
}

// Returns { company_website, career_page } — resolved server-side from the
// employer's own site.
export async function fetchCareerPage(source, id) {
  const res = await fetch(`/api/careerpage?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Career page lookup failed');
  return body;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(days) || days < 0) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}
