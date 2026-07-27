import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import BarChart from '../components/BarChart';
import PageList from '../components/PageList';
import PageTree from '../components/PageTree';
import { PaginationBar, paginationMeta } from '../components/Pagination';
import { buildPageTree, filterPagesWithAncestors } from '../lib/pageTree';
import { normalizeForSearch } from '../lib/text';
import { accountablePerson } from '../lib/contact';
import { editorsAreSamePerson, personMatchesQuery } from '../lib/personSearch';
import { docTypePillClass } from '../lib/docTypeStyles';
import { formatNumber, DOC_TYPE_LABELS } from '../lib/labels';
import {
  applyListPage,
  clearListPage,
  computePagination,
  readListPage,
  slicePage,
  PAGE_SIZE,
} from '../lib/pagination';
import ReviewMessageModal from '../components/ReviewMessageModal';
import '../components/ReviewMessageModal.css';
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
  const routeContext = { categoryId };
  const { catalog, resolveSpace, loading, error, slackConfig } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docFilter, setDocFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [personDraft, setPersonDraft] = useState(searchParams.get('person') || '');
  const [viewMode, setViewMode] = useState('flat');
  const [personPanelOpen, setPersonPanelOpen] = useState(Boolean(searchParams.get('person')));
  const [personRemindOpen, setPersonRemindOpen] = useState(false);

  const personFilter = searchParams.get('person') || '';
  const recencyFilter = searchParams.get('freshness') || 'all';
  const space = resolveSpace(spaceKey);

  useEffect(() => {
    if (personFilter) setPersonPanelOpen(true);
  }, [personFilter]);

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

  const personOutdatedPages = useMemo(() => {
    if (!space?.pages || !personFilter.trim()) return [];
    const selected = personFilter.trim();
    return space.pages.filter((p) => {
      if (p.recency !== 'stale' && p.recency !== 'legacy') return false;
      const lastEditor = (p.lastEditor || '').trim();
      const contact = accountablePerson(p);
      return (
        editorsAreSamePerson(lastEditor, selected) || editorsAreSamePerson(contact, selected)
      );
    });
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

  const directMatches = useMemo(() => {
    if (!space?.pages) return [];
    const pages = space.pages || [];
    return pages.filter((p) => {
      if (docFilter !== 'all' && p.docType !== docFilter) return false;
      if (!matchesRecency(p, recencyFilter)) return false;
      if (personFilter.trim()) {
        const selected = personFilter.trim();
        const lastEditor = (p.lastEditor || '').trim();
        const contact = accountablePerson(p);
        if (
          !editorsAreSamePerson(lastEditor, selected) &&
          !editorsAreSamePerson(contact, selected)
        ) {
          return false;
        }
      }
      if (search) {
        const q = normalizeForSearch(search);
        if (!normalizeForSearch(p.title || '').includes(q)) return false;
      }
      return true;
    });
  }, [space, docFilter, recencyFilter, search, personFilter]);

  const highlightPageIds = useMemo(
    () => new Set(directMatches.map((p) => p.id).filter(Boolean)),
    [directMatches],
  );

  const hasActiveFilters =
    Boolean(personFilter) ||
    recencyFilter !== 'all' ||
    Boolean(search.trim()) ||
    docFilter !== 'all';

  const displayedPageCount =
    viewMode === 'tree' && hasActiveFilters ? directMatches.length : filteredPages.length;

  const treeExpandDepth = hasActiveFilters ? 99 : 1;
  const treeRemountKey = `${personFilter}|${recencyFilter}|${docFilter}|${search}|${treeExpandDepth}`;

  const docTypesInSpace = useMemo(() => {
    if (!space?.docTypes) return [];
    return Object.entries(space.docTypes)
      .filter(([, count]) => count > 0)
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          (DOC_TYPE_LABELS[a[0]] || a[0]).localeCompare(DOC_TYPE_LABELS[b[0]] || b[0]),
      )
      .map(([id, count]) => ({
        id,
        label: DOC_TYPE_LABELS[id] || id,
        count,
      }));
  }, [space]);

  const pageTree = useMemo(() => buildPageTree(filteredPages), [filteredPages]);

  const paginationTotal = viewMode === 'tree' ? pageTree.length : filteredPages.length;
  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(paginationTotal, listPage, PAGE_SIZE);
  const pageMeta = paginationMeta(safePage, PAGE_SIZE, paginationTotal);
  const pagedFlatPages = useMemo(
    () => slicePage(filteredPages, safePage, PAGE_SIZE),
    [filteredPages, safePage],
  );
  const pagedTree = useMemo(
    () => slicePage(pageTree, safePage, PAGE_SIZE),
    [pageTree, safePage],
  );

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
  }

  function setViewModeAndReset(mode) {
    setViewMode(mode);
    setSearchParams(clearListPage(searchParams), { replace: true });
  }

  function updateParams(mutator) {
    const next = clearListPage(new URLSearchParams(searchParams));
    mutator(next);
    setSearchParams(next, { replace: true });
  }

  function setPersonFilter(value) {
    const name = (value || '').trim();
    setPersonDraft(name);
    if (name) setPersonPanelOpen(true);
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

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!space) return <div className="empty">Space not found.</div>;

  const category = catalog?.categories?.[space.category];
  const categoryLink = category ? `/category/${categoryId || space.category}` : null;

  return (
    <div className={categoryId ? 'space-page space-page-in-category' : 'space-page page-shell'}>
      <header className="space-hero">
        <div className="space-hero-top">
          {category && categoryLink ? (
            <Link to={categoryLink} className="space-hero-category">
              <span
                className="space-hero-category-dot"
                style={{ background: category.color }}
                aria-hidden
              />
              <span className="space-hero-category-label">{category.label}</span>
            </Link>
          ) : (
            <span className="space-hero-category-spacer" aria-hidden />
          )}
          <a
            href={space.confluenceUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm space-hero-confluence"
          >
            Open in Confluence ↗
          </a>
        </div>

        <div className="space-hero-body">
          <div className="space-hero-title-block">
            <h1 className="space-hero-title">{space.name}</h1>
            <p className="space-hero-key mono">{space.key}</p>
          </div>
          <div className="space-hero-stats" aria-label="Space summary">
            <div className="space-hero-stat">
              <span className="space-hero-stat-value">{formatNumber(space.pageCount)}</span>
              <span className="space-hero-stat-label">Pages</span>
            </div>
            <div className="space-hero-stat space-hero-stat-ok">
              <span className="space-hero-stat-value">{formatNumber(space.recency?.active || 0)}</span>
              <span className="space-hero-stat-label">Active</span>
            </div>
            <div className={`space-hero-stat${(space.staleCount || 0) > 0 ? ' space-hero-stat-warn' : ''}`}>
              <span className="space-hero-stat-value">{formatNumber(space.staleCount || 0)}</span>
              <span className="space-hero-stat-label">Need review</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid space-charts space-charts-compact">
        <div className="card card-compact">
          <h2 className="space-chart-title">By document type</h2>
          <BarChart data={space.docTypes} />
        </div>
        <div className="card card-compact">
          <h2 className="space-chart-title">By freshness</h2>
          <BarChart data={space.recency} maxItems={5} />
        </div>
      </div>

      <section className="space-person-panel card">
        <div className="space-person-head">
          <div>
            <h2 className="space-person-title">Filter by person</h2>
            <p className="space-person-hint">
              Find pages by last editor. Click a page title to preview on the right.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPersonPanelOpen((v) => !v)}
            aria-expanded={personPanelOpen}
          >
            {personPanelOpen ? 'Hide' : 'Show'}
          </button>
        </div>

        {personFilter && (
          <div className="space-person-active">
            <div className="space-person-active-info">
              <span className="space-person-active-label">Selected editor</span>
              <span className="space-person-active-name">{personFilter}</span>
            </div>
            <div className="space-person-active-actions">
              {personOutdatedPages.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setPersonRemindOpen(true)}
                >
                  Remind about all {formatNumber(personOutdatedPages.length)} outdated page
                  {personOutdatedPages.length === 1 ? '' : 's'}
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPersonFilter('')}>
                Clear
              </button>
            </div>
          </div>
        )}

        {personPanelOpen && (
          <div className="space-person-body">
            <div className="space-person-search">
              <input
                id="space-person-search"
                type="search"
                placeholder="Search last editors by name…"
                value={personDraft}
                onChange={(e) => setPersonDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const match = personList[0];
                    if (match) setPersonFilter(match.name);
                  }
                }}
                autoComplete="off"
              />
            </div>

            {!personFilter && (
              <>
                <p className="space-person-list-count">
                  {formatNumber(personList.length)} editor{personList.length !== 1 ? 's' : ''}
                  {personDraft.trim() ? ' matching search' : ' · most outdated first'}
                </p>
                {personList.length === 0 ? (
                  <p className="space-person-empty">No editors match that name.</p>
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
                            <span>{formatNumber(p.total)} pages</span>
                            {p.outdated > 0 && (
                              <span className="space-person-outdated">
                                {formatNumber(p.outdated)} outdated
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {personSummary && (
              <div className="space-person-result">
                <p className="space-person-result-label">Filter pages by freshness</p>
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
              </div>
            )}
          </div>
        )}
      </section>

      <div className="content-toolbar">
        <h2>
          Pages <span className="content-toolbar-count">{formatNumber(displayedPageCount)}</span>
        </h2>
        <div className="segmented" role="group" aria-label="View mode">
          <button
            type="button"
            className={viewMode === 'flat' ? 'active' : ''}
            onClick={() => setViewModeAndReset('flat')}
          >
            List
          </button>
          <button
            type="button"
            className={viewMode === 'tree' ? 'active' : ''}
            onClick={() => setViewModeAndReset('tree')}
          >
            Tree
          </button>
        </div>
      </div>

      <p className="space-preview-hint">Click a page title to preview details on the right.</p>

      <div className="space-page-filters">
        <div className="space-filter-search-row">
          <label className="space-filter-field space-filter-field-grow">
            <span className="space-filter-label">Search pages</span>
            <input
              type="search"
              placeholder="Filter by title…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchParams(clearListPage(searchParams), { replace: true });
              }}
              aria-label="Search page titles"
            />
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-sm space-filter-reset"
              onClick={clearAllFilters}
            >
              Reset filters
            </button>
          )}
        </div>

        {!personFilter && (
          <div className="space-filter-freshness">
            <span className="space-filter-label">Freshness</span>
            <div className="pill-group" role="group" aria-label="Freshness filter">
              {FRESHNESS_PILLS.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  className={`pill${recencyFilter === pill.id ? ' active' : ''}`}
                  onClick={() => setFreshness(pill.id)}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {personFilter && (
          <p className="space-filter-person-note">
            Freshness filters above apply to <strong>{personFilter}</strong>&apos;s pages.
          </p>
        )}

        {docTypesInSpace.length > 0 && (
          <div className="space-doc-type-filters">
            <span className="space-filter-label">Document type</span>
            <div className="doc-type-pills" role="group" aria-label="Document type">
              <button
                type="button"
                className={`doc-type-pill doc-type-all${docFilter === 'all' ? ' active' : ''}`}
                onClick={() => {
                  setDocFilter('all');
                  setSearchParams(clearListPage(searchParams), { replace: true });
                }}
              >
                All types
                <span className="doc-type-pill-count">{formatNumber(space.pageCount)}</span>
              </button>
              {docTypesInSpace.map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  className={`doc-type-pill ${docTypePillClass(id)}${docFilter === id ? ' active' : ''}`}
                  onClick={() => {
                    setDocFilter(id);
                    setSearchParams(clearListPage(searchParams), { replace: true });
                  }}
                >
                  {label}
                  <span className="doc-type-pill-count">{formatNumber(count)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filteredPages.length === 0 ? (
        <div className="empty review-empty card">
          <p>
            <strong>No pages match these filters.</strong>
          </p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Try clearing the person filter or choosing <strong>All</strong> freshness.
          </p>
        </div>
      ) : (
        <>
          {paginationTotal > PAGE_SIZE && (
            <p className="space-page-range" aria-live="polite">
              Showing {formatNumber(pageMeta.start)}–{formatNumber(pageMeta.end)} of{' '}
              {formatNumber(paginationTotal)}{' '}
              {viewMode === 'tree' ? 'top-level pages' : 'pages'}
              <span className="space-page-range-pages">
                {' '}
                · Page {pageMeta.safePage} of {pageMeta.pageCount}
              </span>
            </p>
          )}
          <PaginationBar
            page={safePage}
            pageSize={PAGE_SIZE}
            total={paginationTotal}
            onPageChange={setListPage}
            itemLabel={viewMode === 'tree' ? 'top-level pages' : 'pages'}
          >
            {viewMode === 'tree' ? (
              <>
                {hasActiveFilters && (
                  <p className="space-tree-filter-hint">
                    Showing {formatNumber(directMatches.length)} matching page
                    {directMatches.length !== 1 ? 's' : ''} in tree context — ancestor folders are
                    dimmed.
                  </p>
                )}
                {paginationTotal > PAGE_SIZE && (
                  <p className="space-tree-page-hint">
                    Tree view is paginated by top-level pages ({PAGE_SIZE} per page). Switch to List
                    for a flat paginated list of every page.
                  </p>
                )}
                <PageTree
                  key={treeRemountKey}
                  tree={pagedTree}
                  spaceKey={space.key || spaceKey}
                  routeContext={routeContext}
                  sidebarDetail
                  selectedPageId={searchParams.get('pageId') || ''}
                  defaultExpandedDepth={treeExpandDepth}
                  highlightPageIds={hasActiveFilters ? highlightPageIds : null}
                />
              </>
            ) : (
              <PageList
                pages={pagedFlatPages}
                spaceKey={space.key || spaceKey}
                routeContext={routeContext}
                sidebarDetail
                selectedPageId={searchParams.get('pageId') || ''}
              />
            )}
          </PaginationBar>
        </>
      )}

      {personRemindOpen && personFilter && personOutdatedPages.length > 0 && (
        <ReviewMessageModal
          editor={personFilter}
          pages={personOutdatedPages}
          site={catalog?.meta?.source}
          slackConfig={slackConfig}
          onClose={() => setPersonRemindOpen(false)}
        />
      )}
    </div>
  );
}
