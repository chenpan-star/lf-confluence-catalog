import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import SpaceIndexNav from '../components/SpaceIndexNav';
import { CATEGORY_INTRO } from '../lib/categoryMeta';
import { formatNumber } from '../lib/labels';

function IntroBlock({ title, children }) {
  if (!children) return null;
  return (
    <div className="category-intro-block">
      <h3 className="category-intro-block-title">{title}</h3>
      <p className="category-intro-block-text">{children}</p>
    </div>
  );
}

export default function CategoryHome() {
  const { category, categoryId } = useOutletContext();
  const { catalog } = useCatalog();
  const intro = CATEGORY_INTRO[categoryId];
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceSort, setSpaceSort] = useState('name');
  const [spacesOpen, setSpacesOpen] = useState(true);

  const spaces = useMemo(() => {
    if (!catalog?.spaces || !categoryId) return [];
    return catalog.spaces.filter((s) => s.category === categoryId);
  }, [catalog, categoryId]);

  const spaceCountLabel =
    category.spaceCount === 1
      ? '1 space'
      : `${formatNumber(category.spaceCount)} spaces`;

  return (
    <div className="category-home">
      <section className="category-intro card">
        {intro && (
          <>
            <IntroBlock title="Who it's for">{intro.whoItsFor}</IntroBlock>
            <IntroBlock title="What you'll find">{intro.whatYouFind}</IntroBlock>
            {intro.examples && (
              <IntroBlock title="Example spaces & topics">{intro.examples}</IntroBlock>
            )}
            {intro.tips && (
              <p className="category-intro-tip">
                <strong>Tip:</strong> {intro.tips}
              </p>
            )}
          </>
        )}

        <div className={`category-intro-browse${intro ? ' category-intro-browse-divider' : ''}`}>
          <h3 className="category-intro-block-title">Select a space</h3>
          <p className="browse-prompt-desktop">
            <strong>{formatNumber(category.spaceCount)}</strong> spaces are listed in the{' '}
            <strong>left panel</strong>
            {spacesOpen ? ', and in the list below' : ''}. Click a space to browse pages and open
            details on the right.
          </p>
          <p className="browse-prompt-mobile">
            Choose a space from the list below to browse its pages. On larger screens, spaces also
            appear in the left panel.
          </p>
        </div>
      </section>

      <section className="category-home-spaces card" aria-label="Spaces in this category">
        <div className={`category-home-spaces-head${spacesOpen ? ' is-open' : ''}`}>
          <h2 className="category-home-spaces-title">
            Spaces
            <span className="category-home-spaces-count">{spaceCountLabel}</span>
          </h2>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            aria-expanded={spacesOpen}
            onClick={() => setSpacesOpen((open) => !open)}
          >
            {spacesOpen ? 'Hide' : 'Show'}
          </button>
        </div>
        {spacesOpen && (
          <SpaceIndexNav
            spaces={spaces}
            scope={{ type: 'category', id: categoryId }}
            search={spaceSearch}
            onSearchChange={setSpaceSearch}
            sort={spaceSort}
            onSortChange={setSpaceSort}
          />
        )}
      </section>
    </div>
  );
}
