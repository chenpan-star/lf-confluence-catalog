import { useCatalog } from '../context/CatalogContext';
import DepartmentCard from '../components/DepartmentCard';
import CategoryCard from '../components/CategoryCard';
import { DEPARTMENT_ORDER, CATEGORY_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';
import '../components/PageTree.css';

export default function HomePage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return null;

  const { meta, departments, categories } = catalog;
  const needsOwner = departments?.['needs-owner'];

  return (
    <>
      <header className="page-header">
        <h1>LotusFlare Confluence Catalog</h1>
        <p>
          Browse {formatNumber(meta.totalSpaces)} spaces and {formatNumber(meta.totalPages)} pages
          by department, with category filters and page hierarchy. Read-only — links open in
          Confluence.
        </p>
        {meta.refreshedAt && (
          <p className="refresh-banner">
            Catalog last refreshed: <strong>{formatDate(meta.refreshedAt)}</strong>
            {meta.refreshMode === 'scheduled' && ' · updates daily via scheduled job'}
            {meta.dataSource && meta.dataSource !== 'live' && (
              <>
                {' '}
                ·{' '}
                <strong style={{ color: 'var(--warning, #d97706)' }}>
                  using cached data — run refresh for latest
                </strong>
              </>
            )}
          </p>
        )}
        <div className="stat-row" style={{ marginTop: '1.25rem' }}>
          <div className="stat">
            <span className="stat-value">{formatNumber(Object.keys(departments || {}).length)}</span>
            <span className="stat-label">Departments</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(meta.totalSpaces)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(meta.totalPages)}</span>
            <span className="stat-label">Pages</span>
          </div>
        </div>
      </header>

      <h2 className="section-heading">Departments</h2>
      <div className="grid grid-2">
        {DEPARTMENT_ORDER.filter((id) => departments?.[id] && id !== 'needs-owner').map((id) => (
          <DepartmentCard key={id} id={id} department={departments[id]} />
        ))}
      </div>

      {needsOwner && needsOwner.spaceCount > 0 && (
        <>
          <h2 className="section-heading">Needs Owner</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {formatNumber(needsOwner.spaceCount)} space(s) are not mapped to a department yet. Assign
            them in <code className="mono">scripts/config/departments.json</code>.
          </p>
          <div className="grid grid-2">
            <DepartmentCard id="needs-owner" department={needsOwner} />
          </div>
        </>
      )}

      <h2 className="section-heading">Browse by category</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Filter spaces by document domain — use alongside departments above.
      </p>
      <div className="grid grid-2">
        {CATEGORY_ORDER.filter((id) => categories[id]).map((id) => (
          <CategoryCard key={id} id={id} category={categories[id]} />
        ))}
      </div>
    </>
  );
}
