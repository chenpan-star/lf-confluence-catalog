import { Link, useLocation } from 'react-router-dom';

export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="empty" style={{ textAlign: 'left', maxWidth: '520px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Page not found</h1>
      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        No route for <code className="mono">{pathname}</code>
      </p>
      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        This app uses simple paths, not Confluence URLs:
      </p>
      <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
        <li><Link to="/">/</Link> — all categories</li>
        <li><code>/space/DNOXOM</code> — space page list</li>
        <li><code>/spaces/DNOXOM/pages/123…</code> — page detail (if in catalog)</li>
      </ul>
      <Link to="/">← Back to home</Link>
    </div>
  );
}
