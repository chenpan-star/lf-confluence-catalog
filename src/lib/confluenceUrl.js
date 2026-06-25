const DEFAULT_SITE = 'lotusflare.atlassian.net';

export function toConfluenceUrl(url, site = DEFAULT_SITE) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/wiki') ? url : `/wiki${url.startsWith('/') ? url : `/${url}`}`;
  return `https://${site.replace(/^https?:\/\//, '')}${path}`;
}

export { parsePageRouteContext as parseConfluencePagePath } from './spacePaths.js';
