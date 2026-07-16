import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { formatTitle } from '../lib/text';
import { formatDate, RECENCY_LABELS, RECENCY_COLORS } from '../lib/labels';
import { isAnonymousEditor, lastEditorLabel, primaryContact, usesCreatorFallback } from '../lib/contact';
import { guessSlackHandle } from '../lib/slack';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { pageCatalogPath } from '../lib/pageTree';
import { buildSidebarPageHref } from '../lib/reviewPaths';
import SlackReviewButton from './SlackReviewButton';

export default function StalePageRow({
  page,
  compact = false,
  showCategory = false,
  reviewDetail = false,
  selected = false,
}) {
  const { catalog } = useCatalog();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const title = formatTitle(page.title);
  const localPath = pageCatalogPath(page, page.spaceKey);
  const sidebarHref =
    reviewDetail && page.id
      ? buildSidebarPageHref(pathname, searchParams, page, page.spaceKey)
      : null;
  const titleTo = sidebarHref || localPath;
  const confluenceUrl = toConfluenceUrl(page.url, site);
  const contact = primaryContact(page);
  const editorRaw = lastEditorLabel(page);
  const anonymous = isAnonymousEditor(editorRaw);
  const viaCreator = usesCreatorFallback(page);
  const handle = guessSlackHandle(contact);
  const catalogPageUrl =
    localPath && typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${localPath}`
      : '';

  const catLabel = catalog?.categories?.[page.spaceCategory]?.label;
  const rowClass = `stale-row${compact ? ' compact' : ''}${selected ? ' stale-row-selected' : ''}`;

  const titleLink =
    titleTo && !reviewDetail ? (
      <Link to={titleTo} className="stale-title">
        {title}
      </Link>
    ) : titleTo && reviewDetail ? (
      <Link to={titleTo} className="stale-title" replace>
        {title}
      </Link>
    ) : (
      <a href={confluenceUrl} target="_blank" rel="noreferrer" className="stale-title">
        {title} ↗
      </a>
    );

  if (compact) {
    return (
      <li className={rowClass}>
        <div className="stale-row-main">
          {titleLink}
          <span className="stale-meta">
            {page.spaceName} · {formatDate(page.lastModified)}
            {contact && (
              <>
                {' '}
                · {contact}
                {viaCreator && (
                  <span className="stale-anon-hint" title="Last editor was unreachable; showing creator">
                    {' '}
                    (via creator)
                  </span>
                )}
                {anonymous && editorRaw && !viaCreator && (
                  <span className="stale-anon-hint" title="Last edit was unattributed in Confluence">
                    {' '}
                    (Anonymous edit)
                  </span>
                )}
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
          Remind
        </SlackReviewButton>
      </li>
    );
  }

  return (
    <tr className={`stale-table-row${selected ? ' stale-row-selected' : ''}`}>
      <td className="stale-cell-title">
        {titleTo ? (
          reviewDetail ? (
            <Link to={titleTo} replace>
              {title}
            </Link>
          ) : (
            <Link to={titleTo}>{title}</Link>
          )
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
      {showCategory && (
        <td className="stale-cell-cat">
          {page.spaceCategory ? (
            <Link to={`/category/${page.spaceCategory}`}>{catLabel || page.spaceCategory}</Link>
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
            {viaCreator && (
              <div className="stale-email-hint">Contact via creator (last editor unreachable)</div>
            )}
            {anonymous && editorRaw && !viaCreator && (
              <div className="stale-email-hint">Last edit: Anonymous</div>
            )}
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
          Remind
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
