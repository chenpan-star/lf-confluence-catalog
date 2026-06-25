import { useMemo, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceIndexNav from '../components/SpaceIndexNav';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import '../components/SpaceBrowseSection.css';

export default function DepartmentLayout() {
  const { departmentId } = useParams();
  const { catalog, loading, error } = useCatalog();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');

  const department = catalog?.departments?.[departmentId];

  const allSpaces = useMemo(() => {
    if (!catalog) return [];
    return catalog.spaces.filter((s) => s.department === departmentId);
  }, [catalog, departmentId]);

  const spaces = useMemo(() => {
    if (categoryFilter === 'all') return allSpaces;
    return allSpaces.filter((s) => s.category === categoryFilter);
  }, [allSpaces, categoryFilter]);

  const categoryOptions = useMemo(() => {
    if (!catalog) return [];
    const used = new Set(allSpaces.map((s) => s.category));
    return CATEGORY_ORDER.filter((id) => used.has(id) && catalog.categories?.[id]).map((id) => ({
      id,
      label: catalog.categories[id].label,
    }));
  }, [catalog, allSpaces]);

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

      <header className="page-header dept-page-header">
        <h1>{department.label}</h1>
        <p>{department.description}</p>
        <div className="stat-row dept-stat-row">
          <div className="stat">
            <span className="stat-value">{formatNumber(allSpaces.length)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(department.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
          {hasOwner && (
            <div className="stat dept-owner-stat">
              <span className="stat-value stat-value-text">{department.owner.name}</span>
              <span className="stat-label">Department owner</span>
            </div>
          )}
        </div>
      </header>

      <div className="dept-shell">
        <SpaceIndexNav
          spaces={spaces}
          scope={{ type: 'department', id: departmentId }}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categoryOptions={categoryOptions}
          showOwner
        />
        <div className="dept-shell-main">
          <Outlet context={{ departmentId, department }} />
        </div>
      </div>
    </>
  );
}
