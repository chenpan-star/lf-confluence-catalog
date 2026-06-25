import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import DepartmentCard from '../components/DepartmentCard';
import { DEPARTMENT_ORDER } from '../lib/departments';
import '../components/CategoryCard.css';

export default function DepartmentsListPage() {
  const { catalog, loading, error, health } = useCatalog();

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  const { departments } = catalog;

  return (
    <>
      <header className="page-header">
        <h1>Departments</h1>
        <p>
          Pick your team to browse its Confluence spaces. Every page belongs to a space, and each
          space is assigned to one department.
        </p>
      </header>

      <div className="grid grid-2">
        {DEPARTMENT_ORDER.filter((id) => departments?.[id]).map((id) => {
          const dh = health?.byDepartment?.[id];
          const staleCount = (dh?.stale || 0) + (dh?.legacy || 0);
          return (
            <DepartmentCard
              key={id}
              id={id}
              department={{ ...departments[id], staleCount }}
              hideStale={id === 'needs-owner'}
            />
          );
        })}
      </div>
    </>
  );
}
