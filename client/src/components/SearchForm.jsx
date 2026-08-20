import { useMemo } from 'react';
import MultiSelect from './MultiSelect.jsx';

// Fallbacks while GET /api/filters loads (server list includes all Bdjobs
// categories/designations and is the source of truth).
export const DEFAULT_FIELD_GROUPS = [
  { label: '', options: ['CSE', 'EEE', 'IT', 'Data Analysis', 'Economics', 'Other'] },
];
export const DEFAULT_ROLE_GROUPS = [{ label: '', options: ['Other'] }];
export const DEFAULT_LEVEL_OPTIONS = ['Entry', 'Mid', 'Top'];
export const DEFAULT_LOCATION_GROUPS = [
  { label: '', options: ['Remote'] },
  { label: 'Districts', options: ['Dhaka', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh'] },
];

export const EMPTY_FILTERS = {
  fields: [],
  fieldOther: '',
  roles: [],
  roleOther: '',
  levels: [],
  locations: [],
  experience: '',
  jobType: '',
  keywords: '',
  salaryMin: '',
  salaryMax: '',
};

export default function SearchForm({
  filters,
  onChange,
  onSearch,
  loading,
  fieldGroups,
  roleGroups,
  levelOptions,
  fieldRoles,
  locationGroups,
  showApplied,
  onToggleShowApplied,
  appliedCount,
}) {
  const set = (patch) => onChange({ ...filters, ...patch });

  // The Role dropdown adapts to the selected fields: a "Suggested" group of
  // field-specific roles comes first, the full catalog stays below it.
  const dynamicRoleGroups = useMemo(() => {
    const base = roleGroups || DEFAULT_ROLE_GROUPS;
    const selected = (filters.fields || []).filter((f) => f !== 'Other');
    const suggested = [...new Set(selected.flatMap((f) => fieldRoles?.[f] || []))];
    if (!suggested.length) return base;
    const inSuggested = new Set(suggested);
    const rest = base
      .map((g) => ({ ...g, options: g.options.filter((o) => !inSuggested.has(o)) }))
      .filter((g) => g.options.length);
    return [{ label: 'Suggested for your fields', options: suggested }, ...rest];
  }, [filters.fields, roleGroups, fieldRoles]);

  // When fields change, drop selected roles that are no longer offered.
  const setFields = (fields) => {
    const selected = fields.filter((f) => f !== 'Other');
    const suggested = new Set(selected.flatMap((f) => fieldRoles?.[f] || []));
    const catalog = new Set((roleGroups || DEFAULT_ROLE_GROUPS).flatMap((g) => g.options));
    const roles = (filters.roles || []).filter((r) => catalog.has(r) || suggested.has(r));
    set({ fields, roles });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!loading) onSearch();
  };

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="form-field">
          <label>Field / Department</label>
          <MultiSelect
            label="field"
            groups={fieldGroups || DEFAULT_FIELD_GROUPS}
            values={filters.fields}
            onChange={setFields}
          />
          {filters.fields.includes('Other') && (
            <input
              type="text"
              placeholder="Type your field, e.g. Pharmacy"
              value={filters.fieldOther}
              onChange={(e) => set({ fieldOther: e.target.value })}
            />
          )}
        </div>

        <div className="form-field">
          <label>Role</label>
          <MultiSelect
            label="role"
            groups={dynamicRoleGroups}
            values={filters.roles}
            onChange={(roles) => set({ roles })}
          />
          {filters.roles.includes('Other') && (
            <input
              type="text"
              placeholder="Type a role, e.g. DevOps Engineer"
              value={filters.roleOther}
              onChange={(e) => set({ roleOther: e.target.value })}
            />
          )}
        </div>

        <div className="form-field">
          <label>Level</label>
          <MultiSelect
            label="level"
            options={levelOptions || DEFAULT_LEVEL_OPTIONS}
            values={filters.levels || []}
            onChange={(levels) => set({ levels })}
          />
        </div>

        <div className="form-field">
          <label>Location</label>
          <MultiSelect
            label="location"
            groups={locationGroups || DEFAULT_LOCATION_GROUPS}
            values={filters.locations || []}
            onChange={(locations) => set({ locations })}
          />
        </div>

        <div className="form-field">
          <label>Experience</label>
          <select value={filters.experience} onChange={(e) => set({ experience: e.target.value })}>
            <option value="">Any experience</option>
            <option value="0-1">0–1 years</option>
            <option value="1-3">1–3 years</option>
            <option value="3-5">3–5 years</option>
            <option value="5+">5+ years</option>
          </select>
        </div>

        <div className="form-field">
          <label>Job type</label>
          <select value={filters.jobType} onChange={(e) => set({ jobType: e.target.value })}>
            <option value="">Any type</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </div>

        <div className="form-field">
          <label>Keywords</label>
          <input
            type="text"
            placeholder="e.g. react, sql, remote"
            value={filters.keywords}
            onChange={(e) => set({ keywords: e.target.value })}
          />
        </div>

        <div className="form-field salary-field">
          <label>Salary range (optional, any currency)</label>
          <div className="salary-inputs">
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={filters.salaryMin}
              onChange={(e) => set({ salaryMin: e.target.value })}
            />
            <span>–</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              value={filters.salaryMax}
              onChange={(e) => set({ salaryMax: e.target.value })}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search jobs'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={loading}
            onClick={() => onChange({ ...EMPTY_FILTERS })}
          >
            Clear
          </button>
          {/* View toggle, not a search filter — hides applied jobs from the
              results already on screen without re-running the search. */}
          <button
            type="button"
            role="switch"
            aria-checked={showApplied}
            className={`toggle-applied ${showApplied ? 'on' : ''}`}
            onClick={() => onToggleShowApplied(!showApplied)}
            title={showApplied ? 'Hide jobs you have applied to' : 'Show jobs you have applied to'}
          >
            <span className="toggle-track">
              <span className="toggle-knob" />
            </span>
            <span>Show applied{appliedCount ? ` (${appliedCount})` : ''}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
