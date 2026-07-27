import { useState } from 'react';
import { isBotEditor } from '../lib/editorReview';
import { formatNumber } from '../lib/labels';
import StalePageRow from './StalePageRow';
import './HygieneHelp.css';

export default function EditorReviewCard({
  group,
  onMessageAll,
  reviewDetail = false,
  detailSpaceKey = '',
  detailPageId = '',
}) {
  const [expanded, setExpanded] = useState(false);
  const bot = isBotEditor(group.editor);

  const countLabel =
    group.totalStale === 1
      ? '1 outdated page'
      : `${formatNumber(group.totalStale)} outdated pages`;

  return (
    <article className="card editor-review-card">
      <div className="editor-review-head">
        <div>
          <h3 className="editor-review-title">{group.editor}</h3>
          <span className="editor-review-count">{countLabel}</span>
          {group.topSpaceLabels?.length > 0 && (
            <p className="editor-review-meta">
              Mostly in: {group.topSpaceLabels.join(', ')}
            </p>
          )}
          {group.slackHandle && (
            <p className="editor-review-slack">
              Slack: <span className="mono">@{group.slackHandle}</span>
            </p>
          )}
          {bot && (
            <div className="editor-review-badges">
              <span className="badge">Automated account</span>
            </div>
          )}
        </div>

        <div className="editor-review-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide pages' : `See pages (${group.pages.length})`}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onMessageAll(group)}
            disabled={bot}
            title={bot ? 'Automated accounts usually should not be messaged' : undefined}
          >
            Send reminder
            {group.pages.length > 1 ? ` (all ${formatNumber(group.pages.length)})` : ''}
          </button>
          {bot && (
            <p className="editor-review-bot-note">Usually skip — automated account.</p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="editor-review-expand">
          <ul className="editor-review-list">
            {group.pages.map((page) => (
              <StalePageRow
                key={`${page.spaceKey}-${page.id || page.url}`}
                page={page}
                compact
                reviewDetail={reviewDetail}
                hideRemindButton
                selected={
                  detailSpaceKey === page.spaceKey &&
                  detailPageId === String(page.id || '')
                }
              />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
