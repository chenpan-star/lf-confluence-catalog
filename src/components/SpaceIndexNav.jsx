import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { formatNumber } from '../lib/labels';
import { normalizeForSearch } from '../lib/text';
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
  departmentId,
  search,
  onSearchChange,
  sort,
  onSortChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
}) {
  const filtered = useMemo(
    () => filterAndSortSpaces(spaces, { search, sort }),
    [spaces, search, sort],
  );

  return (
    <aside className="space-index-nav dept-shell-nav" aria-label="Spaces in this department">
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
          {categoryOptions && onCategoryFilterChange && (
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categoryOptions.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="space-index-title">
          {formatNumber(filtered.length)} space{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ul className="space-index-list">
        {filtered.map((space) => {
          const key = space.key || space.id;

          return (
            <li key={key}>
              <NavLink
                to={`/department/${departmentId}/space/${encodeURIComponent(key)}`}
                className={({ isActive }) => `space-index-link${isActive ? ' active' : ''}`}
              >
                <span className="space-index-name">{space.name}</span>
                <span className="mono space-index-key">{key}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
