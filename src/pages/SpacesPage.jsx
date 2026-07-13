import { useMemo, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import { normalizeForSearch } from '../lib/text';
import '../components/SpaceCard.css';

export default function SpacesPage() {
  const { catalog, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const spaces = useMemo(() => {
    if (!catalog) return [];
    const q = normalizeForSearch(search);
    return catalog.spaces
      .filter((s) => catFilter === 'all' || s.category === catFilter)
      .filter((s) => {
        if (!q) return true;
        const hay = normalizeForSearch(`${s.name} ${s.key} ${s.owner?.name || ''}`);
        return hay.includes(q);
      })
      .sort((a, b) => b.pageCount - a.pageCount);
  }, [catalog, search, catFilter]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const space of spaces) {
      const catId = space.category || 'misc';
      if (!groups.has(catId)) groups.set(catId, []);
      groups.get(catId).push(space);
    }
    const ordered = [];
    for (const id of CATEGORY_ORDER) {
      if (groups.has(id)) ordered.push({ categoryId: id, spaces: groups.get(id) });
    }
    for (const [id, list] of groups) {
      if (!CATEGORY_ORDER.includes(id)) ordered.push({ categoryId: id, spaces: list });
    }
    return ordered;
  }, [spaces]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;

  return (
    <>
      <header className="page-header">
        <h1>All spaces</h1>
        <p>
          {formatNumber(catalog.spaces.length)} Confluence spaces grouped by category. Filter by topic
          or type a space name to narrow the list.
        </p>
      </header>

      <div className="filters toolbar">
        <input
          type="search"
          placeholder="Filter by space name or key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-search"
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORY_ORDER.filter((id) => catalog.categories[id]).map((id) => (
            <option key={id} value={id}>
              {catalog.categories[id].label}
            </option>
          ))}
        </select>
      </div>

      <p className="result-count">
        Showing {formatNumber(spaces.length)} space{spaces.length !== 1 ? 's' : ''}
      </p>

      {spaces.length === 0 ? (
        <div className="empty">No spaces match your filters.</div>
      ) : (
        <div className="spaces-grouped">
          {grouped.map(({ categoryId, spaces: catSpaces }) => {
            const cat = catalog.categories[categoryId];
            return (
              <section key={categoryId} className="spaces-category-section">
                <header className="spaces-category-header">
                  {cat && (
                    <span
                      className="sidebar-category-dot"
                      style={{ background: cat.color }}
                      aria-hidden
                    />
                  )}
                  <h2>{cat?.label || categoryId}</h2>
                  <span className="spaces-category-count">
                    {formatNumber(catSpaces.length)} space{catSpaces.length !== 1 ? 's' : ''}
                  </span>
                </header>
                <div className="grid grid-3">
                  {catSpaces.map((space) => (
                    <SpaceCard
                      key={space.key}
                      space={space}
                      categoryColor={cat?.color}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
