import { useEffect, useMemo, useState } from 'react';
import SearchForm, { EMPTY_FILTERS } from './components/SearchForm.jsx';
import JobCard from './components/JobCard.jsx';
import SourceStatus from './components/SourceStatus.jsx';
import { searchJobs, fetchFilterOptions } from './lib/api.js';
import {
  getCachedResults,
  setCachedResults,
  getLastFilters,
  setLastFilters,
  getBookmarks,
  toggleBookmark,
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
  const [view, setView] = useState('search'); // 'search' | 'saved'
  const [searched, setSearched] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null); // { fieldGroups, roles }

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

  const jobs = results?.jobs || [];
  const visibleJobs = jobs.slice(0, visibleCount);
  const shownList = view === 'saved' ? bookmarks : visibleJobs;

  return (
    <div className="app">
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

            {!loading && !error && searched && results && jobs.length === 0 && (
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
                  {results.truncated ? ` (showing top ${jobs.length})` : ''}
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

        {view === 'saved' &&
          (bookmarks.length === 0 ? (
            <div className="state-box empty-box">
              <h2>No saved jobs yet</h2>
              <p>Hit the ☆ on any job card to keep it here (stored in this browser only).</p>
            </div>
          ) : (
            <div className="job-grid">
              {bookmarks.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  bookmarked={true}
                  onBookmark={onBookmark}
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
  );
}
