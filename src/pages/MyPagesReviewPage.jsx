import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import StalePageRow from '../components/StalePageRow';
import { collectPagesForEditor, summarizeEditorPages } from '../lib/editorReview';
import { formatNumber } from '../lib/labels';
import '../components/ReviewMessageModal.css';

const STORAGE_KEY = 'lf-catalog-my-editor';

export default function MyPagesReviewPage() {
  const { catalog, loading, error } = useCatalog();
  const [editorName, setEditorName] = useState('');
  const [draft, setDraft] = useState('');
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setEditorName(saved);
        setDraft(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const pages = useMemo(() => {
    if (!catalog || !editorName.trim()) return [];
    return collectPagesForEditor(catalog, editorName.trim());
  }, [catalog, editorName]);

  const summary = useMemo(() => summarizeEditorPages(pages), [pages]);

  function applyEditor(e) {
    e.preventDefault();
    const value = draft.trim();
    setEditorName(value);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>My pages</span>
      </nav>

      <header className="page-header">
        <h1>My pages</h1>
        <p>
          Pages where you are the <strong>last editor</strong>. Fix stale docs yourself or use{' '}
          <Link to="/review/editors">review by editor</Link> as catalog owner.
        </p>
      </header>

      <form className="card filters toolbar" onSubmit={applyEditor} style={{ marginBottom: '1.5rem' }}>
        <label style={{ flex: 1, minWidth: '200px' }}>
          <span className="sr-only">Confluence display name</span>
          <input
            type="search"
            placeholder="Your Confluence name (e.g. chen.pan)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Show my pages
        </button>
      </form>

      {!editorName.trim() ? (
        <div className="empty">Enter your Confluence display name to see pages you last edited.</div>
      ) : summary.total === 0 ? (
        <div className="empty">
          No pages found for <strong>{editorName}</strong>. Try your exact Confluence username.
        </div>
      ) : (
        <>
          <div className="health-summary grid grid-2" style={{ marginBottom: '1.5rem' }}>
            <div className="health-stat card">
              <span className="health-stat-value">{formatNumber(summary.total)}</span>
              <span className="health-stat-label">Pages as last editor</span>
            </div>
            <div className="health-stat card health-stat-warn">
              <span className="health-stat-value">{formatNumber(summary.needsAttention)}</span>
              <span className="health-stat-label">Need attention</span>
            </div>
          </div>

          {summary.attentionPages.length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <h2 className="home-section-title" style={{ marginBottom: '0.75rem' }}>
                Needs attention
              </h2>
              <ul className="editor-review-list card" style={{ padding: '0.75rem 1rem' }}>
                {summary.attentionPages.map((page) => (
                  <StalePageRow
                    key={`${page.spaceKey}-${page.id || page.url}`}
                    page={page}
                    compact
                  />
                ))}
              </ul>
            </section>
          )}

          {summary.recentPages.length > 0 && (
            <section>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRecent((v) => !v)}
              >
                {showRecent ? 'Hide' : 'Show'} recent pages ({formatNumber(summary.recentPages.length)})
              </button>
              {showRecent && (
                <ul
                  className="editor-review-list card"
                  style={{ padding: '0.75rem 1rem', marginTop: '0.75rem' }}
                >
                  {summary.recentPages.slice(0, 100).map((page) => (
                    <StalePageRow
                      key={`${page.spaceKey}-${page.id || page.url}`}
                      page={page}
                      compact
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
