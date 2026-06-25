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
          <p>Type in the search bar above and press Search or Enter.</p>
        )}
      </header>

      {!hasQuery && (
        <div className="search-tips card">
          <h2>Search tips</h2>
          <ul>
            <li>Search by page title, space name, or space key (e.g. <code>Onboarding</code>)</li>
            <li>Use multiple words to narrow results (e.g. <code>billing runbook</code>)</li>
            <li>Special characters work — <code>&amp;</code> matches pages with &amp; in the title</li>
            <li>People names match if they created or edited a page</li>
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
