import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceIndexNav from './SpaceIndexNav';
import { CATEGORY_ORDER, DEPARTMENT_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import './Sidebar.css';

const MAIN_NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/search', label: 'Search', icon: '⌕' },
  { to: '/spaces', label: 'All spaces', icon: '▤' },
];

function isActive(pathname, to, end) {
  if (end) return pathname === to || pathname === '';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function matchCategoryId(pathname) {
  const m = pathname.match(/^\/category\/([^/]+)/);
  return m?.[1] || null;
}

function matchDepartmentId(pathname) {
  const m = pathname.match(/^\/department\/([^/]+)/);
  return m?.[1] || null;
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { pathname } = useLocation();
  const params = useParams();
  const { catalog } = useCatalog();

  const activeCategoryId = matchCategoryId(pathname) || params.categoryId;
  const activeDepartmentId = matchDepartmentId(pathname) || params.departmentId;

  const [teamsOpen, setTeamsOpen] = useState(Boolean(activeDepartmentId));
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceSort, setSpaceSort] = useState('name');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = catalog?.categories;
  const catList = CATEGORY_ORDER.filter((id) => categories?.[id]);

  const categorySpaces = useMemo(() => {
    if (!catalog || !activeCategoryId) return [];
    return catalog.spaces.filter((s) => s.category === activeCategoryId);
  }, [catalog, activeCategoryId]);

  const department = activeDepartmentId ? catalog?.departments?.[activeDepartmentId] : null;

  const allDeptSpaces = useMemo(() => {
    if (!catalog || !activeDepartmentId) return [];
    return catalog.spaces.filter((s) => s.department === activeDepartmentId);
  }, [catalog, activeDepartmentId]);

  const deptSpaces = useMemo(() => {
    if (categoryFilter === 'all') return allDeptSpaces;
    return allDeptSpaces.filter((s) => s.category === categoryFilter);
  }, [allDeptSpaces, categoryFilter]);

  const deptCategoryOptions = useMemo(() => {
    if (!catalog) return [];
    const used = new Set(allDeptSpaces.map((s) => s.category));
    return CATEGORY_ORDER.filter((id) => used.has(id) && catalog.categories?.[id]).map((id) => ({
      id,
      label: catalog.categories[id].label,
    }));
  }, [catalog, allDeptSpaces]);

  const deptList = DEPARTMENT_ORDER.filter(
    (id) => catalog?.departments?.[id] && catalog.departments[id].spaceCount > 0,
  );

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
      <nav className="sidebar-primary" aria-label="Quick links">
        {MAIN_NAV.map(({ to, label, icon, end }) => (
          <Link
            key={to}
            to={to}
            className={isActive(pathname, to, end) ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              {icon}
            </span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-section">
        <p className="sidebar-section-title">Browse by category</p>
        <ul className="sidebar-category-list">
          {catList.map((id) => {
            const cat = categories[id];
            const active = activeCategoryId === id;
            return (
              <li key={id} className={active ? 'sidebar-category-active' : ''}>
                <Link
                  to={`/category/${id}`}
                  className={`sidebar-category-link${active ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <span
                    className="sidebar-category-dot"
                    style={{ background: cat.color }}
                    aria-hidden
                  />
                  <span className="sidebar-category-label">{cat.label}</span>
                  <span className="sidebar-category-count">{cat.spaceCount}</span>
                </Link>
                {active && categorySpaces.length > 0 && (
                  <div className="sidebar-space-panel">
                    <SpaceIndexNav
                      embedded
                      spaces={categorySpaces}
                      scope={{ type: 'category', id }}
                      search={spaceSearch}
                      onSearchChange={setSpaceSearch}
                      sort={spaceSort}
                      onSortChange={setSpaceSort}
                      showOwner
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-section sidebar-section-teams">
        <p className="sidebar-section-title">Doc hygiene</p>
        <nav className="sidebar-primary sidebar-hygiene" aria-label="Doc hygiene">
          <Link
            to="/review/editors"
            className={pathname.startsWith('/review/editors') ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              ◉
            </span>
            By last editor
          </Link>
          <Link
            to="/stale"
            className={pathname === '/stale' ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              ⏱
            </span>
            Stale list
          </Link>
          <Link
            to="/review/my-pages"
            className={pathname.startsWith('/review/my-pages') ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              ✎
            </span>
            My pages
          </Link>
        </nav>
      </div>

      <div className="sidebar-section sidebar-section-teams">
        <button
          type="button"
          className="sidebar-section-toggle"
          onClick={() => setTeamsOpen((o) => !o)}
          aria-expanded={teamsOpen}
        >
          <span className="sidebar-section-title">Browse by team</span>
          <span className="sidebar-chevron" aria-hidden>
            {teamsOpen ? '▾' : '▸'}
          </span>
        </button>
        {teamsOpen && (
          <ul className="sidebar-team-list">
            {deptList.map((id) => {
              const dept = catalog.departments[id];
              const active = activeDepartmentId === id;
              return (
                <li key={id} className={active ? 'sidebar-team-active' : ''}>
                  <Link
                    to={`/department/${id}`}
                    className={`sidebar-team-link${active ? ' active' : ''}`}
                    onClick={onClose}
                  >
                    <span className="sidebar-team-label">{dept.label}</span>
                    <span className="sidebar-category-count">{dept.spaceCount}</span>
                  </Link>
                  {active && allDeptSpaces.length > 0 && (
                    <div className="sidebar-space-panel">
                      <SpaceIndexNav
                        embedded
                        spaces={deptSpaces}
                        scope={{ type: 'department', id }}
                        search={spaceSearch}
                        onSearchChange={setSpaceSearch}
                        sort={spaceSort}
                        onSortChange={setSpaceSort}
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={setCategoryFilter}
                        categoryOptions={deptCategoryOptions}
                        showOwner
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sidebar-footer">
        <Link to="/contributors" className="sidebar-muted" onClick={onClose}>
          Contributors
        </Link>
        {catalog?.meta?.totalSpaces && (
          <p className="sidebar-meta">
            {formatNumber(catalog.meta.totalSpaces)} spaces ·{' '}
            {formatNumber(catalog.meta.totalPages)} pages
          </p>
        )}
      </div>
    </aside>
  );
}
