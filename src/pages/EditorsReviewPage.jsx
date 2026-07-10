import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import EditorReviewCard from '../components/EditorReviewCard';
import ReviewMessageModal from '../components/ReviewMessageModal';
import {
  applyEditorGroupFilters,
  groupStalePagesByEditor,
  sortEditorGroups,
} from '../lib/editorReview';
import { openBundledSlackReview } from '../lib/slack';
import { formatNumber, RECENCY_LABELS } from '../lib/labels';
import '../components/ReviewMessageModal.css';

export default function EditorsReviewPage() {
  const { catalog, loading, error, health, slackConfig } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalGroup, setModalGroup] = useState(null);
  const [hideBots, setHideBots] = useState(true);

  const recency = searchParams.get('recency') || 'all';
  const spaceKey = searchParams.get('space') || 'all';
  const sortBy = searchParams.get('sort') || 'most-stale';
  const editorQuery = searchParams.get('editor') || '';
  const pageQuery = searchParams.get('q') || '';
  const [editorDraft, setEditorDraft] = useState(editorQuery);
  const [pageDraft, setPageDraft] = useState(pageQuery);

  const { groups, botPageCount } = useMemo(() => {
    if (!health?.stalePages) return { groups: [], botPageCount: 0 };
    return groupStalePagesByEditor(health.stalePages, { hideBots });
  }, [health, hideBots]);

  const filtered = useMemo(() => {
    const applied = applyEditorGroupFilters(groups, {
      query: pageQuery,
      editorQuery,
      recency,
      spaceKey,
    });
    return sortEditorGroups(applied, sortBy);
  }, [groups, pageQuery, editorQuery, recency, spaceKey, sortBy]);

  const spaceOptions = useMemo(() => {
    if (!catalog) return [];
    const keys = new Set(health?.stalePages?.map((p) => p.spaceKey) || []);
    return catalog.spaces.filter((s) => keys.has(s.key)).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, health]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  async function handleSendSlack(group) {
    const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
    await openBundledSlackReview({
      editor: group.editor,
      pages: group.pages,
      site,
      slackConfig,
    });
    setModalGroup(null);
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog || !health) return <div className="empty">Unable to load catalog data.</div>;

  const editorCount = groups.length;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>By last editor</span>
      </nav>

      <header className="page-header">
        <h1>Review by last editor</h1>
        <p>
          Stale pages grouped by who edited them last. Message editors to{' '}
          <strong>update</strong>, <strong>archive</strong>, or <strong>delete</strong> — no space
          maintainer required.
        </p>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          <Link to="/stale">Flat stale list</Link>
          {' · '}
          <Link to="/review/my-pages">My pages</Link>
        </p>
      </header>

      <div className="health-summary grid grid-2" style={{ marginBottom: '1.75rem' }}>
        <div className="health-stat card health-stat-warn">
          <span className="health-stat-value">{formatNumber(health.counts.stale)}</span>
          <span className="health-stat-label">Stale (1–2 years)</span>
        </div>
        <div className="health-stat card health-stat-danger">
          <span className="health-stat-value">{formatNumber(health.counts.legacy)}</span>
          <span className="health-stat-label">Legacy (&gt;2 years)</span>
        </div>
        <div className="health-stat card">
          <span className="health-stat-value">{formatNumber(editorCount)}</span>
          <span className="health-stat-label">Editors with stale pages</span>
        </div>
        <div className="health-stat card">
          <span className="health-stat-value">{formatNumber(botPageCount)}</span>
          <span className="health-stat-label">Bot pages hidden</span>
        </div>
      </div>

      <form
        className="filters toolbar review-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          updateParam('editor', editorDraft.trim());
          updateParam('q', pageDraft.trim());
        }}
      >
        <input
          type="search"
          placeholder="Filter by editor name…"
          value={editorDraft}
          onChange={(e) => setEditorDraft(e.target.value)}
          style={{ flex: 1, minWidth: '160px' }}
        />
        <input
          type="search"
          placeholder="Filter pages…"
          value={pageDraft}
          onChange={(e) => setPageDraft(e.target.value)}
          style={{ flex: 1, minWidth: '160px' }}
        />
        <select value={recency} onChange={(e) => updateParam('recency', e.target.value)}>
          <option value="all">Stale + legacy</option>
          <option value="stale">{RECENCY_LABELS.stale}</option>
          <option value="legacy">{RECENCY_LABELS.legacy}</option>
        </select>
        <select value={spaceKey} onChange={(e) => updateParam('space', e.target.value)}>
          <option value="all">All spaces</option>
          {spaceOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
        <label>
          <input
            type="checkbox"
            checked={hideBots}
            onChange={(e) => setHideBots(e.target.checked)}
          />
          Hide bots
        </label>
      </form>

      <div className="review-sort">
        <span>Sort:</span>
        <label>
          <input
            type="radio"
            name="sort"
            checked={sortBy === 'most-stale'}
            onChange={() => updateParam('sort', 'most-stale')}
          />
          Most stale pages
        </label>
        <label>
          <input
            type="radio"
            name="sort"
            checked={sortBy === 'oldest'}
            onChange={() => updateParam('sort', 'oldest')}
          />
          Oldest page
        </label>
        <label>
          <input
            type="radio"
            name="sort"
            checked={sortBy === 'name'}
            onChange={() => updateParam('sort', 'name')}
          />
          Name A–Z
        </label>
      </div>

      <p className="result-count">
        Showing {formatNumber(filtered.length)} editor{filtered.length === 1 ? '' : 's'}
      </p>

      {filtered.length === 0 ? (
        <div className="empty">No editors match your filters.</div>
      ) : (
        <div className="editor-review-stack">
          {filtered.map((group) => (
            <EditorReviewCard
              key={group.editor}
              group={group}
              onMessageAll={setModalGroup}
            />
          ))}
        </div>
      )}

      <p className="stale-footnote">
        &ldquo;Message all&rdquo; copies a bundled Slack message for every stale page under that
        editor. Add Slack user IDs in <code className="mono">public/config/slack.json</code> for
        direct DM links.
      </p>

      {modalGroup && (
        <ReviewMessageModal
          editor={modalGroup.editor}
          pages={modalGroup.pages}
          site={catalog.meta?.source}
          onClose={() => setModalGroup(null)}
          onSendSlack={() => handleSendSlack(modalGroup)}
        />
      )}
    </>
  );
}
