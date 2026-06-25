import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import { formatNumber } from '../lib/labels';
import '../components/SpaceCard.css';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const { catalog, loading, error } = useCatalog();

  const category = catalog?.categories[categoryId];
  const spaces = useMemo(
    () =>
      catalog?.spaces
        .filter((s) => s.category === categoryId)
        .sort((a, b) => b.pageCount - a.pageCount) || [],
    [catalog, categoryId],
  );

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!category) return <div className="empty">Category not found.</div>;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Browse by category</Link>
        <span>/</span>
        <span>{category.label}</span>
      </nav>

      <header className="page-header">
        <h1>{category.label}</h1>
        <p>{category.description}</p>
        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <div className="stat">
            <span className="stat-value">{formatNumber(spaces.length)}</span>
            <span className="stat-label">Spaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(category.pageCount)}</span>
            <span className="stat-label">Pages</span>
          </div>
        </div>
      </header>

      <div className="grid grid-3">
        {spaces.map((space) => (
          <SpaceCard
            key={space.key || space.id}
            space={space}
            categoryColor={category.color}
          />
        ))}
      </div>
    </>
  );
}
