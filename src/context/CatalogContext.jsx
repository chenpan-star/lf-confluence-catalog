import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { buildSearchIndex } from '../lib/search';
import { computeHealthStats } from '../lib/health';

const CatalogContext = createContext(null);

function normalizeCatalog(data) {
  if (!data?.spaces) return data;
  const site = data.meta?.source || 'lotusflare.atlassian.net';
  const normalized = {
    ...data,
    departments: data.departments || {},
    contributors: data.contributors || [],
    spaces: data.spaces.map((space) => ({
      ...space,
      department: space.department || 'needs-owner',
      pages: space.pages.map((page) => ({
        ...page,
        url: page.url?.startsWith('http') ? page.url : toConfluenceUrl(page.url, site),
        parentId: page.parentId || '',
        parentTitle: page.parentTitle || '',
        ancestorIds: page.ancestorIds || [],
        depth: page.depth ?? 0,
        childCount: page.childCount ?? 0,
      })),
    })),
  };
  return normalized;
}

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}data/catalog.json?v=${Date.now()}`;
    fetch(url, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load catalog data');
        return r.json();
      })
      .then((data) => setCatalog(normalizeCatalog(data)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const spacesByKey = useMemo(() => {
    if (!catalog) return {};
    return Object.fromEntries(catalog.spaces.map((s) => [s.key || s.id, s]));
  }, [catalog]);

  const searchIndex = useMemo(() => {
    if (!catalog) return [];
    return buildSearchIndex(catalog);
  }, [catalog]);

  const health = useMemo(() => {
    if (!catalog) return null;
    return computeHealthStats(catalog);
  }, [catalog]);

  const value = { catalog, loading, error, spacesByKey, searchIndex, health };
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
