import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { DOC_TYPE_LABELS, RECENCY_LABELS, RECENCY_COLORS, formatDate } from '../lib/labels';
import { formatTitle } from '../lib/text';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { useCatalog } from '../context/CatalogContext';
import { pageCatalogPath } from '../lib/pageTree';
import { buildSidebarPageHref } from '../lib/reviewPaths';

export default function PageList({
  pages,
  emptyMessage = 'No pages match your filters.',
  spaceKey,
  routeContext,
  departmentId,
  sidebarDetail = false,
  selectedPageId = '',
}) {
  const ctx = routeContext || (departmentId ? { departmentId } : {});
  const { catalog } = useCatalog();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';

  if (!pages.length) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <ul className="page-list">
      {pages.map((page) => {
        const key = spaceKey || page.spaceKey;
        const localPath = pageCatalogPath(page, key, ctx);
        const confluenceUrl = toConfluenceUrl(page.url, site);
        const title = formatTitle(page.title);
        const selected = selectedPageId && String(page.id) === String(selectedPageId);
        const sidebarHref =
          sidebarDetail && page.id
            ? buildSidebarPageHref(pathname, searchParams, page, key)
            : null;

        return (
          <li
            key={page.url || page.id || page.title}
            className={`page-item${selected ? ' page-item-selected' : ''}`}
          >
            <div>
              {sidebarHref ? (
                <Link to={sidebarHref} replace className="page-title-link">
                  {title}
                </Link>
              ) : localPath ? (
                <Link to={localPath} className="page-title-link">
                  {title}
                </Link>
              ) : (
                <a href={confluenceUrl} target="_blank" rel="noreferrer" className="page-title-link">
                  {title}
                </a>
              )}
              <div className="page-subline">
                <span>Updated {formatDate(page.lastModified)}</span>
                {page.parentTitle && <span> · Parent: {page.parentTitle}</span>}
                {page.creator && <span> · Created by {page.creator}</span>}
                {page.lastEditor && page.lastEditor !== page.creator && (
                  <span> · Edited by {page.lastEditor}</span>
                )}
              </div>
            </div>
            <div className="page-meta">
              <span className="badge">{DOC_TYPE_LABELS[page.docType] || page.docType}</span>
              <span
                className="badge"
                style={{ color: RECENCY_COLORS[page.recency] || 'inherit' }}
              >
                {RECENCY_LABELS[page.recency] || page.recency}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
