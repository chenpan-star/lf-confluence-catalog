import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import CategoryCard from '../components/CategoryCard';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';
import './HomePage.css';

export default function HomePage() {
  const { catalog, loading, error, health } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  const { meta, categories } = catalog;
  const catList = CATEGORY_ORDER.filter((id) => categories?.[id]);

  return (
    <div className="page-shell home-layout">
      <section className="hero hero-home">
        <h1>LotusFlare documentation catalog</h1>
        <p className="hero-lead">
          Browse spaces by topic, or find outdated pages and remind the people who own them.
        </p>
        {meta.refreshedAt && (
          <p className="hero-meta">
            {formatNumber(meta.totalSpaces)} spaces · {formatNumber(meta.totalPages)} pages ·
            updated <strong>{formatDate(meta.refreshedAt)}</strong>
          </p>
        )}
        {health && health.needsAttention > 0 && (
          <div className="home-attention-banner">
            <div className="home-attention-text">
              <p className="home-attention-title">
                {formatNumber(health.needsAttention)} pages may need attention
              </p>
              <p className="home-attention-desc">
                Review outdated pages and send Slack reminders to editors.
              </p>
            </div>
            <Link to="/review/editors" className="btn btn-primary btn-sm home-attention-cta">
              Send reminders
            </Link>
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <h2 className="home-section-title">Browse</h2>
            <p className="section-desc">Explore documentation by topic or search the catalog.</p>
          </div>
        </div>
        <div className="home-quick-start-grid home-quick-start-grid-2">
          <Link to="/categories" className="card card-link home-quick-start-card home-quick-start-primary">
            <span className="home-quick-start-icon" aria-hidden>
              ◫
            </span>
            <h3>Browse by category</h3>
            <p>Spaces grouped by topic — pick a category, then open a space.</p>
          </Link>
          <Link to="/search" className="card card-link home-quick-start-card">
            <span className="home-quick-start-icon" aria-hidden>
              ⌕
            </span>
            <h3>Search the catalog</h3>
            <p>Find pages, spaces, or people by keyword.</p>
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <h2 className="home-section-title">Review &amp; remind</h2>
            <p className="section-desc">Find outdated pages and nudge the last editors.</p>
          </div>
        </div>
        <div className="home-quick-start-grid">
          <Link to="/review/my-pages" className="card card-link home-quick-start-card">
            <span className="home-quick-start-icon" aria-hidden>
              👤
            </span>
            <h3>Filter by name</h3>
            <p>See pages someone last edited — current and outdated.</p>
          </Link>
          <Link to="/review/editors" className="card card-link home-quick-start-card">
            <span className="home-quick-start-icon" aria-hidden>
              ✉
            </span>
            <h3>Send reminders</h3>
            <p>Outdated pages grouped by editor — confirm and remind on Slack.</p>
          </Link>
          <Link to="/stale" className="card card-link home-quick-start-card">
            <span className="home-quick-start-icon" aria-hidden>
              ⏱
            </span>
            <h3>All outdated pages</h3>
            <p>Full list not updated in over a year — filter by category or person.</p>
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <h2 className="home-section-title">Categories</h2>
            <p className="section-desc">Jump into a topic area.</p>
          </div>
          <Link to="/categories" className="section-link">
            View all →
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
          <Link to="/spaces">Browse all spaces</Link>
        </p>
      </section>
    </div>
  );
}
