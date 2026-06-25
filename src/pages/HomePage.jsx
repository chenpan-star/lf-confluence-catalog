import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import DepartmentCard from '../components/DepartmentCard';
import SpaceCard from '../components/SpaceCard';
import { DEPARTMENT_ORDER } from '../lib/departments';
import { formatNumber, formatDate } from '../lib/labels';
import '../components/CategoryCard.css';
import '../components/SpaceCard.css';

export default function HomePage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading catalog…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return null;

  const { meta, departments } = catalog;
  const topSpaces = [...catalog.spaces].sort((a, b) => b.pageCount - a.pageCount).slice(0, 6);
  const topDepts = DEPARTMENT_ORDER.filter(
    (id) => departments?.[id] && id !== 'needs-owner',
  ).slice(0, 6);

  return (
    <>
      <section className="hero card">
        <h1>Find Confluence documentation</h1>
        <p>
          Browse {formatNumber(meta.totalSpaces)} spaces and {formatNumber(meta.totalPages)} pages
          organized by department. Use the search bar above or pick a section below.
        </p>
        <div className="hero-actions">
          <Link to="/search" className="btn btn-primary">
            Search catalog
          </Link>
          <Link to="/spaces" className="btn btn-secondary">
            Browse all spaces
          </Link>
        </div>
        {meta.refreshedAt && (
          <p className="hero-meta">
            Last updated <strong>{formatDate(meta.refreshedAt)}</strong>
            {meta.refreshMode === 'scheduled' && ' · syncs daily'}
          </p>
        )}
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2>Departments</h2>
          <Link to="/departments" className="section-link">
            View all →
          </Link>
        </div>
        <div className="grid grid-3">
          {topDepts.map((id) => (
            <DepartmentCard key={id} id={id} department={departments[id]} compact />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <h2>Largest spaces</h2>
          <Link to="/spaces" className="section-link">
            View all →
          </Link>
        </div>
        <div className="grid grid-3">
          {topSpaces.map((space) => (
            <SpaceCard
              key={space.key}
              space={space}
              categoryColor={catalog.categories[space.category]?.color}
            />
          ))}
        </div>
      </section>
    </>
  );
}
