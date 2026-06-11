const DEFAULT_SITE = 'lotusflare.atlassian.net';

export function toConfluenceUrl(url, site = DEFAULT_SITE) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/wiki') ? url : `/wiki${url.startsWith('/') ? url : `/${url}`}`;
  return `https://${site.replace(/^https?:\/\//, '')}${path}`;
}

export function parseConfluencePagePath(pathname) {
  const match = pathname.match(/\/spaces\/([^/]+)\/pages\/(\d+)/);
  if (!match) return null;
  return { spaceKey: decodeURIComponent(match[1]), pageId: match[2] };
}
