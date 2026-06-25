import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import StalePageRow from '../components/StalePageRow';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import '../components/SpaceCard.css';

export default function DepartmentPage() {
  const { departmentId } = useParams();
  const { catalog, loading, error, health } = useCatalog();
  const [categoryFilter, setCategoryFilter] = useState('all');

  const department = catalog?.departments?.[departmentId];

  const spaces = useMemo(() => {
    if (!catalog) return [];
    return catalog.spaces
      .filter((s) => s.department === departmentId)
      .filter((s) => categoryFilter === 'all' || s.category === categoryFilter)
      .sort((a, b) => b.pageCount - a.pageCount);
  }, [catalog, departmentId, categoryFilter]);

  const deptStalePages = useMemo(() => {
    if (!health) return [];
    return health.stalePages
      .filter((p) => p.department === departmentId)
      .slice(0, 15);
  }, [health, departmentId]);

  const deptHealth = health?.byDepartment?.[departmentId];
  const staleTotal = (deptHealth?.stale || 0) + (deptHealth?.legacy || 0);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!department) return <div className="empty">Department not found.</div>;

  const hasOwner = department.owner?.name?.trim();

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/departments">Departments</Link>
        <span>/</span>
        <span>{department.label}</span>
      </nav>

      <header className="page-header">
        <h1>{department.label}</h1>
        <p>{department.description}</p>

        <div className="owner-card card" style={{ marginTop: '1rem', maxWidth: '520px' }}>
          <h2 className="owner-card-title">Department owner</h2>
          {hasOwner ? (
            <p>
              <strong>{department.owner.name}</strong> is responsible for documentation in this
              department.
              {department.owner.email && (
                <>
                  {' '}
                  <a href={`mailto:${department.owner.email}`}>{department.owner.email}</a>
                </>
              )}
            </p>
          ) : (
            <p className="owner-empty">
              No owner assigned yet. Add one in{' '}
              <code className="mono">scripts/config/departments.json</code> so someone can drive
              content cleanup.
            </p>
          )}
        </div>

        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <div className="stat">
            <span className="stat-value">{formatNumber(spaces.length)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(department.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
          {staleTotal > 0 && (
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--amber)' }}>
                {formatNumber(staleTotal)}
              </span>
              <span className="stat-label">Need review</span>
            </div>
          )}
        </div>
      </header>

      {deptStalePages.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <h2>Stale pages in this department</h2>
            <Link to={`/stale?department=${departmentId}`} className="section-link">
              View all {formatNumber(staleTotal)} →
            </Link>
          </div>
          <p className="section-desc">
            Email the last editor to request an update, archive, or deletion.
          </p>
          <ul className="stale-list-compact">
            {deptStalePages.map((page) => (
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
          <h2>Spaces</h2>
        </div>

        <div className="filters toolbar" style={{ marginBottom: '1rem' }}>
          <label>
            Category{' '}
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORY_ORDER.filter((id) => catalog.categories[id]).map((id) => (
                <option key={id} value={id}>
                  {catalog.categories[id].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {spaces.length === 0 ? (
          <div className="empty">No spaces match this filter.</div>
        ) : (
          <div className="grid grid-3">
            {spaces.map((space) => (
              <SpaceCard
                key={space.key || space.id}
                space={space}
                categoryColor={catalog.categories[space.category]?.color || department.color}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
