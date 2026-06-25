import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toConfluenceUrl } from '../lib/confluenceUrl';

const CatalogContext = createContext(null);

function normalizeCatalog(data) {
  if (!data?.spaces) return data;
  const site = data.meta?.source || 'lotusflare.atlassian.net';
  return {
    ...data,
    spaces: data.spaces.map((space) => ({
      ...space,
      pages: space.pages.map((page) => ({
        ...page,
        url: page.url?.startsWith('http') ? page.url : toConfluenceUrl(page.url, site),
      })),
    })),
  };
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

  const value = { catalog, loading, error, spacesByKey };
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
