import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import BarChart from '../components/BarChart';
import PageList from '../components/PageList';
import PageTree from '../components/PageTree';
import { buildPageTree, filterPagesWithAncestors } from '../lib/pageTree';
import { formatTitle, normalizeForSearch } from '../lib/text';
import { pageMatchesPersonQuery } from '../lib/personSearch';
import { formatNumber, DOC_TYPE_LABELS, RECENCY_LABELS } from '../lib/labels';
import '../components/PageTree.css';

export default function SpacePage() {
  const { spaceKey } = useParams();
  const outlet = useOutletContext() || {};
  const categoryId = outlet.categoryId;
  const inShell = Boolean(categoryId);
  const routeContext = { categoryId };
  const { catalog, resolveSpace, loading, error } = useCatalog();
  const [docFilter, setDocFilter] = useState('all');
  const [recencyFilter, setRecencyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('tree');

  const space = resolveSpace(spaceKey);

  const filteredPages = useMemo(() => {
    if (!space?.pages) return [];
    const pages = space.pages || [];
    const matches = (p) => {
      if (docFilter !== 'all' && p.docType !== docFilter) return false;
      if (recencyFilter !== 'all' && p.recency !== recencyFilter) return false;
      if (search) {
        const q = normalizeForSearch(search);
        const titleMatch = normalizeForSearch(p.title).includes(q);
        const personMatch = pageMatchesPersonQuery(search, p);
        if (!titleMatch && !personMatch) return false;
      }
      return true;
    };
    if (viewMode === 'tree') {
      return filterPagesWithAncestors(pages, matches);
    }
    return pages.filter(matches);
  }, [space, docFilter, recencyFilter, search, viewMode]);

  const pageTree = useMemo(() => buildPageTree(filteredPages), [filteredPages]);

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
        {space.owner?.name?.trim() && (
          <p className="space-owner-header">
            <strong>Maintainer:</strong> {space.owner.name}
            {space.owner.email && (
              <>
                {' '}
                ·{' '}
                <a href={`mailto:${space.owner.email}`}>{space.owner.email}</a>
              </>
            )}
          </p>
        )}
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
          onClick={() => setViewMode('tree')}
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
        <input
          type="search"
          placeholder="Filter by title or person…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-search"
        />
        <select value={docFilter} onChange={(e) => setDocFilter(e.target.value)}>
          <option value="all">All types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={recencyFilter} onChange={(e) => setRecencyFilter(e.target.value)}>
          <option value="all">All freshness</option>
          {Object.entries(RECENCY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {viewMode === 'tree' ? (
        <PageTree tree={pageTree} spaceKey={space.key || spaceKey} routeContext={routeContext} />
      ) : (
        <PageList
          pages={filteredPages}
          spaceKey={space.key || spaceKey}
          routeContext={routeContext}
        />
      )}
    </>
  );
}
