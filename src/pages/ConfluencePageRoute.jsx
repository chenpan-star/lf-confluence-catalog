import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { parseConfluencePagePath, toConfluenceUrl } from '../lib/confluenceUrl';
import { DOC_TYPE_LABELS, RECENCY_LABELS, formatDate } from '../lib/labels';

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
        <Link to="/">Categories</Link>
        <span>/</span>
        {space && (
          <>
            <Link to={`/category/${space.category}`}>
              {catalog.categories[space.category]?.label}
            </Link>
            <span>/</span>
            <Link to={`/space/${encodeURIComponent(spaceKey)}`}>{space.name}</Link>
            <span>/</span>
          </>
        )}
        <span>{page.title}</span>
      </nav>

      <header className="page-header">
        <h1>{page.title}</h1>
        <p>
          <span className="mono">{spaceKey}</span> · Page ID {pageId}
        </p>
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
        </dl>
      </div>

      <p>
        <a className="card card-link" href={confluenceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '0.75rem 1.25rem' }}>
          Read full page in Confluence ↗
        </a>
      </p>
      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        This catalog shows metadata only. Page content lives in Confluence.
      </p>
    </>
  );
}
