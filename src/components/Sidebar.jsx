import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/departments', label: 'Departments', icon: '▦' },
  { to: '/spaces', label: 'All Spaces', icon: '▤' },
  { to: '/categories', label: 'Categories', icon: '◫' },
];

function isActive(pathname, to, end) {
  if (end) return pathname === to || pathname === '';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { pathname } = useLocation();

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
      <p className="sidebar-hint">Use the search bar above to find any page.</p>
      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon, end }) => (
          <Link
            key={to}
            to={to}
            className={isActive(pathname, to, end) ? 'active' : ''}
            onClick={onClose}
          >
            <span className="sidebar-icon" aria-hidden>
              {icon}
            </span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Link to="/contributors" className="sidebar-muted" onClick={onClose}>
          Contributors
        </Link>
      </div>
    </aside>
  );
}
