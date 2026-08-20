import { useEffect, useMemo, useState } from 'react';
import SearchForm, { EMPTY_FILTERS } from './components/SearchForm.jsx';
import JobCard from './components/JobCard.jsx';
import SourceStatus from './components/SourceStatus.jsx';
import TopJobs from './components/TopJobs.jsx';
import SplashNotice from './components/SplashNotice.jsx';
import { searchJobs, fetchFilterOptions } from './lib/api.js';
import {
  getCachedResults,
  setCachedResults,
  getLastFilters,
  setLastFilters,
  getBookmarks,
  toggleBookmark,
  getApplied,
  toggleApplied,
  getAppliedJobs,
  getShowApplied,
  setShowApplied,
} from './lib/storage.js';

const PAGE_SIZE = 12;

// Saved filters can predate the Role/Level split — migrate old level-ish role
// values into `levels` and make sure every expected key exists.
function normalizeFilters(f) {
  if (!f) return { ...EMPTY_FILTERS };
  const out = { ...EMPTY_FILTERS, ...f };
  const LEVEL_MAP = { 'Entry Level': 'Entry', 'Mid Level': 'Mid', 'Top Level': 'Top' };
  const migrated = (out.roles || []).filter((r) => LEVEL_MAP[r]).map((r) => LEVEL_MAP[r]);
  if (migrated.length) {
    out.levels = [...new Set([...(out.levels || []), ...migrated])];
    out.roles = out.roles.filter((r) => !LEVEL_MAP[r]);
  }
  // Location was free text before it became a dropdown — migrate what we can.
  if (typeof f.location === 'string' && f.location.trim() && !(out.locations || []).length) {
    const loc = f.location.trim().toLowerCase();
    if (loc === 'remote') out.locations = ['Remote'];
    else out.locations = [f.location.trim().replace(/^./, (c) => c.toUpperCase())];
  }
  delete out.location;
  return out;
}

export default function App() {
  const [filters, setFilters] = useState(() => normalizeFilters(getLastFilters()));
  const [results, setResults] = useState(null); // { jobs, total, sources, searchedAt }
  const [cachedAt, setCachedAt] = useState(null); // timestamp when served from localStorage
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bookmarks, setBookmarks] = useState(() => getBookmarks());
  const [applied, setApplied] = useState(() => getApplied());
  const [showApplied, setShowAppliedState] = useState(() => getShowApplied());
  const [view, setView] = useState('search'); // 'search' | 'saved' | 'applied' | 'top'
  const [searched, setSearched] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null); // { fieldGroups, roles }
  const [splash, setSplash] = useState(true);

  // Dropdown option lists come from the server (includes all Bdjobs
  // categories); the form falls back to built-in defaults until they arrive.
  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((j) => j.id)), [bookmarks]);

  // Returning visitor: restore last search instantly from cache if still fresh.
  useEffect(() => {
    const last = getLastFilters();
    if (!last) return;
    const cached = getCachedResults(last);
    if (cached) {
      setResults(cached.results);
      setCachedAt(cached.fetchedAt);
      setSearched(true);
    }
  }, []);

  async function runSearch({ force = false } = {}) {
    setError('');
    setExpandedId(null);
    setVisibleCount(PAGE_SIZE);
    setSearched(true);
    setLastFilters(filters);

    if (!force) {
      const cached = getCachedResults(filters);
      if (cached) {
        setResults(cached.results);
        setCachedAt(cached.fetchedAt);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await searchJobs(filters);
      setResults(data);
      setCachedAt(null);
      // Only cache healthy responses: if a source was down or Bdjobs came back
      // empty (it hiccups occasionally), the next search should refetch rather
      // than pin degraded results for hours.
      const bdjobs = data.sources?.find((s) => s.id === 'bdjobs');
      const healthy = data.sources?.every((s) => s.ok) && (!bdjobs || bdjobs.count > 0);
      if (healthy) setCachedResults(filters, data);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const onBookmark = (job) => setBookmarks([...toggleBookmark(job)]);
  const onApplied = (job) => setApplied(toggleApplied(job));

  const onToggleShowApplied = (value) => {
    setShowAppliedState(value);
    setShowApplied(value);
  };

  // "Show applied" is a view filter over results already fetched — no refetch,
  // and the cached payload keeps every job so toggling back is instant.
  const allJobs = results?.jobs || [];
  const jobs = showApplied ? allJobs : allJobs.filter((j) => !applied[j.id]);
  const hiddenCount = allJobs.length - jobs.length;
  const visibleJobs = jobs.slice(0, visibleCount);
  // The Saved and Applied tabs always list everything in them. "Show applied"
  // filters search results only — applying it to these tabs made the tab count
  // disagree with an empty list (saved job that was also marked applied).
  const savedList = bookmarks;
  const shownList = view === 'saved' ? savedList : visibleJobs;
  const appliedJobs = getAppliedJobs(applied);
  const legacyAppliedCount = Object.keys(applied).length - appliedJobs.length;

  return (
    <>
      {splash && <SplashNotice onDone={() => setSplash(false)} />}
      <div className={`app ${splash ? 'app-blurred' : ''}`} aria-hidden={splash || undefined}>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <h1>
              Chakri<span>Chai</span>
            </h1>
            <p className="tagline">Bangladesh-first job search — local boards, BD-friendly remote, global fallback</p>
          </div>
          <nav className="tabs">
            <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>
              Search
            </button>
            <button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>
              Saved{bookmarks.length ? ` (${bookmarks.length})` : ''}
            </button>
            <button className={view === 'applied' ? 'active' : ''} onClick={() => setView('applied')}>
              Applied{appliedJobs.length ? ` (${appliedJobs.length})` : ''}
            </button>
          </nav>
        </div>
      </header>

      <main className="content">
        {view === 'search' && (
          <>
            <SearchForm
              filters={filters}
              onChange={setFilters}
              onSearch={runSearch}
              loading={loading}
              fieldGroups={filterOptions?.fieldGroups}
              roleGroups={filterOptions?.roleGroups}
              levelOptions={filterOptions?.levels}
              fieldRoles={filterOptions?.fieldRoles}
              locationGroups={filterOptions?.locationGroups}
              showApplied={showApplied}
              onToggleShowApplied={onToggleShowApplied}
              appliedCount={Object.keys(applied).length}
            />

            {cachedAt && !loading && (
              <div className="cache-note">
                Showing cached results from {Math.max(1, Math.round((Date.now() - cachedAt) / 60000))} min ago.
                <button className="btn-link" onClick={() => runSearch({ force: true })}>
                  Refresh now
                </button>
              </div>
            )}

            {results && !loading && <SourceStatus sources={results.sources} />}

            {loading && (
              <div className="job-grid" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="job-card skeleton">
                    <div className="sk-line w40" />
                    <div className="sk-line w80" />
                    <div className="sk-line w60" />
                    <div className="sk-block" />
                  </div>
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="state-box error-box">
                <h2>Something went wrong</h2>
                <p>{error}</p>
                <button className="btn-primary" onClick={() => runSearch({ force: true })}>
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && searched && results && jobs.length === 0 && allJobs.length > 0 && (
              <div className="state-box empty-box">
                <h2>You've applied to all {allJobs.length} matching jobs</h2>
                <p>
                  Turn <strong>Show applied</strong> back on above to see them, or broaden your
                  filters for new results.
                </p>
              </div>
            )}

            {!loading && !error && searched && results && allJobs.length === 0 && (
              <div className="state-box empty-box">
                <h2>No jobs matched your filters</h2>
                <p>Try broadening the search:</p>
                <ul>
                  <li>Remove the job-type or experience filter</li>
                  <li>Use fewer or more general keywords (e.g. “developer” instead of “React 18 developer”)</li>
                  <li>Leave location empty, or search “remote”</li>
                  <li>Select more fields/roles</li>
                </ul>
              </div>
            )}

            {!loading && (
              <div className="top-jobs-cta">
                <button type="button" className="btn-top-jobs" onClick={() => setView('top')}>
                  ★ View top jobs
                </button>
                <span className="top-jobs-cta-note">
                  Browse everything open right now at top Bangladeshi tech companies
                </span>
              </div>
            )}

            {!loading && !searched && (
              <div className="state-box hello-box">
                <h2>Find your next job</h2>
                <p>
                  Pick a field and role above and hit <strong>Search jobs</strong>. Results combine
                  Bdjobs.com, international company boards, and BD-friendly remote job APIs —
                  Bangladesh-based listings always rank first.
                </p>
              </div>
            )}

            {!loading && !error && jobs.length > 0 && (
              <>
                <div className="result-count">
                  {results.total} matching job{results.total === 1 ? '' : 's'}
                  {results.truncated ? ` (showing top ${allJobs.length})` : ''}
                  {hiddenCount > 0 && ` · ${hiddenCount} applied hidden`}
                </div>
                <div className="job-grid">
                  {shownList.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      expanded={expandedId === job.id}
                      onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                      bookmarked={bookmarkedIds.has(job.id)}
                      onBookmark={onBookmark}
                      applied={Boolean(applied[job.id])}
                      onApplied={onApplied}
                    />
                  ))}
                </div>
                {visibleCount < jobs.length && (
                  <div className="load-more-wrap">
                    <button className="btn-ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                      Load more ({jobs.length - visibleCount} left)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {view === 'top' && (
          <TopJobs
            onBack={() => setView('search')}
            bookmarkedIds={bookmarkedIds}
            onBookmark={onBookmark}
            applied={applied}
            onApplied={onApplied}
            showApplied={showApplied}
          />
        )}

        {view === 'applied' &&
          (appliedJobs.length === 0 ? (
            <div className="state-box empty-box">
              <h2>No applied jobs yet</h2>
              <p>
                Hit <strong>Mark applied</strong> on any job card after you apply, and it will
                be listed here (stored in this browser only).
              </p>
              {legacyAppliedCount > 0 && (
                <p className="applied-legacy-note">
                  {legacyAppliedCount} job{legacyAppliedCount === 1 ? '' : 's'} you marked
                  before this tab existed {legacyAppliedCount === 1 ? 'is' : 'are'} still
                  marked in search results, but {legacyAppliedCount === 1 ? 'wasn’t' : 'weren’t'}{' '}
                  saved in full so {legacyAppliedCount === 1 ? 'it can’t' : 'they can’t'} be
                  shown here.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="result-count">
                {appliedJobs.length} job{appliedJobs.length === 1 ? '' : 's'} you've applied to
                {legacyAppliedCount > 0 && ` · ${legacyAppliedCount} older mark${legacyAppliedCount === 1 ? '' : 's'} without saved details`}
              </div>
              <div className="job-grid">
                {appliedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    expanded={expandedId === job.id}
                    onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                    bookmarked={bookmarkedIds.has(job.id)}
                    onBookmark={onBookmark}
                    applied={true}
                    onApplied={onApplied}
                  />
                ))}
              </div>
            </>
          ))}

        {view === 'saved' &&
          (savedList.length === 0 ? (
            <div className="state-box empty-box">
              <h2>No saved jobs yet</h2>
              <p>Hit the ☆ on any job card to keep it here (stored in this browser only).</p>
            </div>
          ) : (
            <div className="job-grid">
              {savedList.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  bookmarked={true}
                  onBookmark={onBookmark}
                  applied={Boolean(applied[job.id])}
                  onApplied={onApplied}
                />
              ))}
            </div>
          ))}
      </main>

      <footer className="app-footer">
        <p>
          Prototype aggregator. Listings come from their original job boards — applying always
          opens the source posting. Bdjobs integration uses an unofficial endpoint and may
          break without notice. Results cached in your browser for up to 3 hours.
        </p>
      </footer>
      </div>
    </>
  );
}
