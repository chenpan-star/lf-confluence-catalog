import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { useTheme } from '../context/ThemeContext';
import SpaceIndexNav from './SpaceIndexNav';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import './Sidebar.css';

const MAIN_NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/search', label: 'Search', icon: '⌕' },
];

const REVIEW_NAV = [
  { to: '/review/editors', label: 'Send reminders', icon: '✉', match: '/review/editors' },
  { to: '/review/my-pages', label: 'Filter by name', icon: '👤', match: '/review/my-pages' },
  { to: '/stale', label: 'Outdated pages', icon: '⏱', match: '/stale' },
];

function isActive(pathname, to, end) {
  if (end) return pathname === to || pathname === '';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function matchCategoryId(pathname) {
  const m = pathname.match(/^\/category\/([^/]+)/);
  return m?.[1] || null;
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { catalog } = useCatalog();
  const { theme, setTheme, themes } = useTheme();

  const routeCategoryId = matchCategoryId(pathname) || params.categoryId || null;
  const [expandedCategoryId, setExpandedCategoryId] = useState(routeCategoryId);

  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceSort, setSpaceSort] = useState('name');

  useEffect(() => {
    setExpandedCategoryId(routeCategoryId);
  }, [routeCategoryId]);

  const categories = catalog?.categories;
  const catList = CATEGORY_ORDER.filter((id) => categories?.[id]);

  const expandedSpaces = useMemo(() => {
    if (!catalog || !expandedCategoryId) return [];
    return catalog.spaces.filter((s) => s.category === expandedCategoryId);
  }, [catalog, expandedCategoryId]);

  function handleCategoryClick(e, id) {
    if (expandedCategoryId === id) {
      e.preventDefault();
      setExpandedCategoryId(null);
      if (pathname.startsWith(`/category/${id}`)) {
        navigate('/');
      }
      return;
    }
    setExpandedCategoryId(id);
    onClose();
  }

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <p className="sidebar-brand-label">Navigate</p>
        <p className="sidebar-brand-hint">Browse by topic or review by person</p>
      </div>

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
            const expanded = expandedCategoryId === id;
            return (
              <li key={id} className={expanded ? 'sidebar-category-active' : ''}>
                <Link
                  to={`/category/${id}`}
                  className={`sidebar-category-link${expanded ? ' active' : ''}`}
                  onClick={(e) => handleCategoryClick(e, id)}
                  aria-expanded={expanded}
                >
                  <span
                    className="sidebar-category-dot"
                    style={{ background: cat.color }}
                    aria-hidden
                  />
                  <span className="sidebar-category-label">{cat.label}</span>
                  <span className="sidebar-category-count">{cat.spaceCount}</span>
                  <span className="sidebar-category-chevron" aria-hidden>
                    {expanded ? '▼' : '▶'}
                  </span>
                </Link>
                {expanded && expandedSpaces.length > 0 && (
                  <div className="sidebar-space-panel">
                    <SpaceIndexNav
                      embedded
                      spaces={expandedSpaces}
                      scope={{ type: 'category', id }}
                      search={spaceSearch}
                      onSearchChange={setSpaceSearch}
                      sort={spaceSort}
                      onSortChange={setSpaceSort}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-section-title">Review by person</p>
        <nav className="sidebar-primary" aria-label="Review by person">
          {REVIEW_NAV.map(({ to, label, icon, match }) => (
            <Link
              key={to}
              to={to}
              className={pathname.startsWith(match) || pathname === match ? 'active' : ''}
              onClick={onClose}
            >
              <span className="sidebar-icon" aria-hidden>
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="theme-picker">
          <span className="theme-picker-label">Theme</span>
          <div className="theme-picker-options" role="group" aria-label="Color theme">
            {themes.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`theme-picker-btn${theme === id ? ' active' : ''}`}
                onClick={() => setTheme(id)}
                aria-pressed={theme === id}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Link to="/spaces" className="sidebar-muted" onClick={onClose}>
          All spaces
        </Link>
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
