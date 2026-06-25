import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import './Layout.css';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">◈</span>
            <span>
              <strong>LF Confluence</strong>
              <small>Space Catalog</small>
            </span>
          </Link>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Search pages & spaces…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />
          </form>

          <nav className="nav">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              Departments
            </Link>
            <Link to="/contributors" className={location.pathname === '/contributors' ? 'active' : ''}>
              Contributors
            </Link>
          </nav>
        </div>
      </header>

      <main className="main container">{children}</main>

      <footer className="footer container">
        <p>
          Read-only catalog · Data from{' '}
          <a href="https://lotusflare.atlassian.net/wiki" target="_blank" rel="noreferrer">
            lotusflare.atlassian.net
          </a>
        </p>
      </footer>
    </div>
  );
}
