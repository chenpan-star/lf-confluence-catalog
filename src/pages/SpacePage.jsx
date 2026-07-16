import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import BarChart from '../components/BarChart';
import PageList from '../components/PageList';
import PageTree from '../components/PageTree';
import { PaginationBar } from '../components/Pagination';
import { buildPageTree, filterPagesWithAncestors } from '../lib/pageTree';
import { normalizeForSearch } from '../lib/text';
import { accountablePerson } from '../lib/contact';
import { editorsAreSamePerson, personMatchesQuery } from '../lib/personSearch';
import { formatNumber, DOC_TYPE_LABELS, RECENCY_COLORS } from '../lib/labels';
import {
  applyListPage,
  clearListPage,
  computePagination,
  readListPage,
  scrollToTop,
  slicePage,
  PAGE_SIZE,
} from '../lib/pagination';
import '../components/PageTree.css';
import '../components/HygieneHelp.css';
import './SpacePage.css';

function summarizePersonInSpace(pages, person) {
  const matched = pages.filter((p) => {
    const lastEditor = (p.lastEditor || '').trim();
    const contact = accountablePerson(p);
    return (
      editorsAreSamePerson(lastEditor, person) || editorsAreSamePerson(contact, person)
    );
  });
  const counts = { active: 0, recent: 0, stale: 0, legacy: 0, unknown: 0 };
  for (const p of matched) {
    const r = p.recency || 'unknown';
    counts[r] = (counts[r] || 0) + 1;
  }
  return {
    total: matched.length,
    current: counts.active + counts.recent,
    outdated: counts.stale + counts.legacy,
    counts,
  };
}

function matchesRecency(page, recencyFilter) {
  if (!recencyFilter || recencyFilter === 'all') return true;
  if (recencyFilter === 'current') return page.recency === 'active' || page.recency === 'recent';
  if (recencyFilter === 'outdated') return page.recency === 'stale' || page.recency === 'legacy';
  return page.recency === recencyFilter;
}

const FRESHNESS_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'current', label: 'Current' },
  { id: 'outdated', label: 'Outdated' },
  { id: 'stale', label: 'Stale (1–2y)' },
  { id: 'legacy', label: 'Legacy (2y+)' },
];

export default function SpacePage() {
  const { spaceKey } = useParams();
  const outlet = useOutletContext() || {};
  const categoryId = outlet.categoryId;
  const inShell = Boolean(categoryId);
  const routeContext = { categoryId };
  const { catalog, resolveSpace, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docFilter, setDocFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [personDraft, setPersonDraft] = useState(searchParams.get('person') || '');
  const [viewMode, setViewMode] = useState('flat');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const personFilter = searchParams.get('person') || '';
  const recencyFilter = searchParams.get('freshness') || 'all';
  const space = resolveSpace(spaceKey);

  const peopleInSpace = useMemo(() => {
    if (!space?.pages) return [];
    const byName = new Map();
    for (const page of space.pages) {
      // Prefer the real last editor so the list matches Confluence history.
      const editor = (page.lastEditor || '').trim();
      const person = editor || accountablePerson(page);
      if (!person) continue;
      if (!byName.has(person)) {
        byName.set(person, {
          name: person,
          total: 0,
          outdated: 0,
          current: 0,
          isLastEditor: Boolean(editor),
        });
      }
      const row = byName.get(person);
      row.total += 1;
      if (page.recency === 'stale' || page.recency === 'legacy') row.outdated += 1;
      if (page.recency === 'active' || page.recency === 'recent') row.current += 1;
    }
    return [...byName.values()].sort(
      (a, b) => b.outdated - a.outdated || b.total - a.total || a.name.localeCompare(b.name),
    );
  }, [space]);

  const personList = useMemo(() => {
    const q = personDraft.trim();
    if (!q) return peopleInSpace;
    return peopleInSpace.filter((p) => personMatchesQuery(q, p.name));
  }, [peopleInSpace, personDraft]);

  const personSummary = useMemo(() => {
    if (!space?.pages || !personFilter.trim()) return null;
    return summarizePersonInSpace(space.pages, personFilter.trim());
  }, [space, personFilter]);

  const filteredPages = useMemo(() => {
    if (!space?.pages) return [];
    const pages = space.pages || [];
    const matches = (p) => {
      if (docFilter !== 'all' && p.docType !== docFilter) return false;
      if (!matchesRecency(p, recencyFilter)) return false;
      if (personFilter.trim()) {
        const selected = personFilter.trim();
        const lastEditor = (p.lastEditor || '').trim();
        const contact = accountablePerson(p);
        const matchesPerson =
          editorsAreSamePerson(lastEditor, selected) ||
          editorsAreSamePerson(contact, selected);
        if (!matchesPerson) return false;
      }
      if (search) {
        const q = normalizeForSearch(search);
        if (!normalizeForSearch(p.title || '').includes(q)) return false;
      }
      return true;
    };
    if (viewMode === 'tree') {
      return filterPagesWithAncestors(pages, matches);
    }
    return pages.filter(matches);
  }, [space, docFilter, recencyFilter, search, viewMode, personFilter]);

  const pageTree = useMemo(() => buildPageTree(filteredPages), [filteredPages]);

  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(filteredPages.length, listPage, PAGE_SIZE);
  const pagedFlatPages = useMemo(
    () => slicePage(filteredPages, safePage, PAGE_SIZE),
    [filteredPages, safePage],
  );

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
    scrollToTop();
  }

  function updateParams(mutator) {
    const next = clearListPage(new URLSearchParams(searchParams));
    mutator(next);
    setSearchParams(next, { replace: true });
  }

  function setPersonFilter(value) {
    const name = (value || '').trim();
    setPersonDraft(name);
    updateParams((next) => {
      if (!name) next.delete('person');
      else next.set('person', name);
    });
  }

  function setFreshness(value) {
    updateParams((next) => {
      if (!value || value === 'all') next.delete('freshness');
      else next.set('freshness', value);
    });
  }

  function clearAllFilters() {
    setSearch('');
    setDocFilter('all');
    setPersonDraft('');
    setSearchParams({}, { replace: true });
  }

  const hasActiveFilters =
    Boolean(personFilter) ||
    recencyFilter !== 'all' ||
    Boolean(search.trim()) ||
    docFilter !== 'all';

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!space) return <div className="empty">Space not found.</div>;

  const category = catalog?.categories?.[space.category];

  return (
    <>
      {!inShell && (
        <nav className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/spaces">Spaces</Link>
          <span>/</span>
          {category && (
            <>
              <Link to={`/category/${space.category}`}>{category.label}</Link>
              <span>/</span>
            </>
          )}
          <span>{space.name}</span>
        </nav>
      )}

      <header className="page-header">
        <h1>{space.name}</h1>
        <p>
          <span className="mono">{space.key}</span>
          {category && !categoryId && (
            <>
              {' '}
              · <Link to={`/category/${space.category}`}>{category.label}</Link>
            </>
          )}
          {' '}
          ·{' '}
          <a href={space.confluenceUrl} target="_blank" rel="noreferrer">
            Open in Confluence ↗
          </a>
        </p>
        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <div className="stat">
            <span className="stat-value">{formatNumber(space.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
          {space.recency?.active > 0 && (
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--green)' }}>
                {space.recency.active}
              </span>
              <span className="stat-label">Active</span>
            </div>
          )}
          {(space.staleCount || 0) > 0 && (
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--amber)' }}>
                {formatNumber(space.staleCount)}
              </span>
              <span className="stat-label">Need review</span>
            </div>
          )}
        </div>
      </header>

      <div className="grid space-charts">
        <div className="card">
          <h2 className="space-chart-title">By document type</h2>
          <BarChart data={space.docTypes} />
        </div>
        <div className="card">
          <h2 className="space-chart-title">By freshness</h2>
          <BarChart data={space.recency} maxItems={5} />
        </div>
      </div>

      <section className="card space-filter-panel">
        <div className="space-filter-primary">
          <label htmlFor="space-person-search" className="space-filter-label">
            Find pages by person
          </label>
          <p className="space-filter-hint">
            All last editors in this space are listed below. Search to narrow the list, then click a
            person to see current vs outdated pages.
          </p>
          <div className="space-filter-search-row">
            <input
              id="space-person-search"
              type="search"
              placeholder="Search last editors…"
              value={personDraft}
              onChange={(e) => setPersonDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const match = personList[0];
                  setPersonFilter(match?.name || personDraft);
                }
              }}
              autoComplete="off"
            />
            {personFilter && (
              <button type="button" className="btn btn-secondary" onClick={() => setPersonFilter('')}>
                Clear
              </button>
            )}
          </div>

          {!personFilter && (
            <>
              <p className="space-person-list-count">
                {formatNumber(personList.length)} of {formatNumber(peopleInSpace.length)} last editor
                {peopleInSpace.length !== 1 ? 's' : ''}
                {personDraft.trim() ? ' matching your search' : ''}
                {!personDraft.trim() && ' · most outdated first'}
              </p>
              {personList.length === 0 ? (
                <p className="space-person-empty">No last editors match that name.</p>
              ) : (
                <ul className="space-person-list" aria-label="Last editors in this space">
                  {personList.map((p) => (
                    <li key={p.name}>
                      <button
                        type="button"
                        className="space-person-row"
                        onClick={() => setPersonFilter(p.name)}
                      >
                        <span className="space-person-row-name">{p.name}</span>
                        <span className="space-person-row-meta">
                          {formatNumber(p.total)} page{p.total !== 1 ? 's' : ''}
                          {p.outdated > 0 && (
                            <>
                              {' '}
                              ·{' '}
                              <span className="space-person-chip-outdated">
                                {formatNumber(p.outdated)} outdated
                              </span>
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {personSummary && (
          <div className="space-person-result">
            <p className="space-person-result-title">
              Showing pages for <strong>{personFilter}</strong>
            </p>
            <div className="space-person-stat-grid" role="group" aria-label="Page freshness for person">
              <button
                type="button"
                className={`space-person-stat${recencyFilter === 'all' ? ' active' : ''}`}
                onClick={() => setFreshness('all')}
              >
                <span className="space-person-stat-value">{formatNumber(personSummary.total)}</span>
                <span className="space-person-stat-label">Total</span>
              </button>
              <button
                type="button"
                className={`space-person-stat space-person-stat-ok${recencyFilter === 'current' ? ' active' : ''}`}
                onClick={() => setFreshness('current')}
              >
                <span className="space-person-stat-value">{formatNumber(personSummary.current)}</span>
                <span className="space-person-stat-label">Current</span>
              </button>
              <button
                type="button"
                className={`space-person-stat space-person-stat-warn${recencyFilter === 'outdated' ? ' active' : ''}`}
                onClick={() => setFreshness('outdated')}
              >
                <span className="space-person-stat-value">{formatNumber(personSummary.outdated)}</span>
                <span className="space-person-stat-label">Outdated</span>
              </button>
            </div>
            <div className="space-person-detail">
              <button
                type="button"
                className={`space-detail-pill${recencyFilter === 'stale' ? ' active' : ''}`}
                onClick={() => setFreshness('stale')}
              >
                <span style={{ color: RECENCY_COLORS.stale }}>
                  {formatNumber(personSummary.counts.stale)}
                </span>{' '}
                stale (1–2 years)
              </button>
              <button
                type="button"
                className={`space-detail-pill${recencyFilter === 'legacy' ? ' active' : ''}`}
                onClick={() => setFreshness('legacy')}
              >
                <span style={{ color: RECENCY_COLORS.legacy }}>
                  {formatNumber(personSummary.counts.legacy)}
                </span>{' '}
                legacy (2+ years)
              </button>
              <button
                type="button"
                className={`space-detail-pill${recencyFilter === 'active' ? ' active' : ''}`}
                onClick={() => setFreshness('active')}
              >
                <span style={{ color: RECENCY_COLORS.active }}>
                  {formatNumber(personSummary.counts.active)}
                </span>{' '}
                active
              </button>
              <button
                type="button"
                className={`space-detail-pill${recencyFilter === 'recent' ? ' active' : ''}`}
                onClick={() => setFreshness('recent')}
              >
                <span style={{ color: RECENCY_COLORS.recent }}>
                  {formatNumber(personSummary.counts.recent)}
                </span>{' '}
                recent
              </button>
            </div>
            <p className="space-person-tip">
              Tip: click <strong>Outdated</strong> to list only pages that need update or archive.
            </p>
          </div>
        )}
      </section>

      <div className="space-pages-toolbar">
        <h2 className="space-pages-heading">
          Pages <span className="space-pages-count">{formatNumber(filteredPages.length)}</span>
        </h2>
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'flat' ? 'active' : ''}
            onClick={() => setViewMode('flat')}
          >
            List
          </button>
          <button
            type="button"
            className={viewMode === 'tree' ? 'active' : ''}
            onClick={() => setViewMode('tree')}
          >
            Tree
          </button>
        </div>
      </div>

      {!personFilter && (
        <div className="space-freshness-pills" role="group" aria-label="Freshness filter">
          {FRESHNESS_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={`space-freshness-pill${recencyFilter === pill.id ? ' active' : ''}`}
              onClick={() => setFreshness(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-secondary-filters">
        <input
          type="search"
          placeholder="Search page titles…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchParams(clearListPage(searchParams), { replace: true });
          }}
          className="filter-search"
          aria-label="Search page titles"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowMoreFilters((v) => !v)}
        >
          {showMoreFilters ? 'Hide more filters' : 'More filters'}
        </button>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
            Reset all
          </button>
        )}
      </div>

      {showMoreFilters && (
        <div className="space-more-filters">
          <label className="space-more-filter">
            <span>Document type</span>
            <select
              value={docFilter}
              onChange={(e) => {
                setDocFilter(e.target.value);
                setSearchParams(clearListPage(searchParams), { replace: true });
              }}
            >
              <option value="all">All types</option>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {filteredPages.length === 0 ? (
        <div className="empty review-empty card">
          <p>
            <strong>No pages match these filters.</strong>
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Try clearing the person filter or choosing <strong>All</strong> freshness.
          </p>
        </div>
      ) : viewMode === 'tree' ? (
        <PageTree
          tree={pageTree}
          spaceKey={space.key || spaceKey}
          routeContext={routeContext}
          sidebarDetail
          selectedPageId={searchParams.get('pageId') || ''}
        />
      ) : (
        <PaginationBar
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredPages.length}
          onPageChange={setListPage}
          itemLabel="pages"
        >
          <PageList
            pages={pagedFlatPages}
            spaceKey={space.key || spaceKey}
            routeContext={routeContext}
            sidebarDetail
            selectedPageId={searchParams.get('pageId') || ''}
          />
        </PaginationBar>
      )}
    </>
  );
}
