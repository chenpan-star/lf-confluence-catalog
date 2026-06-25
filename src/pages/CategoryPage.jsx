import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceBrowseSection from '../components/SpaceBrowseSection';
import { formatNumber } from '../lib/labels';
import '../components/SpaceCard.css';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const { catalog, loading, error } = useCatalog();

  const category = catalog?.categories?.[categoryId];
  const spaces = useMemo(
    () => catalog?.spaces.filter((s) => s.category === categoryId) || [],
    [catalog, categoryId],
  );

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!category) return <div className="empty">Category not found.</div>;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/categories">Categories</Link>
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

      <SpaceBrowseSection
        spaces={spaces}
        categoryColor={category.color}
        departmentLabel={(space) => catalog.departments?.[space.department]?.label}
      />
    </>
  );
}
