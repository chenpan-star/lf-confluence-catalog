import { DOC_TYPE_LABELS } from '../lib/labels';

export default function BarChart({ data, maxItems = 8 }) {
  const entries = Object.entries(data || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);

  if (!entries.length) return null;

  const max = entries[0][1];

  return (
    <div className="bar-chart">
      {entries.map(([key, count]) => (
        <div key={key} className="bar-row">
          <span className="bar-label">{DOC_TYPE_LABELS[key] || key}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}
