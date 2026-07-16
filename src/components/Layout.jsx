import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ContextBar from './ContextBar';
import PageDetailPanel from './PageDetailPanel';
import { clearSidebarPageDetail } from '../lib/reviewPaths';
import './Layout.css';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const isSearchRoute = location.pathname === '/search' || location.pathname.endsWith('/search');
  const detailPageId = searchParams.get('pageId') || '';
  const detailSpaceKey = searchParams.get('pageSpace') || '';
  const showPageDetail = Boolean(detailPageId && detailSpaceKey);

  useEffect(() => {
    if (isSearchRoute) {
      setQuery(searchParams.get('q') || '');
    }
  }, [isSearchRoute, searchParams]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/search');
    }
  }

  function closePageDetail() {
    setSearchParams(clearSidebarPageDetail(searchParams), { replace: true });
  }

  return (
    <div className={`layout${showPageDetail ? ' layout-with-detail' : ''}`}>
      <header className="header">
        <div className="header-bar">
          <button
            type="button"
            className="menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            ☰
          </button>

          <Link to="/" className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">
              <strong>LF Confluence</strong>
              <small>Catalog</small>
            </span>
          </Link>

          <form className="search-form" onSubmit={handleSearch} role="search">
            <span className="search-icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search pages, spaces, or people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search catalog"
            />
            <button type="submit" className="search-submit">
              Search
            </button>
          </form>
        </div>
      </header>

      <ContextBar />

      <div className="layout-body">
        <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
        {menuOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <main className="main">{children}</main>
        {showPageDetail && (
          <>
            <button
              type="button"
              className="page-detail-backdrop"
              aria-label="Close page detail"
              onClick={closePageDetail}
            />
            <PageDetailPanel spaceKey={detailSpaceKey} pageId={detailPageId} />
          </>
        )}
      </div>

      <footer className="footer">
        <p>
          Read-only catalog ·{' '}
          <a href="https://lotusflare.atlassian.net/wiki" target="_blank" rel="noreferrer">
            lotusflare.atlassian.net
          </a>
        </p>
      </footer>
    </div>
  );
}
