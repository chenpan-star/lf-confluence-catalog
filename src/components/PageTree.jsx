import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, DOC_TYPE_LABELS, RECENCY_LABELS, RECENCY_COLORS } from '../lib/labels';
import { formatTitle } from '../lib/text';
import { toConfluenceUrl } from '../lib/confluenceUrl';
import { useCatalog } from '../context/CatalogContext';
import { catalogPagePath } from '../lib/pageTree';
import './PageTree.css';

function PageTreeNode({ node, site, defaultExpandedDepth, depth = 0 }) {
  const { page, children } = node;
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(depth < defaultExpandedDepth);

  const localPath = catalogPagePath(page.url);
  const confluenceUrl = toConfluenceUrl(page.url, site);

  return (
    <li className="tree-node">
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
            {localPath ? (
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
              defaultExpandedDepth={defaultExpandedDepth}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PageTree({ tree, emptyMessage = 'No pages match your filters.' }) {
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
          defaultExpandedDepth={1}
        />
      ))}
    </ul>
  );
}
