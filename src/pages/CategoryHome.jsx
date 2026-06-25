import { useOutletContext } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceCard from '../components/SpaceCard';
import { formatNumber } from '../lib/labels';

export default function CategoryHome() {
  const { categoryId, category } = useOutletContext();
  const { catalog } = useCatalog();

  const spaces =
    catalog?.spaces
      .filter((s) => s.category === categoryId)
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')) || [];

  return (
    <div className="dept-home">
      <div className="dept-home-prompt card">
        <h2>Pick a space</h2>
        <p>
          Each space has one maintainer who is responsible for keeping its pages up to date. Select a
          space from the list on the left — the navigator stays visible as you browse.
        </p>
      </div>

      <div className="grid grid-3" style={{ marginTop: '1.25rem' }}>
        {spaces.map((space) => (
          <SpaceCard
            key={space.key || space.id}
            space={space}
            to={`/category/${categoryId}/space/${encodeURIComponent(space.key || space.id)}`}
            categoryColor={category.color}
            showOwner
          />
        ))}
      </div>

      {spaces.length > 0 && (
        <p className="section-desc" style={{ marginTop: '1rem' }}>
          {formatNumber(spaces.length)} spaces in this category · default maintainer shown until
          per-space owners are assigned in{' '}
          <code className="mono">public/config/space-owners.json</code>
        </p>
      )}
    </div>
  );
}
