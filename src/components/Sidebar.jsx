import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { useTheme } from '../context/ThemeContext';
import SpaceIndexNav from './SpaceIndexNav';
import PageDetailPanel from './PageDetailPanel';
import { CATEGORY_ORDER } from '../lib/departments';
import { formatNumber } from '../lib/labels';
import './Sidebar.css';

const MAIN_NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/search', label: 'Search', icon: '⌕' },
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
  const [searchParams] = useSearchParams();
  const params = useParams();
  const { catalog } = useCatalog();
  const { theme, setTheme, themes } = useTheme();

  const activeCategoryId = matchCategoryId(pathname) || params.categoryId;

  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceSort, setSpaceSort] = useState('name');

  const categories = catalog?.categories;
  const catList = CATEGORY_ORDER.filter((id) => categories?.[id]);

  const categorySpaces = useMemo(() => {
    if (!catalog || !activeCategoryId) return [];
    return catalog.spaces.filter((s) => s.category === activeCategoryId);
  }, [catalog, activeCategoryId]);

  const personReviewPage = pathname.startsWith('/review/my-pages');
  const detailSpaceKey = searchParams.get('pageSpace') || '';
  const detailPageId = searchParams.get('pageId') || '';

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
        <p className="sidebar-section-title">Review by person</p>
        <nav className="sidebar-primary sidebar-hygiene" aria-label="Review by person">
          <Link
            to="/review/editors"
            className={pathname.startsWith('/review/editors') ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              ✉
            </span>
            Send reminders
          </Link>
          <Link
            to="/review/my-pages"
            className={pathname.startsWith('/review/my-pages') ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              ⌕
            </span>
            Filter by name
          </Link>
          <Link
            to="/stale"
            className={pathname === '/stale' ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              ⏱
            </span>
            All outdated pages
          </Link>
        </nav>
        {personReviewPage && detailSpaceKey && detailPageId && (
          <PageDetailPanel spaceKey={detailSpaceKey} pageId={detailPageId} />
        )}
      </div>

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
