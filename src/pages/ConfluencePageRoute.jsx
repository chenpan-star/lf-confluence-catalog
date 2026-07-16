import { Link, Navigate, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { parseConfluencePagePath } from '../lib/confluenceUrl';
import { spaceScopePath } from '../lib/spacePaths';

function findPage(space, pageId) {
  if (!space?.pages) return null;
  const id = String(pageId);
  return space.pages.find(
    (p) =>
      (p.id && String(p.id) === id) ||
      (p.url && p.url.includes(`/pages/${id}`)),
  );
}

/** Old page URLs redirect into the space view with sidebar page detail. */
export default function ConfluencePageRoute() {
  const { pathname } = useLocation();
  const { catalog, loading, resolveSpace } = useCatalog();
  const parsed = parseConfluencePagePath(pathname);

  if (loading) return <div className="loading">Loading…</div>;
  if (!parsed) return <div className="empty">Invalid page path.</div>;
  if (!catalog) return <div className="loading">Loading…</div>;

  const { spaceKey, pageId, categoryId } = parsed;
  const space = resolveSpace(spaceKey);
  const page = findPage(space, pageId);
  const inShell = Boolean(categoryId);

  const spacePath = inShell
    ? spaceScopePath({ type: 'category', id: categoryId }, spaceKey)
    : `/space/${encodeURIComponent(spaceKey)}`;

  if (page?.id) {
    const params = new URLSearchParams({
      pageId: String(page.id),
      pageSpace: space?.key || spaceKey,
    });
    return <Navigate to={`${spacePath}?${params.toString()}`} replace />;
  }

  const site = catalog.meta?.source || 'lotusflare.atlassian.net';
  const confluenceUrl = `https://${site}/wiki/spaces/${spaceKey}/pages/${pageId}`;

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
