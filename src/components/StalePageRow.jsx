import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { formatTitle } from '../lib/text';
import { formatDate, RECENCY_LABELS, RECENCY_COLORS } from '../lib/labels';
import { buildReviewMailto, primaryContact, guessEmail } from '../lib/contact';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { catalogPagePath } from '../lib/pageTree';

export default function StalePageRow({ page, compact = false }) {
  const { catalog } = useCatalog();
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const title = formatTitle(page.title);
  const localPath = page.id
    ? `/spaces/${encodeURIComponent(page.spaceKey)}/pages/${page.id}`
    : catalogPagePath(page.url);
  const confluenceUrl = toConfluenceUrl(page.url, site);
  const contact = primaryContact(page);
  const email = guessEmail(contact);
  const mailto = buildReviewMailto({
    page,
    spaceName: page.spaceName,
    spaceKey: page.spaceKey,
    site,
    catalogPageUrl:
      localPath && typeof window !== 'undefined'
        ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${localPath}`
        : '',
  });

  const deptLabel = catalog?.departments?.[page.department]?.label;

  if (compact) {
    return (
      <li className="stale-row compact">
        <div className="stale-row-main">
          {localPath ? (
            <Link to={localPath} className="stale-title">
              {title}
            </Link>
          ) : (
            <a href={confluenceUrl} target="_blank" rel="noreferrer" className="stale-title">
              {title} ↗
            </a>
          )}
          <span className="stale-meta">
            {page.spaceName} · {formatDate(page.lastModified)}
            {contact && <> · {contact}</>}
          </span>
        </div>
        <a href={mailto} className="btn btn-sm btn-secondary">
          Request review
        </a>
      </li>
    );
  }

  return (
    <tr className="stale-table-row">
      <td className="stale-cell-title">
        {localPath ? (
          <Link to={localPath}>{title}</Link>
        ) : (
          <a href={confluenceUrl} target="_blank" rel="noreferrer">
            {title} ↗
          </a>
        )}
      </td>
      <td>
        <Link to={`/space/${encodeURIComponent(page.spaceKey)}`}>{page.spaceName}</Link>
        <div className="mono stale-key">{page.spaceKey}</div>
      </td>
      {!compact && (
        <td className="stale-cell-dept">
          {deptLabel ? (
            <Link to={`/department/${page.department}`}>{deptLabel}</Link>
          ) : (
            '—'
          )}
        </td>
      )}
      <td>{formatDate(page.lastModified)}</td>
      <td>
        {contact ? (
          <>
            {contact}
            {email && <div className="stale-email-hint mono">{email}</div>}
          </>
        ) : (
          '—'
        )}
      </td>
      <td>
        <span className="badge" style={{ color: RECENCY_COLORS[page.recency] }}>
          {RECENCY_LABELS[page.recency]}
        </span>
      </td>
      <td className="stale-actions">
        <a href={mailto} className="btn btn-sm btn-primary" title="Email editor to review this page">
          Request review
        </a>
        <a
          href={confluenceUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm btn-secondary"
        >
          Confluence ↗
        </a>
      </td>
    </tr>
  );
}
