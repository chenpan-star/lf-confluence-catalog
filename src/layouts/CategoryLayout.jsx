import { Outlet, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { formatNumber } from '../lib/labels';

export default function CategoryLayout() {
  const { categoryId } = useParams();
  const { catalog, loading, error } = useCatalog();

  const category = catalog?.categories?.[categoryId];
  const spaces = catalog?.spaces.filter((s) => s.category === categoryId) || [];

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!category) return <div className="empty">Category not found.</div>;

  return (
    <>
      <header className="page-header page-header-compact">
        <h1>{category.label}</h1>
        <p>{category.description}</p>
        <div className="stat-row dept-stat-row stat-row-inline">
          <div className="stat stat-compact">
            <span className="stat-value">{formatNumber(spaces.length)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat stat-compact">
            <span className="stat-value">{formatNumber(category.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
          {(category.staleCount || 0) > 0 && (
            <div className="stat stat-compact">
              <span className="stat-value" style={{ color: 'var(--amber)' }}>
                {formatNumber(category.staleCount)}
              </span>
              <span className="stat-label">Need review</span>
            </div>
          )}
        </div>
      </header>

      <Outlet context={{ categoryId, category }} />
    </>
  );
}
