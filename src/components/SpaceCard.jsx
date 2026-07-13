import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/labels';

export default function SpaceCard({ space, categoryColor, to, showOwner = false }) {
  const active = space.recency?.active || 0;
  const dest = to || `/space/${encodeURIComponent(space.key || space.id)}`;
  const ownerName = space.owner?.name?.trim();

  return (
    <Link to={dest} className="card card-link space-card">
      <div className="space-card-header">
        <h3>{space.name}</h3>
        <span className="mono space-key">{space.key}</span>
      </div>
      {showOwner && ownerName && (
        <p className="space-owner-line">
          Maintainer: <strong>{ownerName}</strong>
        </p>
      )}
      <div className="space-card-stats">
        <span>{formatNumber(space.pageCount)} pages</span>
        {active > 0 && <span className="badge active">{active} active</span>}
        {(space.staleCount || 0) > 0 && (
          <span className="badge" style={{ color: 'var(--amber)' }}>
            {space.staleCount} stale
          </span>
        )}
      </div>
      {categoryColor && (
        <div className="space-card-bar" style={{ background: categoryColor }} />
      )}
    </Link>
  );
}
