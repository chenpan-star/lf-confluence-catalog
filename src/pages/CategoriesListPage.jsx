import { useCatalog } from '../context/CatalogContext';
import CategoryCard from '../components/CategoryCard';
import { CATEGORY_ORDER } from '../lib/departments';
import '../components/CategoryCard.css';

export default function CategoriesListPage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;
  if (!catalog) return <div className="empty">Unable to load catalog data.</div>;

  const { categories } = catalog;

  return (
    <>
      <header className="page-header">
        <h1>Categories</h1>
        <p>
          Browse by document type — customer projects, DNO platform components, engineering, and
          more. Each space has one maintainer responsible for its pages.
        </p>
      </header>

      <div className="grid grid-2">
        {CATEGORY_ORDER.filter((id) => categories[id]).map((id) => (
          <CategoryCard key={id} id={id} category={categories[id]} />
        ))}
      </div>
    </>
  );
}
