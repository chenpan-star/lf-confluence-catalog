/** Keep current list context when opening page detail in the sidebar. */
export function buildSidebarPageParams(searchParams, page, spaceKey) {
  const next = new URLSearchParams(searchParams);
  if (page?.id) next.set('pageId', String(page.id));
  else next.delete('pageId');
  const key = spaceKey || page?.spaceKey;
  if (key) next.set('pageSpace', key);
  else next.delete('pageSpace');
  return next;
}

export function buildSidebarPageHref(pathname, searchParams, page, spaceKey) {
  const next = buildSidebarPageParams(searchParams, page, spaceKey);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** @deprecated use buildSidebarPageHref — kept for Filter by name links */
export function buildReviewPersonPageLink(searchParams, page) {
  return `/review/my-pages?${buildSidebarPageParams(searchParams, page).toString()}`;
}

export function clearSidebarPageDetail(searchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('pageId');
  next.delete('pageSpace');
  return next;
}

/** @deprecated use clearSidebarPageDetail */
export function clearReviewPersonPageDetail(searchParams) {
  return clearSidebarPageDetail(searchParams);
}

/** Default on: match creator when last editor is Anonymous / bot / missing. */
export function parseCreatorFallback(searchParams) {
  const v = searchParams.get('creatorFallback');
  return v !== '0' && v !== 'false';
}

export function withCreatorFallback(searchParams, enabled) {
  const next = new URLSearchParams(searchParams);
  if (enabled) next.delete('creatorFallback');
  else next.set('creatorFallback', '0');
  return next;
}
