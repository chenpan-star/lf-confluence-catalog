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
import { editorsAreSamePerson } from '../lib/personSearch';
import { formatNumber, DOC_TYPE_LABELS, RECENCY_LABELS, RECENCY_COLORS } from '../lib/labels';
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

function summarizePersonInSpace(pages, person) {
  const matched = pages.filter((p) => editorsAreSamePerson(accountablePerson(p), person));
  const counts = { active: 0, recent: 0, stale: 0, legacy: 0, unknown: 0 };
  for (const p of matched) {
    const r = p.recency || 'unknown';
    counts[r] = (counts[r] || 0) + 1;
  }
  const current = counts.active + counts.recent;
  const outdated = counts.stale + counts.legacy;
  return {
    total: matched.length,
    current,
    outdated,
    counts,
    pages: matched,
  };
}

export default function SpacePage() {
  const { spaceKey } = useParams();
  const outlet = useOutletContext() || {};
  const categoryId = outlet.categoryId;
  const inShell = Boolean(categoryId);
  const routeContext = { categoryId };
  const { catalog, resolveSpace, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docFilter, setDocFilter] = useState('all');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('tree');

  const personFilter = searchParams.get('person') || '';
  const space = resolveSpace(spaceKey);

  const peopleInSpace = useMemo(() => {
    if (!space?.pages) return [];
    const byName = new Map();
    for (const page of space.pages) {
      const person = accountablePerson(page);
      if (!person) continue;
      if (!byName.has(person)) {
        byName.set(person, { name: person, total: 0, outdated: 0 });
      }
      const row = byName.get(person);
      row.total += 1;
      if (page.recency === 'stale' || page.recency === 'legacy') row.outdated += 1;
    }
    return [...byName.values()].sort(
      (a, b) => b.outdated - a.outdated || b.total - a.total || a.name.localeCompare(b.name),
    );
  }, [space]);

  const personSummary = useMemo(() => {
    if (!space?.pages || !personFilter.trim()) return null;
    return summarizePersonInSpace(space.pages, personFilter.trim());
  }, [space, personFilter]);

  const filteredPages = useMemo(() => {
    if (!space?.pages) return [];
    const pages = space.pages || [];
    const matches = (p) => {
      if (docFilter !== 'all' && p.docType !== docFilter) return false;
      if (recencyFilter !== 'all' && p.recency !== recencyFilter) return false;
      if (personFilter.trim()) {
        if (!editorsAreSamePerson(accountablePerson(p), personFilter.trim())) return false;
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

  function resetListPage() {
    setSearchParams(clearListPage(searchParams), { replace: true });
  }

  function setPersonFilter(value) {
    const next = clearListPage(new URLSearchParams(searchParams));
    if (!value || value === 'all') next.delete('person');
    else next.set('person', value);
    setSearchParams(next, { replace: true });
  }

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
              ·{' '}
              <Link to={`/category/${space.category}`}>{category.label}</Link>
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
          {space.recency?.legacy > 0 && (
            <div className="stat">
              <span className="stat-value" style={{ color: 'var(--muted)' }}>
                {space.recency.legacy}
              </span>
              <span className="stat-label">Legacy</span>
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
          <h2 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            By document type
          </h2>
          <BarChart data={space.docTypes} />
        </div>
        <div className="card">
          <h2 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            By freshness
          </h2>
          <BarChart data={space.recency} maxItems={5} />
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
        Pages ({formatNumber(filteredPages.length)})
      </h2>

      <div className="view-toggle">
        <button
          type="button"
          className={viewMode === 'tree' ? 'active' : ''}
          onClick={() => {
            setViewMode('tree');
            resetListPage();
          }}
        >
          Tree view
        </button>
        <button
          type="button"
          className={viewMode === 'flat' ? 'active' : ''}
          onClick={() => setViewMode('flat')}
        >
          Flat list
        </button>
      </div>

      <div className="filters">
        <select
          value={personFilter || 'all'}
          onChange={(e) => setPersonFilter(e.target.value)}
          aria-label="Filter by person"
          className="filter-person"
        >
          <option value="all">All people</option>
          {peopleInSpace.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.outdated > 0 ? ` (${p.outdated} outdated)` : ''}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Filter by title…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetListPage();
          }}
          className="filter-search"
        />
        <select
          value={docFilter}
          onChange={(e) => {
            setDocFilter(e.target.value);
            resetListPage();
          }}
        >
          <option value="all">All types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={recencyFilter}
          onChange={(e) => {
            setRecencyFilter(e.target.value);
            resetListPage();
          }}
        >
          <option value="all">All freshness</option>
          {Object.entries(RECENCY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {personSummary && (
        <div className="card person-space-summary">
          <div className="person-space-summary-head">
            <h3>{personFilter}</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPersonFilter('all')}
            >
              Clear person filter
            </button>
          </div>
          <p className="person-space-summary-lead">
            Pages this person last edited (or created, when the last editor is unreachable) in{' '}
            <strong>{space.name}</strong>.
          </p>
          <div className="hygiene-stats person-space-stats">
            <div className="hygiene-stat card">
              <span className="hygiene-stat-value">{formatNumber(personSummary.total)}</span>
              <span className="hygiene-stat-label">Total pages</span>
            </div>
            <div className="hygiene-stat card">
              <span className="hygiene-stat-value" style={{ color: 'var(--green)' }}>
                {formatNumber(personSummary.current)}
              </span>
              <span className="hygiene-stat-label">Current (active + recent)</span>
            </div>
            <div className="hygiene-stat card hygiene-stat-warn">
              <span className="hygiene-stat-value">{formatNumber(personSummary.outdated)}</span>
              <span className="hygiene-stat-label">Outdated (stale + legacy)</span>
            </div>
          </div>
          <div className="person-freshness-breakdown">
            {['active', 'recent', 'stale', 'legacy'].map((key) => (
              <span key={key} className="person-freshness-chip">
                <span style={{ color: RECENCY_COLORS[key] }}>{formatNumber(personSummary.counts[key] || 0)}</span>{' '}
                {RECENCY_LABELS[key]}
              </span>
            ))}
          </div>
          {personSummary.outdated > 0 && (
            <p className="person-space-summary-tip">
              {formatNumber(personSummary.counts.stale)} stale (1–2 years) ·{' '}
              {formatNumber(personSummary.counts.legacy)} legacy (2+ years). Use the freshness filter
              below to show only outdated pages.
            </p>
          )}
        </div>
      )}

      {viewMode === 'tree' ? (
        <PageTree tree={pageTree} spaceKey={space.key || spaceKey} routeContext={routeContext} />
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
          />
        </PaginationBar>
      )}
    </>
  );
}
