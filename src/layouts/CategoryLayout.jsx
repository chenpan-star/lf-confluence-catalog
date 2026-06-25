import { useMemo, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceIndexNav from '../components/SpaceIndexNav';
import { formatNumber } from '../lib/labels';
import '../components/SpaceBrowseSection.css';

export default function CategoryLayout() {
  const { categoryId } = useParams();
  const { catalog, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');

  const category = catalog?.categories?.[categoryId];

  const spaces = useMemo(() => {
    if (!catalog) return [];
    return catalog.spaces.filter((s) => s.category === categoryId);
  }, [catalog, categoryId]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!category) return <div className="empty">Category not found.</div>;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/categories">Categories</Link>
        <span>/</span>
        <span>{category.label}</span>
      </nav>

      <header className="page-header dept-page-header">
        <h1>{category.label}</h1>
        <p>{category.description}</p>
        <div className="stat-row dept-stat-row">
          <div className="stat">
            <span className="stat-value">{formatNumber(spaces.length)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(category.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
          {(category.staleCount || 0) > 0 && (
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--amber)' }}>
                {formatNumber(category.staleCount)}
              </span>
              <span className="stat-label">Stale pages</span>
            </div>
          )}
        </div>
      </header>

      <div className="dept-shell">
        <SpaceIndexNav
          spaces={spaces}
          scope={{ type: 'category', id: categoryId }}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          showOwner
        />
        <div className="dept-shell-main">
          <Outlet context={{ categoryId, category }} />
        </div>
      </div>
    </>
  );
}
