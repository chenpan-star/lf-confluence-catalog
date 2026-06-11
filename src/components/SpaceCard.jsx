import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/labels';

export default function SpaceCard({ space, categoryColor }) {
  const active = space.recency?.active || 0;
  const legacy = space.recency?.legacy || 0;

  return (
    <Link
      to={`/space/${encodeURIComponent(space.key || space.id)}`}
      className="card card-link space-card"
    >
      <div className="space-card-header">
        <h3>{space.name}</h3>
        <span className="mono space-key">{space.key}</span>
      </div>
      <div className="space-card-stats">
        <span>{formatNumber(space.pageCount)} pages</span>
        {active > 0 && <span className="badge active">{active} active</span>}
        {legacy > 0 && <span className="badge legacy">{legacy} legacy</span>}
      </div>
      {categoryColor && (
        <div className="space-card-bar" style={{ background: categoryColor }} />
      )}
    </Link>
  );
}
