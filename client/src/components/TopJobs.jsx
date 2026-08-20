import { useEffect, useMemo, useState } from 'react';
import JobCard from './JobCard.jsx';
import { fetchTopJobs } from '../lib/api.js';

// "Top jobs" browse view: everything currently open at the tracked BD tech
// companies, scraped live from their own careers pages. Sortable by seniority
// level, salary, or company — sorting is local, so it never refetches.
const SORTS = [
  { id: 'level', label: 'Level (senior first)' },
  { id: 'level_asc', label: 'Level (entry first)' },
  { id: 'salary', label: 'Salary (high to low)' },
  { id: 'company', label: 'Company (A–Z)' },
];

export default function TopJobs({ onBack, bookmarkedIds, onBookmark, applied, onApplied, showApplied }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [sort, setSort] = useState('level');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetchTopJobs()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const jobs = useMemo(() => {
    const list = (data?.jobs || []).filter((j) => showApplied || !applied[j.id]);
    const sorted = [...list];
    if (sort === 'level') sorted.sort((a, b) => b.seniority - a.seniority || a.title.localeCompare(b.title));
    else if (sort === 'level_asc') sorted.sort((a, b) => a.seniority - b.seniority || a.title.localeCompare(b.title));
    else if (sort === 'salary') sorted.sort((a, b) => b.salary_value - a.salary_value || b.seniority - a.seniority);
    else sorted.sort((a, b) => a.company.localeCompare(b.company) || b.seniority - a.seniority);
    return sorted;
  }, [data, sort, applied, showApplied]);

  const withSalary = jobs.filter((j) => j.salary_value > 0).length;

  return (
    <section className="top-jobs">
      <div className="top-jobs-head">
        <div>
          <h2>Top company jobs</h2>
          <p className="top-jobs-sub">
            Live openings read straight from {data?.companies?.length || 20} Bangladeshi tech
            companies' own careers pages.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back to search
        </button>
      </div>

      {state === 'loading' && (
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

      {state === 'error' && (
        <div className="state-box error-box">
          <h2>Couldn't load top jobs</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={onBack}>
            Back to search
          </button>
        </div>
      )}

      {state === 'ready' && jobs.length === 0 && (
        <div className="state-box empty-box">
          <h2>No openings found right now</h2>
          <p>
            None of the tracked companies is currently listing an opening we can read. Try a
            regular search — Bdjobs and the international boards usually have more.
          </p>
        </div>
      )}

      {state === 'ready' && jobs.length > 0 && (
        <>
          <div className="top-jobs-controls">
            <label htmlFor="topsort">Sort by</label>
            <select id="topsort" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="top-jobs-count">
              {jobs.length} opening{jobs.length === 1 ? '' : 's'}
              {sort === 'salary' && withSalary === 0 && ' · none list a salary'}
            </span>
          </div>

          {sort === 'salary' && withSalary === 0 && (
            <p className="top-jobs-note">
              Career pages rarely publish salaries, so this list has none to sort on — the
              order falls back to seniority. Salary filters work better on a regular search
              (Bdjobs listings often include a range).
            </p>
          )}

          <div className="job-grid">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                expanded={expandedId === job.id}
                onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                bookmarked={bookmarkedIds.has(job.id)}
                onBookmark={onBookmark}
                applied={Boolean(applied[job.id])}
                onApplied={onApplied}
                levelLabel={job.seniority_label}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
