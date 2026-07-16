import { useOutletContext } from 'react-router-dom';
import { CATEGORY_INTRO } from '../lib/categoryMeta';
import { formatNumber } from '../lib/labels';

export default function CategoryHome() {
  const { category, categoryId } = useOutletContext();
  const intro = CATEGORY_INTRO[categoryId];

  return (
    <div className="category-home">
      {intro && (
        <section className="category-intro card">
          <p className="category-intro-summary">{intro.summary}</p>
          {intro.examples && (
            <p className="category-intro-examples">
              <strong>Examples:</strong> {intro.examples}
            </p>
          )}
        </section>
      )}

      <div className="browse-prompt card">
        <h2>Select a space</h2>
        <p>
          <strong>{formatNumber(category.spaceCount)}</strong> spaces in this category are listed in
          the <strong>left panel</strong>. Click a space to browse its pages, filter by person, or
          open page details on the right.
        </p>
        <p className="browse-prompt-tip">
          Tip: use the search box in the left panel to filter spaces by name.
        </p>
      </div>
    </div>
  );
}
