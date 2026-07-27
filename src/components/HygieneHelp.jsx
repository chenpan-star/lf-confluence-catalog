import './HygieneHelp.css';

const STEPS = [
  'Pick someone who last edited outdated pages.',
  'Click Send reminder (all N) — one message lists every outdated page for them.',
  'Copy & open Slack for each part if the list is long, then paste into their DM.',
];

export default function HygieneHelpCard({ title = 'How this works', compact = false }) {
  return (
    <aside className={`hygiene-help card${compact ? ' hygiene-help-compact' : ''}`}>
      <h2 className="hygiene-help-title">{title}</h2>
      <ol className="hygiene-help-steps">
        {STEPS.map((step, index) => (
          <li key={step}>
            <span className="hygiene-help-num">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {!compact && (
        <p className="hygiene-help-tip">
          Ask them to <strong>update</strong>, <strong>archive</strong>, or <strong>delete</strong>{' '}
          pages that are no longer needed.
        </p>
      )}
    </aside>
  );
}

export function HygieneStatGrid({ children }) {
  return <div className="hygiene-stats">{children}</div>;
}

export function HygieneStat({ value, label, tone = 'default' }) {
  return (
    <div className={`hygiene-stat card hygiene-stat-${tone}`}>
      <span className="hygiene-stat-value">{value}</span>
      <span className="hygiene-stat-label">{label}</span>
    </div>
  );
}
