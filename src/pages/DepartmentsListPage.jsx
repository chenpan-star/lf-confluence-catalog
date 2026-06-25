import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import DepartmentCard from '../components/DepartmentCard';
import { DEPARTMENT_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import '../components/CategoryCard.css';

export default function DepartmentsListPage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return null;

  const { departments } = catalog;
  const needsOwner = departments?.['needs-owner'];

  return (
    <>
      <header className="page-header">
        <h1>Departments</h1>
        <p>
          Documentation grouped by team. Each department contains Confluence spaces; pages inherit
          their space&apos;s department.
        </p>
      </header>

      <div className="grid grid-2">
        {DEPARTMENT_ORDER.filter((id) => departments?.[id] && id !== 'needs-owner').map((id) => (
          <DepartmentCard key={id} id={id} department={departments[id]} />
        ))}
      </div>

      {needsOwner && needsOwner.spaceCount > 0 && (
        <section className="home-section">
          <h2 className="section-heading">Needs assignment</h2>
          <p className="section-desc">
            {formatNumber(needsOwner.spaceCount)} space(s) not yet mapped to a department.
          </p>
          <div className="grid grid-2">
            <DepartmentCard id="needs-owner" department={needsOwner} />
          </div>
        </section>
      )}
    </>
  );
}
