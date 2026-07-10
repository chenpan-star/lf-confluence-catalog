import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import CategoryCard from '../components/CategoryCard';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/ReviewMessageModal.css';
import '../components/CategoryCard.css';

export default function HomePage() {
  const { catalog, loading, error, health } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  const { meta, categories } = catalog;
  const catList = CATEGORY_ORDER.filter((id) => categories?.[id]);

  return (
    <>
      <section className="hero hero-home hero-simple">
        <h1>LotusFlare documentation</h1>
        <p className="hero-lead">
          Find any Confluence page without logging in. Use <strong>Search</strong> at the top, or pick a
          category below — then choose a space from the left panel.
        </p>
        {meta.refreshedAt && (
          <p className="hero-meta">
            {formatNumber(meta.totalSpaces)} spaces · {formatNumber(meta.totalPages)} pages · updated{' '}
            <strong>{formatDate(meta.refreshedAt)}</strong>
          </p>
        )}
        {health && health.needsAttention > 0 && (
          <p className="hygiene-banner">
            Doc hygiene: {formatNumber(health.needsAttention)} stale pages across{' '}
            {formatNumber(
              new Set(
                health.stalePages.map((p) => p.lastEditor || p.creator).filter(Boolean),
              ).size,
            )}{' '}
            editors — <Link to="/review/editors">Review by last editor</Link>
          </p>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2 className="home-section-title">Pick a category to start</h2>
        </div>
        <div className="grid grid-2 category-grid-home">
          {catList.map((id) => (
            <CategoryCard key={id} id={id} category={categories[id]} />
          ))}
        </div>
      </section>

      <section className="home-section home-section-muted">
        <p className="home-alt-path">
          Know the space name already?{' '}
          <Link to="/spaces">Browse all spaces</Link>
          {' · '}
          <Link to="/departments">Browse by team</Link>
        </p>
      </section>
    </>
  );
}
