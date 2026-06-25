import { Link, useOutletContext } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import StalePageRow from '../components/StalePageRow';
import { formatNumber } from '../lib/labels';

export default function DepartmentHome() {
  const { departmentId, department } = useOutletContext();
  const { catalog, health } = useCatalog();

  const spaces = catalog?.spaces.filter((s) => s.department === departmentId) || [];

  const deptStalePages = health?.stalePages
    ?.filter((p) => p.department === departmentId)
    .slice(0, 10) || [];

  const deptHealth = health?.byDepartment?.[departmentId];
  const staleTotal = (deptHealth?.stale || 0) + (deptHealth?.legacy || 0);

  return (
    <div className="dept-home">
      <div className="dept-home-prompt card">
        <h2>Pick a space</h2>
        <p>
          Select a space from the list on the left to browse its pages. The navigator stays visible
          as you move between spaces.
        </p>
      </div>

      <div className="grid grid-3" style={{ marginTop: '1.25rem' }}>
        {spaces
          .slice()
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map((space) => (
            <SpaceCard
              key={space.key || space.id}
              space={space}
              to={`/department/${departmentId}/space/${encodeURIComponent(space.key || space.id)}`}
              categoryColor={catalog?.categories?.[space.category]?.color || department.color}
              showOwner
            />
          ))}
      </div>

      {deptStalePages.length > 0 && (
        <details className="dept-stale-details card" style={{ marginTop: '2rem' }}>
          <summary>Outdated pages needing review ({formatNumber(staleTotal)})</summary>
          <ul className="stale-list-compact" style={{ marginTop: '0.75rem' }}>
            {deptStalePages.map((page) => (
              <StalePageRow
                key={`${page.spaceKey}-${page.id || page.url}`}
                page={page}
                compact
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
