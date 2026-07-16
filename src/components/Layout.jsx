import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ContextBar from './ContextBar';
import PageDetailPanel from './PageDetailPanel';
import { clearSidebarPageDetail } from '../lib/reviewPaths';
import './Layout.css';

export default function Layout({ children }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  const detailPageId = searchParams.get('pageId') || '';
  const detailSpaceKey = searchParams.get('pageSpace') || '';
  const showPageDetail = Boolean(detailPageId && detailSpaceKey);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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
