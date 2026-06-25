import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { searchCatalog } from '../lib/search';
import { formatTitle } from '../lib/text';
import { formatNumber, formatDate, DOC_TYPE_LABELS } from '../lib/labels';
import { toConfluenceUrl } from '../lib/confluenceUrl';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const { catalog, loading, error, searchIndex } = useCatalog();

  const results = useMemo(
    () => searchCatalog(searchIndex, q),
    [searchIndex, q],
  );

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;

  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const hasQuery = q.trim().length > 0;
  const hasResults = results.spaces.length > 0 || results.pages.length > 0;

  return (
    <>
      <header className="page-header">
        <h1>Search</h1>
        {hasQuery ? (
          <p>
            {hasResults ? (
              <>
                <strong>{formatNumber(results.totalMatches)}</strong> results for &ldquo;
                <strong>{q}</strong>&rdquo;
                {results.totalMatches > results.spaces.length + results.pages.length && (
                  <> (showing top matches)</>
                )}
              </>
            ) : (
              <>
                No results for &ldquo;<strong>{q}</strong>&rdquo;
              </>
            )}
          </p>
        ) : (
          <p>Use the search bar at the top of the page — press Enter or click Search.</p>
        )}
      </header>

      {!hasQuery && (
        <div className="search-tips card">
          <h2>How to search</h2>
          <ul>
            <li>Type a page title (e.g. <code>Onboarding checklist</code>)</li>
            <li>Type a space name or key (e.g. <code>EN</code> or <code>Engineering</code>)</li>
            <li>Add more words to narrow results (e.g. <code>billing runbook</code>)</li>
            <li>Search by a person&apos;s name if they created or edited the page</li>
          </ul>
        </div>
      )}

      {hasQuery && !hasResults && (
        <div className="empty">
          <p>Try a shorter keyword, a space name, or browse by department.</p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/departments">Browse departments</Link>
            {' · '}
            <Link to="/spaces">Browse all spaces</Link>
          </p>
        </div>
      )}

      {results.spaces.length > 0 && (
        <section className="search-section">
          <h2 className="search-section-title">Spaces ({results.spaces.length})</h2>
          <ul className="search-results">
            {results.spaces.map((item) => (
              <li key={item.key} className="search-result card">
                <span className="search-result-type">Space</span>
                <Link to={item.path} className="search-result-title">
                  {item.title}
                </Link>
                <p className="search-result-sub">{item.subtitle}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.pages.length > 0 && (
        <section className="search-section">
          <h2 className="search-section-title">Pages ({results.pages.length})</h2>
          <ul className="search-results">
            {results.pages.map((item) => {
              const title = formatTitle(item.title);
              const page = item.page;
              return (
                <li key={item.key} className="search-result card">
                  <span className="search-result-type">Page</span>
                  {item.path ? (
                    <Link to={item.path} className="search-result-title">
                      {title}
                    </Link>
                  ) : (
                    <a
                      href={toConfluenceUrl(item.url, site)}
                      target="_blank"
                      rel="noreferrer"
                      className="search-result-title"
                    >
                      {title} ↗
                    </a>
                  )}
                  <p className="search-result-sub">{item.subtitle}</p>
                  {page && (
                    <p className="search-result-meta">
                      Updated {formatDate(page.lastModified)}
                      {page.docType && (
                        <> · {DOC_TYPE_LABELS[page.docType] || page.docType}</>
                      )}
                      {page.lastEditor && <> · {page.lastEditor}</>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
