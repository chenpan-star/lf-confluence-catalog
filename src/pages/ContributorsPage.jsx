import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import Pagination, { PaginationBar } from '../components/Pagination';
import { formatNumber } from '../lib/labels';
import {
  applyListPage,
  computePagination,
  readListPage,
  scrollToTop,
  slicePage,
  PAGE_SIZE,
} from '../lib/pagination';

export default function ContributorsPage() {
  const { catalog, loading, error } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const contributors = catalog?.contributors || [];

  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(contributors.length, listPage, PAGE_SIZE);
  const paginated = useMemo(
    () => slicePage(contributors, safePage, PAGE_SIZE),
    [contributors, safePage, listPage],
  );

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
    scrollToTop();
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Contributors</span>
      </nav>

      <header className="page-header">
        <h1>Confluence contributors</h1>
        <p>
          {formatNumber(catalog.meta.contributorCount || contributors.length)} people who created
          or edited pages. Search by name to find their pages, or browse outdated docs by person.
        </p>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Use this list to see who is active where. Search the catalog by person name, or browse
          outdated pages grouped by last editor.
        </p>
      </header>

      <div className="card" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>How to find someone&apos;s pages</h2>
        <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
          <li>
            Use <Link to="/search">Search</Link> and type their Confluence name or handle.
          </li>
          <li>
            Try <Link to="/review/editors">Send reminders</Link> to filter by person.
          </li>
          <li>
            Or use <Link to="/review/my-pages">Filter by name</Link> to look up pages by editor.
          </li>
        </ol>
      </div>

      <p className="result-count">
        {formatNumber(contributors.length)} contributor{contributors.length !== 1 ? 's' : ''}
      </p>

      <PaginationBar
        page={safePage}
        pageSize={PAGE_SIZE}
        total={contributors.length}
        onPageChange={setListPage}
        itemLabel={contributors.length === 1 ? 'contributor' : 'contributors'}
      >
        <ul className="page-list">
          {paginated.map((c) => (
          <li key={c.name} className="page-item contributor-row">
            <div>
              <strong>{c.name}</strong>
              <div className="page-subline">
                {formatNumber(c.totalEdits)} edits across {c.spaceCount} spaces
                {c.inferredDepartment && catalog.departments?.[c.inferredDepartment] && (
                  <> · Mostly active in {catalog.departments[c.inferredDepartment].label}</>
                )}
                {' · '}
                <Link to={`/search?q=${encodeURIComponent(c.name)}`}>Search their pages</Link>
              </div>
              <div className="contributor-spaces">
                Top spaces:{' '}
                {c.topSpaces.slice(0, 5).map((sp, i) => (
                  <span key={sp.spaceKey}>
                    {i > 0 && ', '}
                    <Link to={`/space/${encodeURIComponent(sp.spaceKey)}`}>{sp.spaceName}</Link>
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
        </ul>
      </PaginationBar>
    </>
  );
}
