import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import PageHeader from '../components/PageHeader';
import StalePageRow from '../components/StalePageRow';
import Pagination, { PaginationBar } from '../components/Pagination';
import HygieneHelpCard from '../components/HygieneHelp';
import RemindStatusBanner from '../components/RemindStatusBanner';
import { CATEGORY_ORDER } from '../lib/departments';
import { filterStalePages, groupStalePagesByCategory } from '../lib/health';
import {
  applyListPage,
  clearListPage,
  computePagination,
  readListPage,
  scrollToTop,
  slicePage,
  TABLE_PAGE_SIZE,
} from '../lib/pagination';
import { parseCreatorFallback, withCreatorFallback } from '../lib/reviewPaths';
import { formatNumber } from '../lib/labels';
import '../components/HygieneHelp.css';

export default function StaleContentPage() {
  const { catalog, loading, error, health } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get('category') || 'all';
  const personQuery = searchParams.get('person') || '';
  const grouped = searchParams.get('view') !== 'flat';
  const fallbackToCreator = parseCreatorFallback(searchParams);
  const detailSpaceKey = searchParams.get('pageSpace') || '';
  const detailPageId = searchParams.get('pageId') || '';
  const [personDraft, setPersonDraft] = useState(personQuery);

  useEffect(() => {
    setPersonDraft(personQuery);
  }, [personQuery]);

  const filtered = useMemo(() => {
    if (!health) return [];
    return filterStalePages(health.stalePages, {
      category,
      personQuery,
      fallbackToCreator,
    });
  }, [health, category, personQuery, fallbackToCreator]);

  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(filtered.length, listPage, TABLE_PAGE_SIZE);
  const displayList = useMemo(
    () => slicePage(filtered, safePage, TABLE_PAGE_SIZE),
    [filtered, safePage],
  );

  const groupedPages = useMemo(
    () => groupStalePagesByCategory(displayList, CATEGORY_ORDER),
    [displayList],
  );

  function updateParam(key, value) {
    const next = clearListPage(new URLSearchParams(searchParams));
    if (value === 'all' || !value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
    scrollToTop();
  }

  function applyPersonSearch(e) {
    e.preventDefault();
    updateParam('person', personDraft.trim());
  }

  function clearPersonSearch() {
    setPersonDraft('');
    updateParam('person', '');
  }

  function toggleCreatorFallback(enabled) {
    setSearchParams(withCreatorFallback(clearListPage(searchParams), enabled), { replace: true });
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog || !health) return <div className="empty">Unable to load catalog data.</div>;

  const { counts } = health;

  return (
    <div className="page-shell">
      <PageHeader title="All outdated pages">
        Pages not updated in over a year. For bulk reminders, try{' '}
        <Link to="/review/editors">Send reminders</Link>.
      </PageHeader>

      <RemindStatusBanner />
      <HygieneHelpCard compact title="Remind from this list" />

      <div className="stat-chips" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-chip">
          <span className="stat-chip-value" style={{ color: 'var(--amber)' }}>
            {formatNumber(counts.stale)}
          </span>
          <span className="stat-chip-label">1–2 years</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-value" style={{ color: '#f87171' }}>
            {formatNumber(counts.legacy)}
          </span>
          <span className="stat-chip-label">2+ years</span>
        </div>
      </div>

      <form className="filter-panel" onSubmit={applyPersonSearch}>
        <p className="filter-panel-title">Filters</p>
        <div className="filter-panel-row">
        <select
          value={category}
          onChange={(e) => updateParam('category', e.target.value)}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {CATEGORY_ORDER.filter((id) => catalog.categories[id]).map((id) => {
            const cat = catalog.categories[id];
            const catHealth = health.byCategory[id];
            const staleCount = (catHealth?.stale || 0) + (catHealth?.legacy || 0);
            return (
              <option key={id} value={id}>
                {cat.label} ({staleCount} outdated)
              </option>
            );
          })}
        </select>
        <input
          type="search"
          placeholder="Filter by person (name, handle, email)…"
          value={personDraft}
          onChange={(e) => setPersonDraft(e.target.value)}
          className="filter-search"
          aria-label="Filter by person"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        {personQuery && (
          <button type="button" className="btn btn-secondary" onClick={clearPersonSearch}>
            Clear
          </button>
        )}
        <label className="filter-checkbox creator-fallback-toggle stale-fallback-toggle">
          <input
            type="checkbox"
            checked={fallbackToCreator}
            onChange={(e) => toggleCreatorFallback(e.target.checked)}
          />
          Use creator if last editor unreachable
        </label>
        </div>
      </form>

      <div className="content-toolbar">
        <p className="result-count" style={{ margin: 0 }}>
          {formatNumber(filtered.length)} matching page{filtered.length !== 1 ? 's' : ''}
        </p>
        <div className="segmented" role="group" aria-label="View mode">
        <button
          type="button"
          className={grouped ? 'active' : ''}
          onClick={() => {
            const next = clearListPage(new URLSearchParams(searchParams));
            next.delete('view');
            setSearchParams(next, { replace: true });
          }}
        >
          By category
        </button>
        <button
          type="button"
          className={!grouped ? 'active' : ''}
          onClick={() => updateParam('view', 'flat')}
        >
          Flat list
        </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty review-empty card">
          <p>
            <strong>No outdated pages match your filters.</strong>
          </p>
          {personQuery && (
            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              Try a different spelling for &ldquo;{personQuery}&rdquo;, or clear the person filter.
            </p>
          )}
        </div>
      ) : grouped ? (
        <>
          <PaginationBar
            page={safePage}
            pageSize={TABLE_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setListPage}
            itemLabel="pages"
          >
            <div className="stale-grouped">
              {groupedPages.map(({ categoryId, pages }) => {
              const cat = catalog.categories[categoryId];
              const label = cat?.label || categoryId;
              return (
                <section key={categoryId} className="stale-category-section card">
                  <header className="stale-category-header">
                    {cat && (
                      <span
                        className="sidebar-category-dot"
                        style={{ background: cat.color }}
                        aria-hidden
                      />
                    )}
                    <h2>{label}</h2>
                    <span className="stale-category-count">
                      {formatNumber(pages.length)} page{pages.length !== 1 ? 's' : ''}
                    </span>
                    {cat && (
                      <Link to={`/category/${categoryId}`} className="stale-category-link">
                        Browse category →
                      </Link>
                    )}
                  </header>
                  <div className="table-wrap">
                    <table className="stale-table">
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>Space</th>
                          <th>Last updated</th>
                          <th>Contact</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pages.map((page) => (
                          <StalePageRow
                            key={`${page.spaceKey}-${page.id || page.url}`}
                            page={page}
                            reviewDetail
                            selected={
                              detailSpaceKey === page.spaceKey &&
                              detailPageId === String(page.id || '')
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
            </div>
          </PaginationBar>
        </>
      ) : (
        <>
          <PaginationBar
            page={safePage}
            pageSize={TABLE_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setListPage}
            itemLabel="pages"
          >
            <div className="table-wrap card">
            <table className="stale-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Space</th>
                  <th>Category</th>
                  <th>Last updated</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((page) => (
                  <StalePageRow
                    key={`${page.spaceKey}-${page.id || page.url}`}
                    page={page}
                    showCategory
                    reviewDetail
                    selected={
                      detailSpaceKey === page.spaceKey &&
                      detailPageId === String(page.id || '')
                    }
                  />
                ))}
              </tbody>
            </table>
            </div>
          </PaginationBar>
        </>
      )}

      <p className="stale-footnote">
        Click <strong>Send reminder</strong>, confirm the recipient, then copy &amp; open Slack and
        paste the message into their DM.
      </p>
    </div>
  );
}
