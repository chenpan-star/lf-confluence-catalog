import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { parseConfluencePagePath, toConfluenceUrl } from '../lib/confluenceUrl';
import { catalogPagePath } from '../lib/pageTree';
import { formatTitle } from '../lib/text';
import { DOC_TYPE_LABELS, RECENCY_LABELS, formatDate } from '../lib/labels';
import { DepartmentSourceNote } from './ContributorsPage';

export default function ConfluencePageRoute() {
  const { pathname } = useLocation();
  const { catalog, loading, spacesByKey } = useCatalog();
  const parsed = parseConfluencePagePath(pathname);

  if (loading) return <div className="loading">Loading…</div>;
  if (!parsed) return <div className="empty">Invalid page path.</div>;

  const { spaceKey, pageId } = parsed;
  const space = spacesByKey[spaceKey];
  const page = space?.pages?.find(
    (p) => p.id === pageId || p.url.includes(`/pages/${pageId}`),
  );

  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const confluenceUrl = page
    ? toConfluenceUrl(page.url, site)
    : `https://${site}/wiki/spaces/${spaceKey}/pages/${pageId}`;

  const department = space ? catalog.departments?.[space.department] : null;
  const parentPage =
    page?.parentId && space?.pages?.find((p) => p.id === page.parentId);
  const parentPath = parentPage ? catalogPagePath(parentPage.url) : null;

  if (!page) {
    return (
      <div className="empty">
        <p>Page not found in local catalog snapshot.</p>
        <p style={{ marginTop: '1rem' }}>
          <a href={confluenceUrl} target="_blank" rel="noreferrer">
            Open in Confluence ↗
          </a>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to={`/space/${encodeURIComponent(spaceKey)}`}>← Back to {spaceKey} space</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/departments">Departments</Link>
        <span>/</span>
        {department && space && (
          <>
            <Link to={`/department/${space.department}`}>{department.label}</Link>
            <span>/</span>
          </>
        )}
        {space && (
          <>
            <Link to={`/space/${encodeURIComponent(spaceKey)}`}>{space.name}</Link>
            <span>/</span>
          </>
        )}
        {parentPage && (
          <>
            {parentPath ? (
              <Link to={parentPath}>{parentPage.title}</Link>
            ) : (
              <span>{parentPage.title}</span>
            )}
            <span>/</span>
          </>
        )}
        <span>{formatTitle(page.title)}</span>
      </nav>

      <header className="page-header">
        <h1>{formatTitle(page.title)}</h1>
        <p>
          <span className="mono">{spaceKey}</span> · Page ID {pageId}
          {page.parentId && (
            <>
              {' '}
              · Parent:{' '}
              {parentPath ? (
                <Link to={parentPath}>{page.parentTitle || parentPage?.title || page.parentId}</Link>
              ) : (
                page.parentTitle || page.parentId
              )}
            </>
          )}
        </p>
        {space && <DepartmentSourceNote space={space} catalog={catalog} />}
      </header>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <dl className="page-detail-grid">
          <dt>Last updated</dt>
          <dd>{formatDate(page.lastModified)}</dd>
          {page.createdAt && (
            <>
              <dt>Created</dt>
              <dd>{formatDate(page.createdAt)}</dd>
            </>
          )}
          {page.creator && (
            <>
              <dt>Creator</dt>
              <dd>{page.creator}</dd>
            </>
          )}
          {page.lastEditor && (
            <>
              <dt>Last editor</dt>
              <dd>{page.lastEditor}</dd>
            </>
          )}
          <dt>Document type</dt>
          <dd>{DOC_TYPE_LABELS[page.docType] || page.docType}</dd>
          <dt>Freshness</dt>
          <dd>{RECENCY_LABELS[page.recency] || page.recency}</dd>
          {page.childCount > 0 && (
            <>
              <dt>Child pages</dt>
              <dd>{page.childCount}</dd>
            </>
          )}
        </dl>
      </div>

      <p>
        <a
          className="card card-link"
          href={confluenceUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-block', padding: '0.75rem 1.25rem' }}
        >
          Read full page in Confluence ↗
        </a>
      </p>
      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        This catalog shows metadata only. Page content lives in Confluence.
      </p>
    </>
  );
}
