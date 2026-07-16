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

function DetailField({ label, children }) {
  if (!children) return null;
  return (
    <div className="detail-field">
      <span className="detail-field-label">{label}</span>
      <div className="detail-field-value">{children}</div>
    </div>
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
        <div className="detail-panel">
          <header className="detail-panel-head">
            <button type="button" className="detail-close" onClick={closePanel} aria-label="Close">
              ✕
            </button>
          </header>
          <div className="detail-panel-empty">
            <p>Page not found in catalog snapshot.</p>
          </div>
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
  const recencyLabel = RECENCY_LABELS[page.recency] || page.recency;
  const recencyColor = RECENCY_COLORS[page.recency] || 'var(--text-muted)';
  const isOutdated = page.recency === 'stale' || page.recency === 'legacy';
  const catalogPageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${window.location.pathname}?${searchParams}`
      : '';

  return (
    <aside className="page-detail-rail" aria-label="Page detail">
      <div className="detail-panel">
        <header className="detail-panel-head">
          <span
            className={`detail-freshness-pill${isOutdated ? ' detail-freshness-pill-warn' : ''}`}
            style={{ '--pill-color': recencyColor }}
          >
            {recencyLabel}
          </span>
          <button type="button" className="detail-close" onClick={closePanel} aria-label="Close">
            ✕
          </button>
        </header>

        <h2 className="detail-panel-title">{title}</h2>

        <p className="detail-panel-context">
          {space?.name || spaceKey}
          {category && (
            <>
              <span className="detail-panel-dot" aria-hidden>
                ·
              </span>
              {category.label}
            </>
          )}
        </p>

        <div className="detail-panel-actions">
          <a href={confluenceUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
            Open in Confluence ↗
          </a>
          {isOutdated && space && (
            <SlackReviewButton
              page={page}
              spaceName={space.name}
              spaceKey={space.key || spaceKey}
              catalogPageUrl={catalogPageUrl}
              className="btn btn-sm btn-secondary"
            >
              Send reminder
            </SlackReviewButton>
          )}
        </div>

        <div className="detail-panel-section">
          <h3 className="detail-panel-section-title">People</h3>
          <div className="detail-panel-fields">
            <DetailField label="Last editor">
              {editorRaw}
              {anonymous && (
                <span className="detail-note">No named editor on the last change.</span>
              )}
            </DetailField>
            {page.creator && <DetailField label="Creator">{page.creator}</DetailField>}
            {contact && (
              <DetailField label="Contact">
                {contact}
                {handle && <span className="detail-slack mono">@{handle}</span>}
                {viaCreator && (
                  <span className="detail-note">Using creator — last editor was unreachable.</span>
                )}
              </DetailField>
            )}
          </div>
        </div>

        <div className="detail-panel-section">
          <h3 className="detail-panel-section-title">Document</h3>
          <div className="detail-panel-fields">
            <DetailField label="Type">
              {DOC_TYPE_LABELS[page.docType] || page.docType || '—'}
            </DetailField>
            <DetailField label="Last updated">{formatDate(page.lastModified)}</DetailField>
            {page.createdAt && <DetailField label="Created">{formatDate(page.createdAt)}</DetailField>}
          </div>
        </div>

        <p className="detail-panel-footnote">
          Metadata from the catalog snapshot — open Confluence for full content.
          {anonymous && page.creator && (
            <> Reminders use the <strong>creator</strong> when the last editor is Anonymous.</>
          )}
        </p>
      </div>
    </aside>
  );
}
