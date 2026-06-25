import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { formatTitle } from '../lib/text';
import { formatDate, RECENCY_LABELS, RECENCY_COLORS } from '../lib/labels';
import { primaryContact } from '../lib/contact';
import { guessSlackHandle } from '../lib/slack';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { pageCatalogPath } from '../lib/pageTree';
import SlackReviewButton from './SlackReviewButton';

export default function StalePageRow({ page, compact = false }) {
  const { catalog } = useCatalog();
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const title = formatTitle(page.title);
  const localPath = pageCatalogPath(page, page.spaceKey);
  const confluenceUrl = toConfluenceUrl(page.url, site);
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const catalogPageUrl =
    localPath && typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${localPath}`
      : '';

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
            {contact && (
              <>
                {' '}
                · {contact}
                {handle && <span className="mono"> @{handle}</span>}
              </>
            )}
          </span>
        </div>
        <SlackReviewButton
          page={page}
          spaceName={page.spaceName}
          spaceKey={page.spaceKey}
          catalogPageUrl={catalogPageUrl}
          className="btn btn-sm btn-secondary"
        >
          Slack
        </SlackReviewButton>
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
      <td className="stale-cell-dept">
        {deptLabel ? (
          <Link to={`/department/${page.department}`}>{deptLabel}</Link>
        ) : (
          '—'
        )}
      </td>
      <td>{formatDate(page.lastModified)}</td>
      <td>
        {contact ? (
          <>
            {contact}
            {handle && <div className="stale-email-hint mono">@{handle} on Slack</div>}
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
        <SlackReviewButton
          page={page}
          spaceName={page.spaceName}
          spaceKey={page.spaceKey}
          catalogPageUrl={catalogPageUrl}
          className="btn btn-sm btn-primary"
        >
          Slack
        </SlackReviewButton>
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
