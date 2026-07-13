import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import EditorReviewCard from '../components/EditorReviewCard';
import ReviewMessageModal from '../components/ReviewMessageModal';
import HygieneHelpCard, { HygieneStat, HygieneStatGrid } from '../components/HygieneHelp';
import {
  applyEditorGroupFilters,
  groupStalePagesByEditor,
  sortEditorGroups,
} from '../lib/editorReview';
import { openBundledSlackReview } from '../lib/slack';
import { formatNumber } from '../lib/labels';
import Pagination, { PaginationBar } from '../components/Pagination';
import {
  applyListPage,
  computePagination,
  PAGE_SIZE,
  readListPage,
  scrollToTop,
  slicePage,
} from '../lib/pagination';
import '../components/HygieneHelp.css';
import '../components/ReviewMessageModal.css';

const SORT_OPTIONS = [
  { id: 'most-stale', label: 'Most pages first' },
  { id: 'oldest', label: 'Oldest pages' },
  { id: 'name', label: 'Name A–Z' },
];

export default function EditorsReviewPage() {
  const { catalog, loading, error, health, slackConfig } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalGroup, setModalGroup] = useState(null);
  const [hideBots, setHideBots] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const recency = searchParams.get('recency') || 'all';
  const spaceKey = searchParams.get('space') || 'all';
  const sortBy = searchParams.get('sort') || 'most-stale';
  const editorQuery = searchParams.get('editor') || '';
  const pageQuery = searchParams.get('q') || '';
  const [editorDraft, setEditorDraft] = useState(editorQuery);
  const [pageDraft, setPageDraft] = useState(pageQuery);

  useEffect(() => {
    setEditorDraft(editorQuery);
  }, [editorQuery]);

  useEffect(() => {
    setPageDraft(pageQuery);
  }, [pageQuery]);

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

  const listPage = readListPage(searchParams);
  const { safePage } = computePagination(filtered.length, listPage, PAGE_SIZE);

  const paginated = useMemo(
    () => slicePage(filtered, safePage, PAGE_SIZE),
    [filtered, safePage],
  );

  const spaceOptions = useMemo(() => {
    if (!catalog) return [];
    const keys = new Set(health?.stalePages?.map((p) => p.spaceKey) || []);
    return catalog.spaces.filter((s) => keys.has(s.key)).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, health]);

  function applyFilters({ editor = editorDraft, page = pageDraft } = {}) {
    const next = new URLSearchParams(searchParams);
    const editorValue = editor.trim();
    const pageValue = page.trim();

    if (editorValue) next.set('editor', editorValue);
    else next.delete('editor');

    if (pageValue) next.set('q', pageValue);
    else next.delete('q');

    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function setListPage(page) {
    setSearchParams(applyListPage(searchParams, page), { replace: true });
    scrollToTop();
  }

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function clearPersonSearch() {
    setEditorDraft('');
    applyFilters({ editor: '', page: pageDraft });
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

  if (loading) return <div className="loading">Loading outdated pages…</div>;
  if (error) return <div className="empty">Something went wrong: {error}</div>;
  if (!catalog || !health) return <div className="empty">Unable to load catalog data.</div>;

  const editorCount = groups.length;
  const hasExtraFilters = pageQuery || recency !== 'all' || spaceKey !== 'all';

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Send reminders</span>
      </nav>

      <header className="page-header">
        <h1>Send reminders to last editors</h1>
        <p>
          These Confluence pages have not been updated in over a year. Each page is grouped under
          whoever edited it last — send them a friendly reminder to clean it up.
        </p>
      </header>

      <HygieneHelpCard />

      <HygieneStatGrid>
        <HygieneStat
          value={formatNumber(health.needsAttention)}
          label="Pages need a review"
        />
        <HygieneStat
          value={formatNumber(editorCount)}
          label="People you can contact"
        />
        <HygieneStat
          value={formatNumber(health.counts.stale)}
          label="Outdated 1–2 years"
          tone="warn"
        />
        <HygieneStat
          value={formatNumber(health.counts.legacy)}
          label="Very old (2+ years)"
          tone="danger"
        />
      </HygieneStatGrid>

      {botPageCount > 0 && hideBots && (
        <p className="result-count" style={{ marginTop: '-0.75rem' }}>
          {formatNumber(botPageCount)} automated pages are hidden.{' '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setHideBots(false)}
          >
            Show them
          </button>
        </p>
      )}

      <form
        className="card my-pages-form person-search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
      >
        <label htmlFor="editor-search">Find a person</label>
        <p className="my-pages-form-hint">
          Search by Confluence name, Slack handle, or email — e.g.{' '}
          <span className="mono">chen.pan</span> or <span className="mono">Chen Pan</span>
        </p>
        <div className="my-pages-form-row">
          <input
            id="editor-search"
            type="search"
            placeholder="Search by name, handle, or email…"
            value={editorDraft}
            onChange={(e) => setEditorDraft(e.target.value)}
            aria-label="Find a person"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {editorQuery && (
            <button type="button" className="btn btn-secondary" onClick={clearPersonSearch}>
              Clear
            </button>
          )}
        </div>
      </form>

      <div className="review-pills">
        <span className="review-pills-label">Sort by</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`review-pill${sortBy === opt.id ? ' active' : ''}`}
            onClick={() => updateParam('sort', opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm review-filters-toggle"
        onClick={() => setShowFilters((v) => !v)}
      >
        {showFilters ? 'Hide extra filters' : 'Extra filters'}
        {hasExtraFilters && !showFilters ? ' · active' : ''}
      </button>

      {showFilters && (
        <div className="review-filters-panel card">
          <form
            className="filters toolbar review-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
          >
            <input
              type="search"
              placeholder="Find a page title…"
              value={pageDraft}
              onChange={(e) => setPageDraft(e.target.value)}
              aria-label="Find a page"
              style={{ flex: 1, minWidth: '160px' }}
            />
            <select
              value={recency}
              onChange={(e) => updateParam('recency', e.target.value)}
              aria-label="How old"
            >
              <option value="all">All outdated pages</option>
              <option value="stale">1–2 years old</option>
              <option value="legacy">Over 2 years old</option>
            </select>
            <select
              value={spaceKey}
              onChange={(e) => updateParam('space', e.target.value)}
              aria-label="Space"
            >
              <option value="all">All spaces</option>
              {spaceOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">
              Apply
            </button>
            <label>
              <input
                type="checkbox"
                checked={hideBots}
                onChange={(e) => {
                  setHideBots(e.target.checked);
                  setListPage(1);
                }}
              />
              Hide automated accounts
            </label>
          </form>
        </div>
      )}

      <p className="result-count">
        {editorQuery ? (
          <>
            {formatNumber(filtered.length)} {filtered.length === 1 ? 'person' : 'people'} matching
            &ldquo;{editorQuery}&rdquo;
          </>
        ) : (
          <>
            {formatNumber(filtered.length)} {filtered.length === 1 ? 'person' : 'people'} to contact
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="empty review-empty card">
          <div className="review-empty-icon" aria-hidden>
            ✓
          </div>
          <p>
            <strong>No matches.</strong>{' '}
            {editorQuery
              ? 'Try a different spelling, Slack handle, or partial name.'
              : 'Try searching for a person above.'}
          </p>
        </div>
      ) : (
        <>
          <PaginationBar
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setListPage}
            itemLabel={filtered.length === 1 ? 'person' : 'people'}
          >
            <div className="editor-review-stack">
              {paginated.map((group) => (
                <EditorReviewCard key={group.editor} group={group} onMessageAll={setModalGroup} />
              ))}
            </div>
          </PaginationBar>
        </>
      )}

      <p className="stale-footnote">
        Tip: after clicking <strong>Send reminder</strong>, paste the message into a Slack DM. One
        message can list all outdated pages for that person.
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
