import { Link } from 'react-router-dom';
import { DOC_TYPE_LABELS, RECENCY_LABELS, RECENCY_COLORS, formatDate } from '../lib/labels';
import { formatTitle } from '../lib/text';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { useCatalog } from '../context/CatalogContext';
import { pageCatalogPath } from '../lib/pageTree';

export default function PageList({ pages, emptyMessage = 'No pages match your filters.', spaceKey, departmentId }) {
  const { catalog } = useCatalog();
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';

  if (!pages.length) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <ul className="page-list">
      {pages.map((page) => {
        const localPath = pageCatalogPath(page, spaceKey || page.spaceKey, departmentId);
        const confluenceUrl = toConfluenceUrl(page.url, site);
        const title = formatTitle(page.title);
        return (
        <li key={page.url || page.id || page.title} className="page-item">
          <div>
            {localPath ? (
              <Link to={localPath}>{title}</Link>
            ) : (
              <a href={confluenceUrl} target="_blank" rel="noreferrer">
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
