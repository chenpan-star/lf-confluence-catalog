import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import StalePageRow from '../components/StalePageRow';
import { DEPARTMENT_ORDER } from '../lib/departments';
import { filterStalePages } from '../lib/health';
import { formatNumber, RECENCY_LABELS } from '../lib/labels';

export default function StaleContentPage() {
  const { catalog, loading, error, health } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const department = searchParams.get('department') || 'all';
  const recency = searchParams.get('recency') || 'all';
  const spaceKey = searchParams.get('space') || 'all';
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const filtered = useMemo(() => {
    if (!health) return [];
    return filterStalePages(health.stalePages, {
      department,
      recency,
      spaceKey,
      query,
    });
  }, [health, department, recency, spaceKey, query]);

  const spaceOptions = useMemo(() => {
    if (!catalog) return [];
    const keys = new Set(health?.stalePages?.map((p) => p.spaceKey) || []);
    return catalog.spaces.filter((s) => keys.has(s.key)).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, health]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value === 'all' || !value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function applySearch(e) {
    e.preventDefault();
    updateParam('q', query.trim());
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog || !health) return <div className="empty">Unable to load catalog data.</div>;

  const { counts } = health;

  return (
    <>
      <header className="page-header">
        <h1>Stale content</h1>
        <p>
          Pages not updated in over 1 year. Review with creators and ask them to{' '}
          <strong>update</strong>, <strong>archive</strong>, or <strong>delete</strong> as needed.
        </p>
      </header>

      <div className="health-summary grid grid-2" style={{ marginBottom: '1.75rem' }}>
        <div className="health-stat card health-stat-warn">
          <span className="health-stat-value">{formatNumber(counts.stale)}</span>
          <span className="health-stat-label">Stale (1–2 years)</span>
        </div>
        <div className="health-stat card health-stat-danger">
          <span className="health-stat-value">{formatNumber(counts.legacy)}</span>
          <span className="health-stat-label">Legacy (&gt;2 years)</span>
        </div>
        <div className="health-stat card">
          <span className="health-stat-value" style={{ color: 'var(--green)' }}>
            {formatNumber(counts.active)}
          </span>
          <span className="health-stat-label">Active (≤90 days)</span>
        </div>
        <div className="health-stat card">
          <span className="health-stat-value">{formatNumber(counts.recent)}</span>
          <span className="health-stat-label">Recent (3–12 months)</span>
        </div>
      </div>

      <form className="filters toolbar" onSubmit={applySearch}>
        <input
          type="search"
          placeholder="Filter by title, space, or person…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: '180px' }}
        />
        <select value={department} onChange={(e) => updateParam('department', e.target.value)}>
          <option value="all">All departments</option>
          {DEPARTMENT_ORDER.filter((id) => catalog.departments[id]).map((id) => {
            const dept = catalog.departments[id];
            const deptHealth = health.byDepartment[id];
            const staleCount = (deptHealth?.stale || 0) + (deptHealth?.legacy || 0);
            return (
              <option key={id} value={id}>
                {dept.label} ({staleCount} stale)
              </option>
            );
          })}
        </select>
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
      </form>

      <p className="result-count">
        Showing {formatNumber(filtered.length)} of {formatNumber(health.needsAttention)} pages needing
        attention
        {filtered.length > 500 && ' (first 500 shown)'}
      </p>

      {filtered.length === 0 ? (
        <div className="empty">No stale pages match your filters.</div>
      ) : (
        <div className="table-wrap card">
          <table className="stale-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Space</th>
                <th>Department</th>
                <th>Last updated</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((page) => (
                <StalePageRow key={`${page.spaceKey}-${page.id || page.url}`} page={page} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="stale-footnote">
        &ldquo;Slack&rdquo; copies a message to your clipboard and opens LotusFlare Slack. Paste
        into a DM to the editor (e.g. @linus.chui). Add Slack user IDs in{' '}
        <code className="mono">public/config/slack.json</code> for direct DM links.
      </p>
    </>
  );
}
