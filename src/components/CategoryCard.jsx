import { Link } from 'react-router-dom';
import { formatNumber } from '../lib/labels';
import { getCategoryCardDescription } from '../lib/categoryMeta';

export default function CategoryCard({ id, category }) {
  const description = getCategoryCardDescription(id, category.description);

  return (
    <Link to={`/category/${id}`} className="card card-link category-card">
      <div
        className="category-accent"
        style={{ background: category.color }}
      />
      <h3>{category.label}</h3>
      <p>{description}</p>
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
