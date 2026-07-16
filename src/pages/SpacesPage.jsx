import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import Pagination, { PaginationBar } from '../components/Pagination';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import {
  applyListPage,
  clearListPage,
  computePagination,
  readListPage,
  scrollToTop,
  slicePage,
  PAGE_SIZE,
} from '../lib/pagination';
import { normalizeForSearch } from '../lib/text';
import '../components/SpaceCard.css';

export default function SpacesPage() {
  const { catalog, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const catFilter = searchParams.get('category') || 'all';

  const spaces = useMemo(() => {
    if (!catalog) return [];
    const q = normalizeForSearch(search);
    return catalog.spaces
      .filter((s) => catFilter === 'all' || s.category === catFilter)
      .filter((s) => {
        if (!q) return true;
        const hay = normalizeForSearch(`${s.name} ${s.key}`);
        return hay.includes(q);
      })
      .sort((a, b) => b.pageCount - a.pageCount);
  }, [catalog, search, catFilter]);

  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(spaces.length, listPage, PAGE_SIZE);
  const pagedSpaces = useMemo(
    () => slicePage(spaces, safePage, PAGE_SIZE),
    [spaces, safePage],
  );

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const space of pagedSpaces) {
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
  }, [pagedSpaces]);

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
    scrollToTop();
  }

  function updateFilters(nextQ, nextCategory) {
    const next = clearListPage(new URLSearchParams(searchParams));
    if (nextQ.trim()) next.set('q', nextQ.trim());
    else next.delete('q');
    if (nextCategory && nextCategory !== 'all') next.set('category', nextCategory);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  }

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
          onChange={(e) => updateFilters(e.target.value, catFilter)}
          className="filter-search"
        />
        <select
          value={catFilter}
          onChange={(e) => updateFilters(search, e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORY_ORDER.filter((id) => catalog.categories[id]).map((id) => (
            <option key={id} value={id}>
              {catalog.categories[id].label}
            </option>
          ))}
        </select>
      </div>

      <p className="result-count">
        {formatNumber(spaces.length)} space{spaces.length !== 1 ? 's' : ''} match
      </p>

      {spaces.length === 0 ? (
        <div className="empty">No spaces match your filters.</div>
      ) : (
        <>
          <PaginationBar
            page={safePage}
            pageSize={PAGE_SIZE}
            total={spaces.length}
            onPageChange={setListPage}
            itemLabel={spaces.length === 1 ? 'space' : 'spaces'}
          >
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
          </PaginationBar>
        </>
      )}
    </>
  );
}
