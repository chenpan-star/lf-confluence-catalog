import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import PageList from '../components/PageList';
import { formatNumber } from '../lib/labels';

const MAX_RESULTS = 200;

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim().toLowerCase();
  const { catalog, loading, error } = useCatalog();

  const results = useMemo(() => {
    if (!catalog || !q) return [];
    const matches = [];
    for (const space of catalog.spaces) {
      const spaceMatch = space.name.toLowerCase().includes(q) || space.key.toLowerCase().includes(q);
      for (const page of space.pages) {
        if (spaceMatch || page.title.toLowerCase().includes(q)) {
          matches.push({ ...page, spaceName: space.name, spaceKey: space.key });
        }
        if (matches.length >= MAX_RESULTS) return matches;
      }
    }
    return matches;
  }, [catalog, q]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;

  return (
    <>
      <header className="page-header">
        <h1>Search results</h1>
        <p>
          {q ? (
            <>
              Showing up to {MAX_RESULTS} results for &ldquo;<strong>{params.get('q')}</strong>&rdquo;
              {results.length > 0 && ` — ${formatNumber(results.length)} found`}
            </>
          ) : (
            'Enter a search term in the header.'
          )}
        </p>
      </header>

      {q && results.length === 0 && (
        <div className="empty">No pages or spaces matched your search.</div>
      )}

      {results.length > 0 && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Matched spaces:{' '}
            {[...new Set(results.map((r) => r.spaceName))].slice(0, 10).map((name, i) => {
              const space = catalog.spaces.find((s) => s.name === name);
              return space ? (
                <span key={name}>
                  {i > 0 && ', '}
                  <Link to={`/space/${encodeURIComponent(space.key)}`}>{name}</Link>
                </span>
              ) : null;
            })}
          </p>
          <PageList
            pages={results.map((r) => ({
              title: `${r.title} (${r.spaceName})`,
              url: r.url,
              docType: r.docType,
              recency: r.recency,
              lastModified: r.lastModified,
            }))}
          />
        </>
      )}
    </>
  );
}
