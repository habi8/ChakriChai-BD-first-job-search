// Per-source attribution + degradation notice. A failed source (commonly the
// unofficial Bdjobs scraper) shows a warning chip instead of failing the page.
export default function SourceStatus({ sources }) {
  if (!sources?.length) return null;
  const failed = sources.filter((s) => !s.ok);
  return (
    <div className="source-status">
      <div className="source-chips">
        {sources.map((s) => (
          <span key={s.id} className={`source-chip ${s.ok ? 'ok' : 'fail'}`} title={s.error || ''}>
            {s.ok ? `${s.name}: ${s.count}` : `${s.name}: unavailable`}
          </span>
        ))}
      </div>
      {failed.length > 0 && (
        <p className="source-warning">
          {failed.map((s) => s.name).join(', ')}{' '}
          {failed.length === 1 ? 'is' : 'are'} currently unreachable — results below come from
          the remaining sources.
        </p>
      )}
    </div>
  );
}
