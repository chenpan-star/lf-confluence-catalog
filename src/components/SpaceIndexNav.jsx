import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { formatNumber } from '../lib/labels';
import { normalizeForSearch } from '../lib/text';
import { spaceScopePath } from '../lib/spacePaths';
import './SpaceBrowseSection.css';

export function filterAndSortSpaces(spaces, { search, sort }) {
  let list = [...spaces];
  const q = normalizeForSearch(search);
  if (q) {
    list = list.filter((s) => normalizeForSearch(`${s.name} ${s.key}`).includes(q));
  }
  if (sort === 'pages') {
    list.sort((a, b) => b.pageCount - a.pageCount || (a.name || '').localeCompare(b.name || ''));
  } else {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }
  return list;
}

export default function SpaceIndexNav({
  spaces,
  scope,
  search,
  onSearchChange,
  sort,
  onSortChange,
  embedded = false,
}) {
  const filtered = useMemo(
    () => filterAndSortSpaces(spaces, { search, sort }),
    [spaces, search, sort],
  );

  const rootClass = embedded ? 'space-index-embedded' : 'space-index-nav';

  return (
    <div className={rootClass} aria-label="Spaces in this category">
      <div className="space-nav-toolbar">
        <input
          type="search"
          className="space-nav-search"
          placeholder="Filter spaces…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Filter spaces"
        />
        <div className="space-nav-controls">
          <select value={sort} onChange={(e) => onSortChange(e.target.value)} aria-label="Sort spaces">
            <option value="name">A → Z</option>
            <option value="pages">Most pages</option>
          </select>
        </div>
        <p className="space-index-title">
          {formatNumber(filtered.length)} space{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ul className="space-index-list">
        {filtered.map((space) => {
          const key = space.key || space.id;
          const to = scope ? spaceScopePath(scope, key) : `/space/${encodeURIComponent(key)}`;

          return (
            <li key={key}>
              <NavLink
                to={to}
                className={({ isActive }) => `space-index-link${isActive ? ' active' : ''}`}
              >
                <span className="space-index-name">{space.name}</span>
                <span className="mono space-index-key">{key}</span>
                {(space.staleCount || 0) > 0 && (
                  <span className="space-index-stale">{space.staleCount} need review</span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="space-index-empty">
          <p>
            No spaces match{search.trim() ? ` “${search.trim()}”` : ''}.
          </p>
          {search.trim() && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSearchChange('')}>
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
