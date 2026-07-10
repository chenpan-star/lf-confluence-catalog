import { useState } from 'react';
import { isBotEditor } from '../lib/editorReview';
import { formatNumber } from '../lib/labels';
import StalePageRow from './StalePageRow';
import './ReviewMessageModal.css';

export default function EditorReviewCard({ group, onMessageAll }) {
  const [expanded, setExpanded] = useState(false);
  const bot = isBotEditor(group.editor);

  return (
    <article className="card editor-review-card">
      <div className="editor-review-head">
        <div>
          <h3 className="editor-review-title">{group.editor}</h3>
          <p className="editor-review-meta">
            {formatNumber(group.totalStale)} need attention
            {group.staleCount > 0 && ` · ${formatNumber(group.staleCount)} stale`}
            {group.legacyCount > 0 && ` · ${formatNumber(group.legacyCount)} legacy`}
            {group.slackHandle && (
              <>
                {' '}
                · <span className="mono">@{group.slackHandle}</span>
              </>
            )}
          </p>
          {group.topSpaceLabels?.length > 0 && (
            <p className="editor-review-meta">Top spaces: {group.topSpaceLabels.join(', ')}</p>
          )}
          <div className="editor-review-badges">
            {bot && <span className="badge">bot</span>}
          </div>
        </div>

        <div className="editor-review-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Collapse' : `Expand (${group.pages.length})`}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onMessageAll(group)}
          >
            Message all
          </button>
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
              />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
