import { useCatalog } from '../context/CatalogContext';
import CategoryCard from '../components/CategoryCard';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';

const CATEGORY_ORDER = [
  'customer-projects',
  'dno-platform',
  'engineering',
  'support-ops',
  'company-hr',
  'pmo-delivery',
  'regional',
  'partner-retired',
  'misc',
];

export default function HomePage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return null;

  const { meta, categories } = catalog;

  return (
    <>
      <header className="page-header">
        <h1>LotusFlare Confluence Catalog</h1>
        <p>
          Browse {formatNumber(meta.totalSpaces)} spaces and {formatNumber(meta.totalPages)}{' '}
          pages grouped by category, document type, and freshness. Read-only — links open in
          Confluence.
        </p>
        {meta.refreshedAt && (
          <p className="refresh-banner">
            Catalog last refreshed: <strong>{formatDate(meta.refreshedAt)}</strong>
            {meta.refreshMode === 'scheduled' && ' · updates daily via scheduled job'}
          </p>
        )}
        <div className="stat-row" style={{ marginTop: '1.25rem' }}>
          <div className="stat">
            <span className="stat-value">{formatNumber(meta.totalSpaces)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(meta.totalPages)}</span>
            <span className="stat-label">Pages</span>
          </div>
          <div className="stat">
            <span className="stat-value">{Object.keys(categories).length}</span>
            <span className="stat-label">Categories</span>
          </div>
        </div>
      </header>

      <div className="grid grid-2">
        {CATEGORY_ORDER.filter((id) => categories[id]).map((id) => (
          <CategoryCard key={id} id={id} category={categories[id]} />
        ))}
      </div>
    </>
  );
}
