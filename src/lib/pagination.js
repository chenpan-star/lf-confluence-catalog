export const PAGE_SIZE = 25;
export const TABLE_PAGE_SIZE = 50;

export function readListPage(searchParams) {
  return Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
}

export function computePagination(total, listPage, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, listPage), pageCount);
  const start = (safePage - 1) * pageSize;
  return { safePage, pageCount, pageSize, start };
}

export function slicePage(items, safePage, pageSize = PAGE_SIZE) {
  if (!items?.length) return [];
  const { start } = computePagination(items.length, safePage, pageSize);
  return items.slice(start, start + pageSize);
}

export function applyListPage(searchParams, page) {
  const next = new URLSearchParams(searchParams);
  if (page <= 1) next.delete('page');
  else next.set('page', String(page));
  return next;
}

export function clearListPage(searchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('page');
  return next;
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
