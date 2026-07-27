import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { buildSearchIndex } from '../lib/search';
import { computeHealthStats } from '../lib/health';
import { DEFAULT_SLACK_CONFIG } from '../lib/slack';

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
      pages: (space.pages || []).map((page) => {
        const spaceKey = space.key || space.id;
        let url = page.url?.startsWith('http') ? page.url : toConfluenceUrl(page.url, site);
        if (page.id && spaceKey && url && !/\/pages\/\d+/.test(url)) {
          const host = site.replace(/^https?:\/\//, '');
          url = `https://${host}/wiki/spaces/${encodeURIComponent(spaceKey)}/pages/${page.id}`;
        }
        return {
          ...page,
          url,
          parentId: page.parentId || '',
          parentTitle: page.parentTitle || '',
          ancestorIds: page.ancestorIds || [],
          depth: page.depth ?? 0,
          childCount: page.childCount ?? 0,
        };
      }),
    })),
  };
  return normalized;
}

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [slackConfig, setSlackConfig] = useState(DEFAULT_SLACK_CONFIG);

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

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config/slack.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSlackConfig({ ...DEFAULT_SLACK_CONFIG, ...data });
      })
      .catch(() => {});
  }, []);

  const [remindTrackConfig, setRemindTrackConfig] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config/remind-track.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setRemindTrackConfig(data);
      })
      .catch(() => {});
  }, []);

  const spacesByKey = useMemo(() => {
    if (!catalog) return {};
    const map = {};
    for (const s of catalog.spaces) {
      const key = s.key || s.id;
      if (!key) continue;
      const variants = new Set([key]);
      try {
        variants.add(decodeURIComponent(key));
      } catch {
        /* ignore */
      }
      variants.add(key.toUpperCase());
      variants.add(key.toLowerCase());
      for (const v of variants) map[v] = s;
    }
    return map;
  }, [catalog]);

  const searchIndex = useMemo(() => {
    if (!catalog) return [];
    return buildSearchIndex(catalog);
  }, [catalog]);

  const health = useMemo(() => {
    if (!catalog) return null;
    return computeHealthStats(catalog);
  }, [catalog]);

  const resolveSpace = useMemo(() => {
    return (spaceKey) => {
      if (!spaceKey) return null;
      let decoded = spaceKey;
      try {
        decoded = decodeURIComponent(spaceKey);
      } catch {
        /* ignore */
      }
      return (
        spacesByKey[spaceKey] ||
        spacesByKey[decoded] ||
        spacesByKey[spaceKey.toUpperCase()] ||
        spacesByKey[spaceKey.toLowerCase()] ||
        null
      );
    };
  }, [spacesByKey]);

  const value = {
    catalog,
    loading,
    error,
    spacesByKey,
    resolveSpace,
    searchIndex,
    health,
    slackConfig,
    remindTrackConfig,
  };
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
