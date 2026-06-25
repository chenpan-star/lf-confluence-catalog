import { Link } from 'react-router-dom';
import { formatNumber, formatDate } from '../lib/labels';

export default function DepartmentCard({ id, department }) {
  const hasOwner = department.owner?.name?.trim();

  return (
    <Link to={`/department/${id}`} className="card card-link category-card">
      <div className="category-accent" style={{ background: department.color }} />
      <h3>{department.label}</h3>
      <p>{department.description}</p>
      {hasOwner ? (
        <p className="dept-owner-line">
          Owner: <strong>{department.owner.name}</strong>
        </p>
      ) : (
        <p className="dept-owner-line dept-owner-empty">Owner: not assigned yet</p>
      )}
      <div className="category-stats">
        <span>
          <strong>{formatNumber(department.spaceCount)}</strong> spaces
        </span>
        <span>
          <strong>{formatNumber(department.pageCount)}</strong> pages
        </span>
      </div>
      {department.lastActivity && (
        <p className="dept-activity">Last activity {formatDate(department.lastActivity)}</p>
      )}
    </Link>
  );
}
