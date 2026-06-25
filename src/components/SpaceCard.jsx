import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/labels';

export default function SpaceCard({ space, categoryColor, departmentLabel }) {
  const active = space.recency?.active || 0;

  return (
    <Link
      to={`/space/${encodeURIComponent(space.key || space.id)}`}
      className="card card-link space-card"
    >
      <div className="space-card-header">
        <h3>{space.name}</h3>
        <span className="mono space-key">{space.key}</span>
      </div>
      {departmentLabel && (
        <p className="space-dept-label">{departmentLabel}</p>
      )}
      <div className="space-card-stats">
        <span>{formatNumber(space.pageCount)} pages</span>
        {active > 0 && <span className="badge active">{active} active</span>}
      </div>
      {categoryColor && (
        <div className="space-card-bar" style={{ background: categoryColor }} />
      )}
    </Link>
  );
}
