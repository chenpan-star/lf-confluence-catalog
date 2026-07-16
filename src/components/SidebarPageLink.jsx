import { useLocation, useSearchParams } from 'react-router-dom';
import { buildSidebarPageHref, buildSidebarPageParams } from '../lib/reviewPaths';

/**
 * Opens page metadata in the sidebar by updating URL search params in place.
 * Uses setSearchParams so the panel opens even when only the query string changes.
 */
export default function SidebarPageLink({
  page,
  spaceKey,
  className,
  children,
  replace = true,
}) {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const key = spaceKey || page?.spaceKey;
  const href = buildSidebarPageHref(pathname, searchParams, page, key);

  function openDetail(event) {
    event.preventDefault();
    if (!page?.id || !key) return;
    setSearchParams(buildSidebarPageParams(searchParams, page, key), { replace });
  }

  return (
    <a href={href} onClick={openDetail} className={className}>
      {children}
    </a>
  );
}
