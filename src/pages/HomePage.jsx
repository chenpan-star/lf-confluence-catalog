import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import DepartmentCard from '../components/DepartmentCard';
import { DEPARTMENT_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';

const QUICK_START = [
  {
    to: '/search',
    title: 'Search',
    description: 'Find a page by title, space name, or person who edited it.',
    icon: '⌕',
    primary: true,
  },
  {
    to: '/departments',
    title: 'Browse by team',
    description: 'Documentation grouped by department — the easiest way to explore.',
    icon: '▦',
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

  const { meta, departments } = catalog;
  const deptList = DEPARTMENT_ORDER.filter(
    (id) => departments?.[id] && id !== 'needs-owner',
  );

  return (
    <>
      <section className="hero hero-home">
        <h1>Find LotusFlare documentation</h1>
        <p className="hero-lead">
          A simple index of {formatNumber(meta.totalSpaces)} Confluence spaces and{' '}
          {formatNumber(meta.totalPages)} pages. Use search or pick your team below — no Confluence
          login required to browse here.
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
          <h2 className="home-section-title">Teams &amp; departments</h2>
          <Link to="/departments" className="section-link">
            View all →
          </Link>
        </div>
        <p className="section-desc">
          Pick your department to see its Confluence spaces and pages.
        </p>
        <div className="grid grid-3">
          {deptList.map((id) => (
            <DepartmentCard
              key={id}
              id={id}
              department={departments[id]}
              compact
              hideStale
            />
          ))}
        </div>
      </section>
    </>
  );
}
