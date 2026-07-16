import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useCatalog } from '../context/CatalogContext';
import Pagination, { PaginationBar } from '../components/Pagination';
import { searchCatalog } from '../lib/search';
import { formatTitle } from '../lib/text';
import { formatNumber, formatDate, DOC_TYPE_LABELS } from '../lib/labels';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import {
  applyListPage,
  clearListPage,
  computePagination,
  readListPage,
  scrollToTop,
  slicePage,
  PAGE_SIZE,
} from '../lib/pagination';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const prevQ = useRef(q);

  useEffect(() => {
    if (prevQ.current !== q && searchParams.get('page')) {
      setSearchParams(clearListPage(searchParams), { replace: true });
    }
    prevQ.current = q;
  }, [q, searchParams, setSearchParams]);

  const { catalog, loading, error, searchIndex } = useCatalog();

  const results = useMemo(
    () => searchCatalog(searchIndex, q),
    [searchIndex, q],
  );

  const combined = useMemo(
    () => [
      ...results.spaces.map((item) => ({ kind: 'space', item })),
      ...results.pages.map((item) => ({ kind: 'page', item })),
    ],
    [results],
  );

  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(combined.length, listPage, PAGE_SIZE);
  const paginated = useMemo(
    () => slicePage(combined, safePage, PAGE_SIZE),
    [combined, safePage],
  );

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
    scrollToTop();
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;

  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const hasQuery = q.trim().length > 0;
  const hasResults = combined.length > 0;

  return (
    <div className="page-shell">
      <PageHeader title="Search">
        {hasQuery ? (
          hasResults ? (
            <>
              {formatNumber(results.totalMatches)} results for &ldquo;{q}&rdquo;
            </>
          ) : (
            <>No results for &ldquo;{q}&rdquo;</>
          )
        ) : (
          <>Search pages, spaces, or people using the bar at the top.</>
        )}
      </PageHeader>

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
          <p>Try a shorter keyword, a space name, or search by a person&apos;s name or handle.</p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/categories">Browse categories</Link>
            {' · '}
            <Link to="/spaces">Browse all spaces</Link>
          </p>
        </div>
      )}

      {hasResults && (
        <PaginationBar
          page={safePage}
          pageSize={PAGE_SIZE}
          total={combined.length}
          onPageChange={setListPage}
          itemLabel="results"
        >
          <ul className="search-results">
            {paginated.map(({ kind, item }) => {
              if (kind === 'space') {
                return (
                  <li key={item.key} className="search-result card">
                    <span className="search-result-type">Space</span>
                    <Link to={item.path} className="search-result-title">
                      {item.title}
                    </Link>
                    <p className="search-result-sub">{item.subtitle}</p>
                  </li>
                );
              }

              const title = formatTitle(item.title);
              const page = item.page;
              return (
                <li key={item.key} className="search-result card">
                  <span className="search-result-type">Page</span>
                  {item.path || (page?.id && item.spaceKey) ? (
                    <Link
                      to={
                        page?.id && item.spaceKey
                          ? `/space/${encodeURIComponent(item.spaceKey)}?pageId=${page.id}&pageSpace=${encodeURIComponent(item.spaceKey)}`
                          : item.path
                      }
                      className="search-result-title"
                    >
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
        </PaginationBar>
      )}
    </div>
  );
}
