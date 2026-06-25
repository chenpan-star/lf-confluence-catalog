import { useMemo, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import { DEPARTMENT_ORDER, CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import { normalizeForSearch } from '../lib/text';
import '../components/SpaceCard.css';

export default function SpacesPage() {
  const { catalog, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const spaces = useMemo(() => {
    if (!catalog) return [];
    const q = normalizeForSearch(search);
    return catalog.spaces
      .filter((s) => deptFilter === 'all' || s.department === deptFilter)
      .filter((s) => catFilter === 'all' || s.category === catFilter)
      .filter((s) => {
        if (!q) return true;
        const hay = normalizeForSearch(`${s.name} ${s.key}`);
        return hay.includes(q);
      })
      .sort((a, b) => b.pageCount - a.pageCount);
  }, [catalog, search, deptFilter, catFilter]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;

  return (
    <>
      <header className="page-header">
        <h1>All spaces</h1>
        <p>
          {formatNumber(catalog.spaces.length)} Confluence spaces. Filter by team or topic, or type
          a space name to narrow the list.
        </p>
      </header>

      <div className="filters toolbar">
        <input
          type="search"
          placeholder="Filter by space name or key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '220px', flex: 1 }}
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="all">All departments</option>
          {DEPARTMENT_ORDER.filter((id) => catalog.departments[id]).map((id) => (
            <option key={id} value={id}>
              {catalog.departments[id].label}
            </option>
          ))}
        </select>
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
        <div className="grid grid-3">
          {spaces.map((space) => (
            <SpaceCard
              key={space.key}
              space={space}
              categoryColor={catalog.categories[space.category]?.color}
              departmentLabel={catalog.departments[space.department]?.label}
            />
          ))}
        </div>
      )}
    </>
  );
}
