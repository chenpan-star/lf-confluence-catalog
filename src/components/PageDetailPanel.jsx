import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { isAnonymousEditor, lastEditorLabel, primaryContact, usesCreatorFallback } from '../lib/contact';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { clearSidebarPageDetail } from '../lib/reviewPaths';
import { formatTitle } from '../lib/text';
import { DOC_TYPE_LABELS, RECENCY_COLORS, RECENCY_LABELS, formatDate } from '../lib/labels';
import { guessSlackHandle } from '../lib/slack';
import SlackReviewButton from './SlackReviewButton';
import './PageDetailPanel.css';

function findPage(space, pageId) {
  if (!space?.pages || !pageId) return null;
  const id = String(pageId);
  return space.pages.find(
    (p) => (p.id && String(p.id) === id) || (p.url && p.url.includes(`/pages/${id}`)),
  );
}

export default function PageDetailPanel({ spaceKey, pageId }) {
  const { catalog, resolveSpace } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const space = resolveSpace(spaceKey);
  const page = findPage(space, pageId);
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';

  function closePanel() {
    setSearchParams(clearSidebarPageDetail(searchParams), { replace: true });
  }

  if (!page) {
    return (
      <aside className="page-detail-rail" aria-label="Page detail">
        <div className="sidebar-page-panel">
          <div className="sidebar-page-panel-head">
            <p className="sidebar-section-title">Page detail</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={closePanel} aria-label="Close">
              ✕
            </button>
          </div>
          <p className="sidebar-page-footnote">Page not found in catalog snapshot.</p>
        </div>
      </aside>
    );
  }

  const title = formatTitle(page.title);
  const confluenceUrl = toConfluenceUrl(page.url, site);
  const editorRaw = lastEditorLabel(page);
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const anonymous = isAnonymousEditor(editorRaw);
  const viaCreator = usesCreatorFallback(page);
  const category = space ? catalog?.categories?.[space.category] : null;
  const catalogPageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${window.location.pathname}?${searchParams}`
      : '';

  return (
    <aside className="page-detail-rail" aria-label="Page detail">
      <div className="sidebar-page-panel">
        <div className="sidebar-page-panel-head">
          <p className="sidebar-section-title">Page detail</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={closePanel} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="sidebar-page-title">{title}</h3>

        <dl className="sidebar-page-meta">
          <dt>Space</dt>
          <dd>{space?.name || spaceKey}</dd>
          {category && (
            <>
              <dt>Category</dt>
              <dd>{category.label}</dd>
            </>
          )}
          <dt>Last updated</dt>
          <dd>{formatDate(page.lastModified)}</dd>
          {page.createdAt && (
            <>
              <dt>Created</dt>
              <dd>{formatDate(page.createdAt)}</dd>
            </>
          )}
          {editorRaw && (
            <>
              <dt>Last editor</dt>
              <dd>
                {editorRaw}
                {anonymous && (
                  <span className="sidebar-page-note">
                    Confluence did not record a named editor for the last change.
                  </span>
                )}
              </dd>
            </>
          )}
          {page.creator && (
            <>
              <dt>Creator</dt>
              <dd>{page.creator}</dd>
            </>
          )}
          {contact && (
            <>
              <dt>Contact</dt>
              <dd>
                {contact}
                {viaCreator && (
                  <span className="sidebar-page-note">Matched via creator — last editor was unreachable.</span>
                )}
                {handle && <span className="mono"> @{handle}</span>}
              </dd>
            </>
          )}
          <dt>Freshness</dt>
          <dd>
            <span style={{ color: RECENCY_COLORS[page.recency] || 'inherit' }}>
              {RECENCY_LABELS[page.recency] || page.recency}
            </span>
          </dd>
          <dt>Type</dt>
          <dd>{DOC_TYPE_LABELS[page.docType] || page.docType || '—'}</dd>
        </dl>

        <div className="sidebar-page-actions">
          <a href={confluenceUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
            Open in Confluence ↗
          </a>
          {(page.recency === 'stale' || page.recency === 'legacy') && space && (
            <SlackReviewButton
              page={page}
              spaceName={space.name}
              spaceKey={space.key || spaceKey}
              catalogPageUrl={catalogPageUrl}
              className="btn btn-sm btn-secondary"
            >
              Remind
            </SlackReviewButton>
          )}
        </div>

        <p className="sidebar-page-footnote">
          Metadata only — full content is in Confluence.
          {anonymous && page.creator && (
            <>
              {' '}
              For reminders, we use the <strong>creator</strong> when the last editor is Anonymous.
            </>
          )}
        </p>
      </div>
    </aside>
  );
}
