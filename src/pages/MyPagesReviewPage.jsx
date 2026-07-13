import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import StalePageRow from '../components/StalePageRow';
import {
  collectPagesForEditor,
  findMatchingEditors,
  listCatalogEditors,
  summarizeEditorPages,
} from '../lib/editorReview';
import { personMatchesQuery } from '../lib/personSearch';
import { parseCreatorFallback, withCreatorFallback } from '../lib/reviewPaths';
import { formatNumber } from '../lib/labels';
import '../components/HygieneHelp.css';

const RECENT_KEY = 'lf-catalog-recent-person-searches';
const MAX_RECENT = 5;

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(name) {
  try {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [trimmed, ...loadRecentSearches().filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export default function MyPagesReviewPage() {
  const { catalog, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEditor = searchParams.get('editor') || '';
  const queryParam = searchParams.get('q') || '';
  const detailSpaceKey = searchParams.get('pageSpace') || '';
  const detailPageId = searchParams.get('pageId') || '';
  const fallbackToCreator = parseCreatorFallback(searchParams);

  const [draft, setDraft] = useState(queryParam || selectedEditor);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    setDraft(queryParam || selectedEditor);
  }, [queryParam, selectedEditor]);

  const allEditors = useMemo(
    () => listCatalogEditors(catalog, { fallbackToCreator }),
    [catalog, fallbackToCreator],
  );

  const suggestions = useMemo(() => {
    const q = draft.trim();
    if (q.length < 2) return [];
    return allEditors.filter((name) => personMatchesQuery(q, name)).slice(0, 8);
  }, [allEditors, draft]);

  const matchingEditors = useMemo(() => {
    if (!catalog) return [];
    const q = (selectedEditor || queryParam).trim();
    if (!q) return [];
    return findMatchingEditors(catalog, q, { fallbackToCreator });
  }, [catalog, selectedEditor, queryParam, fallbackToCreator]);

  const activeEditor = useMemo(() => {
    if (selectedEditor.trim()) return selectedEditor.trim();
    if (matchingEditors.length === 1) return matchingEditors[0].editor;
    return '';
  }, [selectedEditor, matchingEditors]);

  const pages = useMemo(() => {
    if (!catalog || !activeEditor) return [];
    return collectPagesForEditor(catalog, activeEditor, { fallbackToCreator });
  }, [catalog, activeEditor, fallbackToCreator]);

  const summary = useMemo(() => summarizeEditorPages(pages), [pages]);

  function applySearch(name) {
    const value = (name ?? draft).trim();
    const next = new URLSearchParams(searchParams);
    next.delete('editor');
    next.delete('pageId');
    next.delete('pageSpace');
    if (!value) next.delete('q');
    else next.set('q', value);
    if (!value && !next.get('editor')) {
      setSearchParams({}, { replace: true });
      return;
    }
    saveRecentSearch(value);
    setRecentSearches(loadRecentSearches());
    setSearchParams(next, { replace: true });
  }

  function selectEditor(editor) {
    saveRecentSearch(editor);
    setRecentSearches(loadRecentSearches());
    const next = new URLSearchParams(searchParams);
    next.set('editor', editor);
    next.delete('q');
    next.delete('pageId');
    next.delete('pageSpace');
    setSearchParams(next, { replace: true });
  }

  function toggleCreatorFallback(enabled) {
    setSearchParams(withCreatorFallback(searchParams, enabled), { replace: true });
  }

  function handleSubmit(e) {
    e.preventDefault();
    applySearch();
  }

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Something went wrong: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  const hasQuery = Boolean((queryParam || selectedEditor).trim());
  const showPicker = hasQuery && !activeEditor && matchingEditors.length > 1;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Filter by name</span>
      </nav>

      <header className="page-header">
        <h1>Filter by name</h1>
        <p>
          Look up outdated Confluence pages by <strong>last editor</strong>. Search any person — not
          just yourself — by Confluence name, Slack handle, or email.
        </p>
      </header>

      <form className="card my-pages-form" onSubmit={handleSubmit}>
        <label htmlFor="person-search">Person name</label>
        <p className="my-pages-form-hint">
          Click a page title to preview details in the sidebar — you stay on this list. Examples:{' '}
          <span className="mono">Chen Pan</span>, <span className="mono">chen.pan</span>
        </p>
        <div className="my-pages-form-row">
          <input
            id="person-search"
            type="search"
            placeholder="Search by name, handle, or email…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            list="person-search-suggestions"
          />
          <datalist id="person-search-suggestions">
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </div>

        {suggestions.length > 0 && draft.trim().length >= 2 && (
          <ul className="person-suggest-list" aria-label="Matching people">
            {suggestions.map((name) => (
              <li key={name}>
                <button type="button" className="person-suggest-btn" onClick={() => selectEditor(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {recentSearches.length > 0 && (
          <div className="person-recent">
            <span className="person-recent-label">Recent:</span>
            {recentSearches.map((name) => (
              <button
                key={name}
                type="button"
                className="person-recent-chip"
                onClick={() => selectEditor(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <label className="filter-checkbox creator-fallback-toggle">
          <input
            type="checkbox"
            checked={fallbackToCreator}
            onChange={(e) => toggleCreatorFallback(e.target.checked)}
          />
          Use page creator when last editor is unreachable (Anonymous, bot, or missing)
        </label>
      </form>

      {!hasQuery ? (
        <div className="card hygiene-help">
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Enter a name above to see pages that person last edited. For a full list grouped by
            editor, try <Link to="/review/editors">Send reminders</Link>.
          </p>
        </div>
      ) : showPicker ? (
        <section className="card person-picker">
          <h2 className="home-section-title" style={{ marginBottom: '0.35rem' }}>
            Multiple people matched &ldquo;{queryParam}&rdquo;
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Pick the person you meant:
          </p>
          <ul className="person-picker-list">
            {matchingEditors.map((row) => (
              <li key={row.editor}>
                <button type="button" className="person-picker-row" onClick={() => selectEditor(row.editor)}>
                  <span className="person-picker-name">{row.editor}</span>
                  <span className="person-picker-meta">
                    {formatNumber(row.needsAttention)} outdated · {formatNumber(row.total)} total
                    {row.slackHandle && (
                      <>
                        {' '}
                        · <span className="mono">@{row.slackHandle}</span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : matchingEditors.length === 0 ? (
        <div className="empty review-empty card">
          <p>
            <strong>No one found for &ldquo;{queryParam || selectedEditor}&rdquo;.</strong>
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Try a different spelling, Slack handle, or partial name. Names must match how they appear
            in Confluence.
          </p>
        </div>
      ) : (
        <>
          <div className="person-result-head">
            <h2 className="home-section-title">{activeEditor}</h2>
            {queryParam && selectedEditor && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchParams({ q: queryParam }, { replace: true })}
              >
                ← Back to matches
              </button>
            )}
          </div>

          <div className="hygiene-stats" style={{ marginBottom: '1.5rem' }}>
            <div className="hygiene-stat card">
              <span className="hygiene-stat-value">{formatNumber(summary.total)}</span>
              <span className="hygiene-stat-label">Pages they last edited</span>
            </div>
            <div className="hygiene-stat card hygiene-stat-warn">
              <span className="hygiene-stat-value">{formatNumber(summary.needsAttention)}</span>
              <span className="hygiene-stat-label">Outdated (1+ years)</span>
            </div>
          </div>

          {summary.attentionPages.length > 0 ? (
            <section style={{ marginBottom: '1.5rem' }}>
              <h3 className="home-section-title" style={{ marginBottom: '0.35rem' }}>
                Outdated pages
              </h3>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.75rem',
                }}
              >
                Not updated in over a year — consider updating, archiving, or deleting.
              </p>
              <ul className="editor-review-list card" style={{ padding: '0.75rem 1rem' }}>
                {summary.attentionPages.map((page) => (
                  <StalePageRow
                    key={`${page.spaceKey}-${page.id || page.url}`}
                    page={page}
                    compact
                    reviewDetail
                    selected={
                      detailSpaceKey === page.spaceKey &&
                      detailPageId === String(page.id || '')
                    }
                  />
                ))}
              </ul>
            </section>
          ) : (
            <div className="card review-empty" style={{ marginBottom: '1.5rem' }}>
              <p>
                <strong>No outdated pages</strong> for this person right now.
              </p>
            </div>
          )}

          {summary.recentPages.length > 0 && (
            <section>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRecent((v) => !v)}
              >
                {showRecent ? 'Hide' : 'Show'} other pages (
                {formatNumber(summary.recentPages.length)})
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
                      reviewDetail
                      selected={
                        detailSpaceKey === page.spaceKey &&
                        detailPageId === String(page.id || '')
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <p className="stale-footnote" style={{ marginTop: '1.5rem' }}>
        Need to nudge many people? Use <Link to="/review/editors">Send reminders</Link> to message
        editors in bulk.
      </p>
    </>
  );
}
