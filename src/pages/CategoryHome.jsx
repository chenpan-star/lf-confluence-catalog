import { useOutletContext } from 'react-router-dom';
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
  const intro = CATEGORY_INTRO[categoryId];

  return (
    <div className="category-home">
      {intro && (
        <section className="category-intro card">
          <IntroBlock title="About this category">{intro.summary}</IntroBlock>
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
          Use the search box in the left panel to filter spaces by name.
        </p>
      </div>
    </div>
  );
}
