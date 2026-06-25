import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { parseConfluencePagePath, toConfluenceUrl } from '../lib/confluenceUrl';
import { spaceScopePath } from '../lib/spacePaths';
import { catalogPagePath, pageCatalogPath } from '../lib/pageTree';
import { formatTitle } from '../lib/text';
import { DOC_TYPE_LABELS, RECENCY_LABELS, RECENCY_COLORS, formatDate } from '../lib/labels';
import DepartmentSourceNote from '../components/DepartmentSourceNote';
import SlackReviewButton from '../components/SlackReviewButton';

function findPage(space, pageId) {
  if (!space?.pages) return null;
  const id = String(pageId);
  return space.pages.find(
    (p) =>
      (p.id && String(p.id) === id) ||
      (p.url && p.url.includes(`/pages/${id}`)),
  );
}

export default function ConfluencePageRoute() {
  const { pathname } = useLocation();
  const { catalog, loading, resolveSpace } = useCatalog();
  const parsed = parseConfluencePagePath(pathname);

  if (loading) return <div className="loading">Loading…</div>;
  if (!parsed) return <div className="empty">Invalid page path.</div>;
  if (!catalog) return <div className="loading">Loading…</div>;

  const { spaceKey, pageId, departmentId, categoryId } = parsed;
  const space = resolveSpace(spaceKey);
  const page = findPage(space, pageId);
  const inShell = Boolean(departmentId || categoryId);
  const routeContext = { departmentId, categoryId };

  const spacePath = inShell
    ? spaceScopePath(
        categoryId ? { type: 'category', id: categoryId } : { type: 'department', id: departmentId },
        spaceKey,
      )
    : `/space/${encodeURIComponent(spaceKey)}`;

  const pathForPage = (p) => pageCatalogPath(p, spaceKey, routeContext) || catalogPagePath(p?.url);

  const site = catalog.meta?.source || 'lotusflare.atlassian.net';
  const confluenceUrl = page
    ? toConfluenceUrl(page.url, site)
    : `https://${site}/wiki/spaces/${spaceKey}/pages/${pageId}`;

  const department = space ? catalog.departments?.[space.department] : null;
  const category = space ? catalog.categories?.[space.category] : null;
  const parentPage = page?.parentId
    ? findPage(space, page.parentId) || space?.pages?.find((p) => p.id === page.parentId)
    : null;
  const parentPath = parentPage ? pathForPage(parentPage) : null;

  const catalogPageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${pathname}`
      : '';

  if (!page) {
    return (
      <div className="empty">
        <p>Page not found in local catalog snapshot.</p>
        {!space && (
          <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
            Space <span className="mono">{spaceKey}</span> was not found either.
          </p>
        )}
        <p style={{ marginTop: '1rem' }}>
          <a href={confluenceUrl} target="_blank" rel="noreferrer">
            Open in Confluence ↗
          </a>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to={spacePath}>← Back to {spaceKey} space</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      {!inShell && (
        <nav className="breadcrumb breadcrumb-compact">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/spaces">Spaces</Link>
          <span>/</span>
          {category && space && (
            <>
              <Link to={`/category/${space.category}`}>{category.label}</Link>
              <span>/</span>
            </>
          )}
          {space && (
            <>
              <Link to={spacePath}>{space.name}</Link>
              <span>/</span>
            </>
          )}
          {parentPage && (
            <>
              {parentPath ? (
                <Link to={parentPath}>{formatTitle(parentPage.title)}</Link>
              ) : (
                <span>{formatTitle(parentPage.title)}</span>
              )}
              <span>/</span>
            </>
          )}
          <span>{formatTitle(page.title)}</span>
        </nav>
      )}

      <header className="page-header">
        <h1>{formatTitle(page.title)}</h1>
        <p>
          <span className="mono">{spaceKey}</span> · Page ID {pageId}
          {page.parentId && (
            <>
              {' '}
              · Parent:{' '}
              {parentPath ? (
                <Link to={parentPath}>
                  {formatTitle(page.parentTitle || parentPage?.title || page.parentId)}
                </Link>
              ) : (
                formatTitle(page.parentTitle || page.parentId)
              )}
            </>
          )}
        </p>
        {space?.owner?.name?.trim() && (
          <p className="space-owner-header">
            <strong>Space maintainer:</strong> {space.owner.name}
            {space.owner.email && (
              <>
                {' '}
                ·{' '}
                <a href={`mailto:${space.owner.email}`}>{space.owner.email}</a>
              </>
            )}
          </p>
        )}
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
          <dd>
            <span style={{ color: RECENCY_COLORS[page.recency] || 'inherit' }}>
              {RECENCY_LABELS[page.recency] || page.recency}
            </span>
          </dd>
          {page.childCount > 0 && (
            <>
              <dt>Child pages</dt>
              <dd>{page.childCount}</dd>
            </>
          )}
        </dl>
      </div>

      <div
        className="page-actions"
      >
        <a
          className="btn btn-primary"
          href={confluenceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open in Confluence ↗
        </a>
        {(page.recency === 'stale' || page.recency === 'legacy') && space && (
          <SlackReviewButton
            page={page}
            spaceName={space.name}
            spaceKey={space.key || spaceKey}
            catalogPageUrl={catalogPageUrl}
            className="btn btn-warn"
          >
            Message editor on Slack
          </SlackReviewButton>
        )}
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        This catalog shows metadata only. Page content lives in Confluence.
      </p>
    </>
  );
}
