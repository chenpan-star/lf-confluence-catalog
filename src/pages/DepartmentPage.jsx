import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import '../components/SpaceCard.css';

export default function DepartmentPage() {
  const { departmentId } = useParams();
  const { catalog, loading, error } = useCatalog();
  const [categoryFilter, setCategoryFilter] = useState('all');

  const department = catalog?.departments?.[departmentId];

  const spaces = useMemo(() => {
    if (!catalog) return [];
    return catalog.spaces
      .filter((s) => s.department === departmentId)
      .filter((s) => categoryFilter === 'all' || s.category === categoryFilter)
      .sort((a, b) => b.pageCount - a.pageCount);
  }, [catalog, departmentId, categoryFilter]);

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

        <div className="owner-card card" style={{ marginTop: '1rem', maxWidth: '480px' }}>
          <h2 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Department owner
          </h2>
          {hasOwner ? (
            <p>
              <strong>{department.owner.name}</strong>
              {department.owner.email && (
                <>
                  {' '}
                  ·{' '}
                  <a href={`mailto:${department.owner.email}`}>{department.owner.email}</a>
                </>
              )}
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>
              Not assigned yet — edit <code className="mono">scripts/config/departments.json</code>
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
        </div>
      </header>

      <div className="filters" style={{ marginBottom: '1.5rem' }}>
        <label>
          Filter by category{' '}
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
    </>
  );
}
