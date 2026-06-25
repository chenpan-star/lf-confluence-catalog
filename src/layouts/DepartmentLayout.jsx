import { Outlet, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { formatNumber } from '../lib/labels';

export default function DepartmentLayout() {
  const { departmentId } = useParams();
  const { catalog, loading, error } = useCatalog();

  const department = catalog?.departments?.[departmentId];
  const allSpaces = catalog?.spaces.filter((s) => s.department === departmentId) || [];
  const hasOwner = department?.owner?.name?.trim();

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!department) return <div className="empty">Department not found.</div>;

  return (
    <>
      <header className="page-header page-header-compact">
        <h1>{department.label}</h1>
        <p>{department.description}</p>
        <div className="stat-row dept-stat-row stat-row-inline">
          <div className="stat stat-compact">
            <span className="stat-value">{formatNumber(allSpaces.length)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat stat-compact">
            <span className="stat-value">{formatNumber(department.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
          {hasOwner && (
            <div className="stat stat-compact">
              <span className="stat-value stat-value-text">{department.owner.name}</span>
              <span className="stat-label">Team lead</span>
            </div>
          )}
        </div>
      </header>

      <Outlet context={{ departmentId, department }} />
    </>
  );
}
