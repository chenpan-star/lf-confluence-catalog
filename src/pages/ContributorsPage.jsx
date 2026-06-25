import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { formatNumber } from '../lib/labels';

const SOURCE_LABELS = {
  manual: 'Manual override',
  heuristic: 'Space name / category rules',
  zoho: 'Zoho employee match',
  'contributor-network': 'Contributor activity (where editors also work)',
};

export function DepartmentSourceNote({ space, catalog }) {
  if (!space) return null;
  const dept = catalog?.departments?.[space.department];
  const source = SOURCE_LABELS[space.departmentSource] || space.departmentSource;

  return (
    <p className="dept-source-note">
      <strong>Department:</strong> {dept?.label || space.department}
      {' · '}
      <span title="Pages inherit department from their Confluence space">{source}</span>
      {space.networkConfidence > 0 && (
        <> · {space.networkConfidence}% confidence from editor patterns</>
      )}
    </p>
  );
}

export default function ContributorsPage() {
  const { catalog, loading, error } = useCatalog();

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="empty">Error: {error}</div>;

  const contributors = catalog?.contributors || [];

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Contributors</span>
      </nav>

      <header className="page-header">
        <h1>Confluence contributors</h1>
        <p>
          {formatNumber(catalog.meta.contributorCount || contributors.length)} people who created
          or edited pages. We <strong>do not</strong> know their HR department — instead we infer
          where they work based on <strong>which spaces they edit most</strong>.
        </p>
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Pages are grouped by <strong>space → department</strong>, not by individual contributor.
          Use this list to see who is active where, and override mappings in{' '}
          <code className="mono">scripts/config/departments.json</code> as you learn more.
        </p>
      </header>

      <div className="card" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>How department assignment works</h2>
        <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
          <li>Each <strong>Confluence space</strong> is assigned to one department.</li>
          <li>All <strong>pages</strong> in that space inherit the same department.</li>
          <li>Contributors help guess the space department by looking at other spaces they edit.</li>
          <li>Without HR data, contributor “department” is <em>activity-based</em>, not org-chart.</li>
        </ol>
      </div>

      <ul className="page-list">
        {contributors.map((c) => (
          <li key={c.name} className="page-item contributor-row">
            <div>
              <strong>{c.name}</strong>
              <div className="page-subline">
                {formatNumber(c.totalEdits)} edits across {c.spaceCount} spaces
                {c.inferredDepartment && catalog.departments[c.inferredDepartment] && (
                  <>
                    {' '}
                    · Mostly active in{' '}
                    <Link to={`/department/${c.inferredDepartment}`}>
                      {catalog.departments[c.inferredDepartment].label}
                    </Link>
                    {c.departmentConfidence > 0 && ` (${c.departmentConfidence}% of their edits)`}
                  </>
                )}
                {!c.inferredDepartment && ' · Department unclear from activity'}
              </div>
              <div className="contributor-spaces">
                Top spaces:{' '}
                {c.topSpaces.slice(0, 5).map((sp, i) => (
                  <span key={sp.spaceKey}>
                    {i > 0 && ', '}
                    <Link to={`/space/${encodeURIComponent(sp.spaceKey)}`}>{sp.spaceName}</Link>
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
