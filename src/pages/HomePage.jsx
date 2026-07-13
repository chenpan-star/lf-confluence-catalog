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
    <div className="home-layout">
      <section className="hero hero-home">
        <h1>LotusFlare documentation</h1>
        <p className="hero-lead">
          Browse by <strong>category</strong> or search by page, space, or person. Use{' '}
          <strong>Review by person</strong> to find outdated pages and send reminders to last editors.
        </p>
        {meta.refreshedAt && (
          <p className="hero-meta">
            {formatNumber(meta.totalSpaces)} spaces · {formatNumber(meta.totalPages)} pages · updated{' '}
            <strong>{formatDate(meta.refreshedAt)}</strong>
          </p>
        )}
        {health && health.needsAttention > 0 && (
          <div className="hygiene-banner">
            <p className="hygiene-banner-title">
              {formatNumber(health.needsAttention)} pages may be outdated
            </p>
            <p>
              Send a friendly reminder to the people who last edited them —{' '}
              <Link to="/review/editors">Start here</Link>
            </p>
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <h2 className="home-section-title">Review by person</h2>
            <p className="section-desc">
              Find outdated pages by last editor — search anyone by name or send reminders in bulk.
            </p>
          </div>
        </div>
        <div className="quick-start-grid">
          <Link to="/review/editors" className="card card-link quick-start-card quick-start-primary">
            <span className="quick-start-icon" aria-hidden>
              ✉
            </span>
            <h3>Send reminders</h3>
            <p>
              Pages grouped by last editor — copy a Slack message and nudge people to update or
              archive outdated docs.
            </p>
          </Link>
          <Link to="/review/my-pages" className="card card-link quick-start-card">
            <span className="quick-start-icon" aria-hidden>
              ⌕
            </span>
            <h3>Filter by name</h3>
            <p>Search any person by Confluence name, Slack handle, or email to see their pages.</p>
          </Link>
          <Link to="/stale" className="card card-link quick-start-card">
            <span className="quick-start-icon" aria-hidden>
              ⏱
            </span>
            <h3>All outdated pages</h3>
            <p>
              Full list of pages not updated in over a year — filter by category, space, or person.
            </p>
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <h2 className="home-section-title">Browse by category</h2>
            <p className="section-desc">Pick a topic area — spaces appear in the left panel.</p>
          </div>
          <Link to="/categories" className="section-link">
            View all categories →
          </Link>
        </div>
        <div className="grid grid-2 category-grid-home">
          {catList.map((id) => (
            <CategoryCard key={id} id={id} category={categories[id]} />
          ))}
        </div>
      </section>

      <section className="home-section home-section-muted">
        <p className="home-alt-path">
          Know the space name already? <Link to="/spaces">Browse all spaces</Link>
          {' · '}
          <Link to="/search">Search the catalog</Link>
        </p>
      </section>
    </div>
  );
}
