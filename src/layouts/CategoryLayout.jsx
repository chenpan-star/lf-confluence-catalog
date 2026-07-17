import { Outlet, useMatch, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { CATEGORY_INTRO } from '../lib/categoryMeta';
import { formatNumber } from '../lib/labels';
import './CategoryLayout.css';

export default function CategoryLayout() {
  const { categoryId } = useParams();
  const { catalog, loading, error } = useCatalog();

  const category = catalog?.categories?.[categoryId];
  const spaces = catalog?.spaces.filter((s) => s.category === categoryId) || [];
  const intro = CATEGORY_INTRO[categoryId];
  const isSpaceRoute = Boolean(useMatch('/category/:categoryId/space/:spaceKey'));

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!category) return <div className="empty">Category not found.</div>;

  if (isSpaceRoute) {
    return (
      <div className="page-shell category-layout-space">
        <Outlet context={{ categoryId, category }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="category-layout-header">
        <div className="category-layout-header-top">
          <span
            className="category-layout-accent"
            style={{ background: category.color }}
            aria-hidden
          />
          <div className="category-layout-heading">
            <h1>{category.label}</h1>
            <p className="category-layout-tagline">
              {intro?.summary || category.description}
            </p>
            <ul className="category-layout-meta" aria-label="Category summary">
              <li>
                <span className="category-layout-meta-value">{formatNumber(spaces.length)}</span>
                <span className="category-layout-meta-label">spaces</span>
              </li>
              <li>
                <span className="category-layout-meta-value">{formatNumber(category.pageCount)}</span>
                <span className="category-layout-meta-label">pages</span>
              </li>
              <li
                className={
                  (category.staleCount || 0) > 0 ? 'category-layout-meta-warn' : undefined
                }
              >
                <span className="category-layout-meta-value">
                  {formatNumber(category.staleCount || 0)}
                </span>
                <span className="category-layout-meta-label">need review</span>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <Outlet context={{ categoryId, category }} />
    </div>
  );
}
