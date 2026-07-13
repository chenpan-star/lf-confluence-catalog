import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { parsePageRouteContext, spaceScopePath } from '../lib/spacePaths';
import { formatTitle } from '../lib/text';
import './ContextBar.css';

function findPage(space, pageId) {
  if (!space?.pages) return null;
  const id = String(pageId);
  return space.pages.find(
    (p) => (p.id && String(p.id) === id) || (p.url && p.url.includes(`/pages/${id}`)),
  );
}

export default function ContextBar() {
  const { pathname } = useLocation();
  const { catalog, resolveSpace } = useCatalog();

  if (!catalog || pathname === '/') return null;

  const crumbs = [{ label: 'Home', to: '/' }];
  const parsed = parsePageRouteContext(pathname);

  if (pathname.startsWith('/category/')) {
    const catMatch = pathname.match(/^\/category\/([^/]+)/);
    const categoryId = catMatch?.[1];
    const category = categoryId ? catalog.categories?.[categoryId] : null;
    if (category) {
      crumbs.push({ label: category.label, to: `/category/${categoryId}` });
    }
    const spaceMatch = pathname.match(/^\/category\/[^/]+\/space\/([^/]+)/);
    if (spaceMatch && categoryId) {
      const spaceKey = decodeURIComponent(spaceMatch[1]);
      const space = resolveSpace(spaceKey);
      const spacePath = spaceScopePath({ type: 'category', id: categoryId }, spaceKey);
      const pageMatch = pathname.match(/\/pages\/(\d+)/);
      if (pageMatch) {
        crumbs.push({ label: space?.name || spaceKey, to: spacePath });
        const page = findPage(space, pageMatch[1]);
        crumbs.push({ label: formatTitle(page?.title || `Page ${pageMatch[1]}`) });
      } else {
        crumbs.push({ label: space?.name || spaceKey });
      }
    }
  } else if (pathname.startsWith('/space/')) {
    const keyMatch = pathname.match(/^\/space\/([^/]+)/);
    const spaceKey = keyMatch ? decodeURIComponent(keyMatch[1]) : null;
    crumbs.push({ label: 'All spaces', to: '/spaces' });
    if (spaceKey) {
      const space = resolveSpace(spaceKey);
      crumbs.push({ label: space?.name || spaceKey });
      if (parsed?.pageId) {
        const page = findPage(space, parsed.pageId);
        crumbs.push({ label: formatTitle(page?.title || `Page ${parsed.pageId}`) });
      }
    }
  } else if (pathname.startsWith('/spaces/') && parsed?.spaceKey) {
    crumbs.push({ label: 'All spaces', to: '/spaces' });
    const space = resolveSpace(parsed.spaceKey);
    crumbs.push({ label: space?.name || parsed.spaceKey, to: `/space/${encodeURIComponent(parsed.spaceKey)}` });
    if (parsed.pageId) {
      const page = findPage(space, parsed.pageId);
      crumbs.push({ label: formatTitle(page?.title || `Page ${parsed.pageId}`) });
    }
  } else if (pathname === '/categories') {
    crumbs.push({ label: 'Categories' });
  } else if (pathname === '/spaces') {
    crumbs.push({ label: 'All spaces' });
  } else if (pathname === '/search') {
    crumbs.push({ label: 'Search' });
  } else if (pathname === '/contributors') {
    crumbs.push({ label: 'Contributors' });
  } else if (pathname === '/stale') {
    crumbs.push({ label: 'Outdated pages' });
  } else if (pathname === '/review/editors') {
    crumbs.push({ label: 'Send reminders' });
  } else if (pathname === '/review/my-pages') {
    crumbs.push({ label: 'Filter by name' });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav className="context-bar" aria-label="You are here">
      <ol className="context-trail">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className={isLast ? 'context-current' : ''}>
              {crumb.to && !isLast ? (
                <Link to={crumb.to}>{crumb.label}</Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
