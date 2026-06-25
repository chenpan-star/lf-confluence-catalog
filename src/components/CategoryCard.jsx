import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/labels';

export default function CategoryCard({ id, category }) {
  return (
    <Link to={`/category/${id}`} className="card card-link category-card">
      <div
        className="category-accent"
        style={{ background: category.color }}
      />
      <h3>{category.label}</h3>
      <p>{category.description}</p>
      <div className="category-stats">
        <span>
          <strong>{formatNumber(category.spaceCount)}</strong> spaces
        </span>
        <span>
          <strong>{formatNumber(category.pageCount)}</strong> pages
        </span>
        {(category.staleCount || 0) > 0 && (
          <span className="dept-stale-count">
            <strong>{formatNumber(category.staleCount)}</strong> stale
          </span>
        )}
      </div>
    </Link>
  );
}
