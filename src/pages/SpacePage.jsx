import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import PageHeader from '../components/PageHeader';
import BarChart from '../components/BarChart';
import PageList from '../components/PageList';
import PageTree from '../components/PageTree';
import { PaginationBar } from '../components/Pagination';
import { buildPageTree, filterPagesWithAncestors } from '../lib/pageTree';
import { normalizeForSearch } from '../lib/text';
import { accountablePerson } from '../lib/contact';
import { editorsAreSamePerson, personMatchesQuery } from '../lib/personSearch';
import { formatNumber, DOC_TYPE_LABELS } from '../lib/labels';
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
  const routeContext = { categoryId };
  const { catalog, resolveSpace, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docFilter, setDocFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [personDraft, setPersonDraft] = useState(searchParams.get('person') || '');
  const [viewMode, setViewMode] = useState('flat');
  const [personPanelOpen, setPersonPanelOpen] = useState(Boolean(searchParams.get('person')));

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
    <div className="page-shell">
      <PageHeader
        title={space.name}
        actions={
          <a href={space.confluenceUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Open in Confluence ↗
          </a>
        }
      >
        <span className="mono">{space.key}</span>
        {category && !categoryId && (
          <>
            {' '}
            · <Link to={`/category/${space.category}`}>{category.label}</Link>
          </>
        )}
      </PageHeader>

      <div className="space-stats-bar" aria-label="Space summary">
        <div className="space-stat">
          <span className="space-stat-value">{formatNumber(space.pageCount)}</span>
          <span className="space-stat-label">Total pages</span>
        </div>
        <div className="space-stat space-stat-ok">
          <span className="space-stat-value">{formatNumber(space.recency?.active || 0)}</span>
          <span className="space-stat-label">Active</span>
        </div>
        <div className={`space-stat${(space.staleCount || 0) > 0 ? ' space-stat-warn' : ''}`}>
          <span className="space-stat-value">{formatNumber(space.staleCount || 0)}</span>
          <span className="space-stat-label">Need review</span>
        </div>
      </div>

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
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPersonFilter('')}>
              Clear
            </button>
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
          Pages <span className="content-toolbar-count">{formatNumber(filteredPages.length)}</span>
        </h2>
        <div className="segmented" role="group" aria-label="View mode">
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
      )}

      <div className="filter-panel-row" style={{ marginBottom: '1.25rem' }}>
        <input
          type="search"
          placeholder="Search page titles…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchParams(clearListPage(searchParams), { replace: true });
          }}
          aria-label="Search page titles"
        />
        <select
          value={docFilter}
          onChange={(e) => {
            setDocFilter(e.target.value);
            setSearchParams(clearListPage(searchParams), { replace: true });
          }}
          aria-label="Document type"
        >
          <option value="all">All types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
            Reset filters
          </button>
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
    </div>
  );
}
