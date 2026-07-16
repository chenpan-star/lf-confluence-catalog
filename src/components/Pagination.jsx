import { formatNumber } from '../lib/labels';

export function paginationMeta(page, pageSize, total) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  return { pageCount, safePage, start, end };
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = 'items',
  className = '',
}) {
  const { pageCount, safePage, start, end } = paginationMeta(page, pageSize, total);

  if (total === 0 || pageCount <= 1) return null;

  return (
    <nav className={`pagination${className ? ` ${className}` : ''}`} aria-label="Pagination">
      <button
        type="button"
        className="pagination-btn"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        ← Previous
      </button>
      <p className="pagination-meta">
        Showing {formatNumber(start)}–{formatNumber(end)} of {formatNumber(total)} {itemLabel}
        <span className="pagination-pages">
          {' '}
          · Page {safePage} of {pageCount}
        </span>
      </p>
      <button
        type="button"
        className="pagination-btn"
        disabled={safePage >= pageCount}
        onClick={() => onPageChange(safePage + 1)}
      >
        Next →
      </button>
    </nav>
  );
}

/** Pagination above and below list content. */
export function PaginationBar({ children, page, pageSize, total, onPageChange, itemLabel = 'items' }) {
  const { pageCount } = paginationMeta(page, pageSize, total);
  const props = { page, pageSize, total, onPageChange, itemLabel };

  if (total === 0 || pageCount <= 1) {
    return children;
  }

  return (
    <>
      <Pagination {...props} className="pagination-top" />
      {children}
      <Pagination {...props} className="pagination-bottom" />
    </>
  );
}
