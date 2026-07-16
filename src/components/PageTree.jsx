import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, DOC_TYPE_LABELS, RECENCY_LABELS, RECENCY_COLORS } from '../lib/labels';
import { formatTitle } from '../lib/text';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { useCatalog } from '../context/CatalogContext';
import { pageCatalogPath } from '../lib/pageTree';
import SidebarPageLink from './SidebarPageLink';
import './PageTree.css';

function PageTreeNode({
  node,
  site,
  spaceKey,
  routeContext,
  defaultExpandedDepth,
  depth = 0,
  sidebarDetail,
  selectedPageId,
  highlightPageIds,
}) {
  const { page, children } = node;
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);
  const isMatch = highlightPageIds ? highlightPageIds.has(page.id) : true;
  const isContextOnly = highlightPageIds && !isMatch;

  useEffect(() => {
    if (depth < defaultExpandedDepth) setExpanded(true);
  }, [defaultExpandedDepth, depth]);

  const localPath = pageCatalogPath(page, spaceKey, routeContext);
  const confluenceUrl = toConfluenceUrl(page.url, site);
  const selected = selectedPageId && String(page.id) === String(selectedPageId);
  const useSidebar = sidebarDetail && page.id;

  return (
    <li
      className={`tree-node${selected ? ' tree-node-selected' : ''}${isContextOnly ? ' tree-node-context' : ''}${isMatch && highlightPageIds ? ' tree-node-match' : ''}`}
    >
      <div className="tree-row" style={{ paddingLeft: `${depth * 1.25}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}

        <div className="tree-content">
          <div className="tree-title-row">
            {useSidebar ? (
              <SidebarPageLink page={page} spaceKey={spaceKey}>
                {formatTitle(page.title)}
              </SidebarPageLink>
            ) : localPath ? (
              <Link to={localPath}>{formatTitle(page.title)}</Link>
            ) : (
              <a href={confluenceUrl} target="_blank" rel="noreferrer">
                {formatTitle(page.title)}
              </a>
            )}
            {hasChildren && (
              <span className="tree-child-count">{page.childCount ?? children.length} children</span>
            )}
          </div>
          <div className="page-subline">
            <span>Updated {formatDate(page.lastModified)}</span>
            {page.lastEditor && <span> · {page.lastEditor}</span>}
          </div>
          <div className="page-meta tree-badges">
            <span className="badge">{DOC_TYPE_LABELS[page.docType] || page.docType}</span>
            <span className="badge" style={{ color: RECENCY_COLORS[page.recency] || 'inherit' }}>
              {RECENCY_LABELS[page.recency] || page.recency}
            </span>
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <ul className="tree-children">
          {children.map((child) => (
            <PageTreeNode
              key={child.page.id || child.page.url}
              node={child}
              site={site}
              spaceKey={spaceKey}
              routeContext={routeContext}
              defaultExpandedDepth={defaultExpandedDepth}
              depth={depth + 1}
              sidebarDetail={sidebarDetail}
              selectedPageId={selectedPageId}
              highlightPageIds={highlightPageIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PageTree({
  tree,
  spaceKey,
  routeContext,
  departmentId,
  emptyMessage = 'No pages match your filters.',
  sidebarDetail = false,
  selectedPageId = '',
  defaultExpandedDepth = 1,
  highlightPageIds = null,
}) {
  const ctx = routeContext || (departmentId ? { departmentId } : {});
  const { catalog } = useCatalog();
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';

  if (!tree.length) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <ul className="page-tree">
      {tree.map((node) => (
        <PageTreeNode
          key={node.page.id || node.page.url}
          node={node}
          site={site}
          spaceKey={spaceKey}
          routeContext={ctx}
          defaultExpandedDepth={defaultExpandedDepth}
          sidebarDetail={sidebarDetail}
          selectedPageId={selectedPageId}
          highlightPageIds={highlightPageIds}
        />
      ))}
    </ul>
  );
}
