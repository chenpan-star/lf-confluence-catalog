import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import DepartmentCard from '../components/DepartmentCard';
import StalePageRow from '../components/StalePageRow';
import { DEPARTMENT_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';

export default function HomePage() {
  const { catalog, loading, error, health } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog || !health) return null;

  const { meta, departments } = catalog;
  const { counts } = health;
  const topStale = health.stalePages.slice(0, 8);
  const topDepts = DEPARTMENT_ORDER.filter(
    (id) => departments?.[id] && id !== 'needs-owner',
  ).slice(0, 6);

  return (
    <>
      <section className="hero card">
        <h1>LotusFlare Confluence Catalog</h1>
        <p>
          Browse {formatNumber(meta.totalSpaces)} spaces and {formatNumber(meta.totalPages)} pages.
          Find documentation by department, or review outdated content that needs cleanup.
        </p>
        <div className="hero-actions">
          <Link to="/search" className="btn btn-primary">
            Search pages
          </Link>
          <Link to="/stale" className="btn btn-warn">
            Review stale content ({formatNumber(health.needsAttention)})
          </Link>
          <Link to="/departments" className="btn btn-secondary">
            Browse departments
          </Link>
        </div>
        {meta.refreshedAt && (
          <p className="hero-meta">
            Catalog synced <strong>{formatDate(meta.refreshedAt)}</strong>
            {meta.refreshMode === 'scheduled' && ' · updates daily'}
          </p>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2>Content health</h2>
          <Link to="/stale" className="section-link">
            Full stale list →
          </Link>
        </div>
        <div className="health-summary grid grid-2">
          <div className="health-stat card health-stat-warn">
            <span className="health-stat-value">{formatNumber(counts.stale)}</span>
            <span className="health-stat-label">Stale — 1 to 2 years old</span>
          </div>
          <div className="health-stat card health-stat-danger">
            <span className="health-stat-value">{formatNumber(counts.legacy)}</span>
            <span className="health-stat-label">Legacy — over 2 years old</span>
          </div>
          <div className="health-stat card">
            <span className="health-stat-value" style={{ color: 'var(--green)' }}>
              {formatNumber(counts.active)}
            </span>
            <span className="health-stat-label">Active — updated in last 90 days</span>
          </div>
          <div className="health-stat card">
            <span className="health-stat-value">{formatNumber(counts.recent)}</span>
            <span className="health-stat-label">Recent — 3 to 12 months</span>
          </div>
        </div>
      </section>

      {topStale.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2>Oldest pages needing review</h2>
            <Link to="/stale" className="section-link">
              View all →
            </Link>
          </div>
          <ul className="stale-list-compact">
            {topStale.map((page) => (
              <StalePageRow
                key={`${page.spaceKey}-${page.id || page.url}`}
                page={page}
                compact
              />
            ))}
          </ul>
        </section>
      )}

      <section className="home-section">
        <div className="section-head">
          <h2>Departments</h2>
          <Link to="/departments" className="section-link">
            View all →
          </Link>
        </div>
        <div className="grid grid-3">
          {topDepts.map((id) => {
            const dept = departments[id];
            const dh = health.byDepartment[id];
            const staleCount = (dh?.stale || 0) + (dh?.legacy || 0);
            return (
              <DepartmentCard
                key={id}
                id={id}
                department={{ ...dept, staleCount }}
                compact
              />
            );
          })}
        </div>
      </section>
    </>
  );
}
