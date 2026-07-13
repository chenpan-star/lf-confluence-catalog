/** Keep filter-by-name context when opening page detail in the sidebar. */
export function buildReviewPersonPageLink(searchParams, page) {
  const next = new URLSearchParams(searchParams);
  if (page?.id) next.set('pageId', String(page.id));
  if (page?.spaceKey) next.set('pageSpace', page.spaceKey);
  return `/review/my-pages?${next.toString()}`;
}

export function clearReviewPersonPageDetail(searchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('pageId');
  next.delete('pageSpace');
  return next;
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
