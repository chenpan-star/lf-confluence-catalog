import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SpaceCard from './SpaceCard';
import { formatNumber } from '../lib/labels';
import { normalizeForSearch } from '../lib/text';
import './SpaceBrowseSection.css';

function spaceAnchorId(key) {
  return `space-${String(key || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function resolveCategoryColor(categoryColor, space) {
  if (typeof categoryColor === 'function') return categoryColor(space);
  return categoryColor;
}

export default function SpaceBrowseSection({
  spaces,
  categoryColor,
  departmentLabel,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  emptyMessage = 'No spaces match your filters.',
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');

  const filtered = useMemo(() => {
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
  }, [spaces, search, sort]);

  return (
    <section className="space-browse" aria-label="Spaces">
      <div className="space-browse-toolbar toolbar">
        <input
          type="search"
          className="filter-search"
          placeholder="Filter spaces by name or key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter spaces"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort spaces">
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
        <span className="space-browse-count">
          {formatNumber(filtered.length)} space{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{emptyMessage}</div>
      ) : (
        <div className="space-browse-layout">
          <nav className="space-index-nav" aria-label="Jump to space">
            <p className="space-index-title">All spaces</p>
            <ul className="space-index-list">
              {filtered.map((space) => {
                const key = space.key || space.id;
                return (
                  <li key={key}>
                    <a href={`#${spaceAnchorId(key)}`} className="space-index-link">
                      <span className="space-index-name">{space.name}</span>
                      <span className="mono space-index-key">{key}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="space-browse-main">
            <div className="grid grid-3 space-card-grid">
              {filtered.map((space) => {
                const key = space.key || space.id;
                return (
                  <div key={key} id={spaceAnchorId(key)} className="space-card-anchor">
                    <SpaceCard
                      space={space}
                      categoryColor={resolveCategoryColor(categoryColor, space)}
                      departmentLabel={departmentLabel?.(space)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
