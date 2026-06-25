const SOURCE_LABELS = {
  manual: 'Manual override',
  heuristic: 'Space name / category rules',
  zoho: 'Zoho employee match',
  'contributor-network': 'Contributor activity (where editors also work)',
};

export default function DepartmentSourceNote({ space, catalog }) {
  if (!space || !catalog) return null;
  const dept = catalog.departments?.[space.department];
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
