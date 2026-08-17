import { useEffect, useRef, useState } from 'react';
import { fetchCareerPage, fetchDescription, timeAgo } from '../lib/api.js';

const TIER_CLASS = { 4: 'tier-bd', 3: 'tier-open', 2: 'tier-remote', 1: 'tier-locked', 0: 'tier-other' };

// Apply buttons, company-first: prefer the employer's own channel (direct
// apply URL > company website > CV email) over the job board. Greenhouse and
// Lever links already ARE the company's hosted careers page. The original
// posting always stays reachable as a reference link.
function ApplyActions({ job, detail, careers, onCollapse }) {
  const stop = (e) => e.stopPropagation();
  const d = detail || {};
  const c = careers || {};
  // Best employer-direct target: resolved careers page > direct apply URL >
  // discovered or posted company website.
  const careerUrl = c.career_page || '';
  const companyUrl = careerUrl || d.apply_url_direct || c.company_website || d.company_website;
  const sourceLabel = SOURCE_LABEL[job.source] || job.source;
  const isCompanyHosted = job.source === 'greenhouse' || job.source === 'lever';

  let primary;
  if (companyUrl) {
    primary = (
      <a className="btn-apply" href={companyUrl} target="_blank" rel="noopener noreferrer" onClick={stop}>
        {careerUrl ? 'Apply on company careers page ↗' : 'Apply via company website ↗'}
      </a>
    );
  } else if (d.apply_email) {
    primary = (
      <a className="btn-apply" href={`mailto:${d.apply_email}?subject=${encodeURIComponent(`Application: ${job.title}`)}`} onClick={stop}>
        Email your CV ✉
      </a>
    );
  } else {
    primary = (
      <a className="btn-apply" href={job.apply_url} target="_blank" rel="noopener noreferrer" onClick={stop}>
        {isCompanyHosted ? `Apply on ${job.company}'s careers page ↗` : `Apply on ${sourceLabel} ↗`}
      </a>
    );
  }

  return (
    <div className="detail-actions">
      {primary}
      {job.source === 'bdjobs' && careers === null && (
        <span className="careers-hint">Looking for the official careers page…</span>
      )}
      {companyUrl && d.apply_email && (
        <a className="btn-ghost" href={`mailto:${d.apply_email}?subject=${encodeURIComponent(`Application: ${job.title}`)}`} onClick={stop}>
          ✉ {d.apply_email}
        </a>
      )}
      {(companyUrl || d.apply_email) && (
        <a className="btn-source-link" href={job.apply_url} target="_blank" rel="noopener noreferrer" onClick={stop}>
          View original posting on {sourceLabel} ↗
        </a>
      )}
      <button type="button" className="btn-ghost" onClick={onCollapse}>
        Collapse
      </button>
    </div>
  );
}

const SOURCE_LABEL = {
  bdjobs: 'Bdjobs.com',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  remoteok: 'Remote OK',
  arbeitnow: 'Arbeitnow',
  adzuna: 'Adzuna',
};

export default function JobCard({ job, expanded, onToggle, bookmarked, onBookmark }) {
  // detail: { html, company_website?, apply_email?, apply_url_direct? }
  const [detail, setDetail] = useState(
    job.full_description_html ? { html: job.full_description_html } : null
  );
  const [descState, setDescState] = useState('idle'); // idle | loading | error
  // null = lookup running, {} = nothing found, {career_page, company_website}
  const [careers, setCareers] = useState(job.source === 'bdjobs' ? null : {});
  const savedScrollY = useRef(null);

  // Collapsing removes a lot of page height, which would otherwise strand the
  // user near the bottom — remember where they were when they expanded and
  // put them back there on collapse.
  const handleToggle = () => {
    if (!expanded) {
      savedScrollY.current = window.scrollY;
      onToggle();
      return;
    }
    const y = savedScrollY.current;
    onToggle();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (y != null) window.scrollTo({ top: y });
      })
    );
  };

  // Lazy-load the full description (and company-direct apply channels) the
  // first time the card is expanded — only needed for sources whose search
  // payload carries just a snippet.
  useEffect(() => {
    if (!expanded || detail || !job.needs_full_description || descState === 'loading') return;
    let cancelled = false;
    setDescState('loading');
    const [source, id] = job.id.split(/:(.+)/);
    fetchDescription(source, id)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
        setDescState('idle');
      })
      .catch(() => !cancelled && setDescState('error'));
    return () => {
      cancelled = true;
    };
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // In parallel, resolve the employer's official careers page (server scans
  // the company website) — the Apply button upgrades when it lands.
  useEffect(() => {
    if (!expanded || job.source !== 'bdjobs' || careers !== null) return;
    let cancelled = false;
    const [source, id] = job.id.split(/:(.+)/);
    fetchCareerPage(source, id)
      .then((res) => !cancelled && setCareers(res || {}))
      .catch(() => !cancelled && setCareers({}));
    return () => {
      cancelled = true;
    };
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const posted = timeAgo(job.posted_date);

  return (
    <article className={`job-card ${expanded ? 'expanded' : ''}`}>
      <div
        className="card-main"
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleToggle())}
        aria-expanded={expanded}
      >
        <div className="card-top">
          <span className={`tier-badge ${TIER_CLASS[job.location_tier] || 'tier-other'}`}>
            {job.location_tier_label || (job.remote ? 'Remote' : 'On-site')}
          </span>
          <button
            type="button"
            className={`bookmark-btn ${bookmarked ? 'active' : ''}`}
            title={bookmarked ? 'Remove from saved jobs' : 'Save this job'}
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(job);
            }}
          >
            {bookmarked ? '★' : '☆'}
          </button>
        </div>
        <h3 className="job-title">{job.title}</h3>
        <div className="job-meta">
          <span className="company">{job.company}</span>
          <span className="dot">·</span>
          <span className="location">{job.location}</span>
        </div>
        <div className="job-submeta">
          {posted && <span>{posted}</span>}
          {job.job_type && <span className="chip">{job.job_type.replace('_', '-')}</span>}
          {job.salary && <span className="chip chip-salary">{job.salary}</span>}
        </div>
        {!expanded && job.snippet && <p className="snippet">{job.snippet}</p>}
        <div className="card-source">
          from <strong>{SOURCE_LABEL[job.source] || job.source}</strong>
        </div>
      </div>

      {expanded && (
        <div className="card-detail">
          {descState === 'loading' && <p className="desc-loading">Loading full description…</p>}
          {descState === 'error' && (
            <p className="desc-error">
              Couldn't load the full description from the source. You can still open the
              original posting below.
            </p>
          )}
          {detail?.html ? (
            <div className="job-description" dangerouslySetInnerHTML={{ __html: detail.html }} />
          ) : (
            descState === 'idle' && job.snippet && <p>{job.snippet}</p>
          )}
          <ApplyActions job={job} detail={detail} careers={careers} onCollapse={handleToggle} />
        </div>
      )}
    </article>
  );
}
