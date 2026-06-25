import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/labels';

export default function DepartmentCard({ id, department, compact = false }) {
  const hasOwner = department.owner?.name?.trim();

  return (
    <Link
      to={`/department/${id}`}
      className={`card card-link category-card${compact ? ' compact' : ''}`}
    >
      <div className="category-accent" style={{ background: department.color }} />
      <h3>{department.label}</h3>
      {!compact && <p>{department.description}</p>}
      {!compact && hasOwner && (
        <p className="dept-owner-line">
          Owner: <strong>{department.owner.name}</strong>
        </p>
      )}
      {!compact && !hasOwner && (
        <p className="dept-owner-line dept-owner-empty">Owner: not assigned yet</p>
      )}
      <div className="category-stats">
        <span>
          <strong>{formatNumber(department.spaceCount)}</strong> spaces
        </span>
        <span>
          <strong>{formatNumber(department.pageCount)}</strong> pages
        </span>
        {department.staleCount > 0 && (
          <span className="dept-stale-count">
            <strong>{formatNumber(department.staleCount)}</strong> stale
          </span>
        )}
      </div>
    </Link>
  );
}
