import { useEffect, useMemo, useRef, useState } from 'react';

// Multi-select dropdown with clickable items (no checkboxes). Accepts either a
// flat options array or grouped options: [{ label, options: [...] }].
// A type-to-filter box appears automatically for long lists.
export default function MultiSelect({ label, options = [], groups = null, values, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const allGroups = useMemo(
    () => (groups && groups.length ? groups : [{ label: '', options }]),
    [groups, options]
  );
  const totalOptions = useMemo(
    () => allGroups.reduce((n, g) => n + g.options.length, 0),
    [allGroups]
  );

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const toggle = (opt) => {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  };

  const q = query.trim().toLowerCase();
  const visibleGroups = allGroups
    .map((g) => ({ ...g, options: q ? g.options.filter((o) => o.toLowerCase().includes(q)) : g.options }))
    .filter((g) => g.options.length);

  const summary =
    values.length === 0
      ? `Any ${label.toLowerCase()}`
      : values.length <= 2
        ? values.join(', ')
        : `${values[0]} +${values.length - 1} more`;

  return (
    <div className="multiselect" ref={ref}>
      <button
        type="button"
        className={`ms-trigger ${values.length ? 'has-value' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="ms-summary">{summary}</span>
        <span className="ms-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="ms-panel" role="listbox" aria-label={label} aria-multiselectable="true">
          {totalOptions > 8 && (
            <input
              className="ms-filter"
              type="text"
              placeholder={`Filter ${label.toLowerCase()}s…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}

          <div className="ms-scroll">
            {visibleGroups.length === 0 && <div className="ms-empty">No match for “{query}”</div>}
            {visibleGroups.map((g, gi) => (
              <div key={g.label || gi} className="ms-group">
                {g.label && <div className="ms-group-label">{g.label}</div>}
                {g.options.map((opt) => {
                  const selected = values.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`ms-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggle(opt)}
                    >
                      <span className="ms-item-text">{opt}</span>
                      {selected && <span className="ms-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="ms-footer">
            <span className="ms-count">{values.length ? `${values.length} selected` : ''}</span>
            <div className="ms-footer-btns">
              {values.length > 0 && (
                <button type="button" className="btn-link" onClick={() => onChange([])}>
                  Clear
                </button>
              )}
              <button type="button" className="ms-done" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
