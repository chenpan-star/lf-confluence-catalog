import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import CategoryCard from '../components/CategoryCard';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';

const QUICK_START = [
  {
    to: '/categories',
    title: 'Browse by category',
    description: 'Documentation grouped by type — DNO platform, client projects, engineering, and more.',
    icon: '◫',
    primary: true,
  },
  {
    to: '/search',
    title: 'Search',
    description: 'Find a page by title, space name, or person who edited it.',
    icon: '⌕',
  },
  {
    to: '/spaces',
    title: 'All spaces',
    description: 'Full list of Confluence spaces if you know the space name.',
    icon: '▤',
  },
];

export default function HomePage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  const { meta, categories } = catalog;
  const catList = CATEGORY_ORDER.filter((id) => categories?.[id]);

  return (
    <>
      <section className="hero hero-home">
        <h1>Find LotusFlare documentation</h1>
        <p className="hero-lead">
          A simple index of {formatNumber(meta.totalSpaces)} Confluence spaces and{' '}
          {formatNumber(meta.totalPages)} pages. Browse by category, pick a space, and see who
          maintains it — no Confluence login required.
        </p>
        {meta.refreshedAt && (
          <p className="hero-meta">
            Last updated <strong>{formatDate(meta.refreshedAt)}</strong>
            {meta.refreshMode === 'scheduled' && ' · refreshes daily'}
          </p>
        )}
      </section>

      <section className="home-section">
        <h2 className="home-section-title">How do you want to start?</h2>
        <div className="quick-start-grid">
          {QUICK_START.map(({ to, title, description, icon, primary }) => (
            <Link
              key={to}
              to={to}
              className={`quick-start-card card card-link${primary ? ' quick-start-primary' : ''}`}
            >
              <span className="quick-start-icon" aria-hidden>
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2 className="home-section-title">Categories</h2>
          <Link to="/categories" className="section-link">
            View all →
          </Link>
        </div>
        <p className="section-desc">
          Layer 1 — pick a document domain, then a space. Each space has one maintainer.
        </p>
        <div className="grid grid-3">
          {catList.map((id) => (
            <CategoryCard key={id} id={id} category={categories[id]} />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2 className="home-section-title">Also browse by team</h2>
          <Link to="/departments" className="section-link">
            Departments →
          </Link>
        </div>
        <p className="section-desc">
          Optional org view — same spaces, grouped by engineering team instead of document type.
        </p>
      </section>
    </>
  );
}
