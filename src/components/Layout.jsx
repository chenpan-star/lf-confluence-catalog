import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const isSearchRoute = location.pathname === '/search' || location.pathname.endsWith('/search');

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

  return (
    <div className="layout">
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
              placeholder="Search by page title, space, or person…"
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
