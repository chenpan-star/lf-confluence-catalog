/** Build in-app path to a space view within category layout. */
export function spaceScopePath(scope, spaceKey) {
  const key = encodeURIComponent(spaceKey || '');
  if (!scope?.id || !key) return `/space/${key}`;
  if (scope.type === 'category') return `/category/${scope.id}/space/${key}`;
  return `/space/${key}`;
}

export function parsePageRouteContext(pathname) {
  const catMatch = pathname.match(/\/category\/([^/]+)\/space\/([^/]+)\/pages\/(\d+)/);
  if (catMatch) {
    return {
      categoryId: catMatch[1],
      spaceKey: decodeURIComponent(catMatch[2]),
      pageId: catMatch[3],
    };
  }
  const match = pathname.match(/\/spaces\/([^/]+)\/pages\/(\d+)/);
  if (!match) return null;
  return { spaceKey: decodeURIComponent(match[1]), pageId: match[2] };
}
