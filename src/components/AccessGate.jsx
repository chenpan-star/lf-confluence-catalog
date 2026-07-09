import { useState } from 'react';
import {
  hasValidSession,
  isAccessGateEnabled,
  unlockSession,
  verifyPassword,
} from '../lib/accessGate';
import './AccessGate.css';

export default function AccessGate({ children }) {
  const [unlocked, setUnlocked] = useState(hasValidSession);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isAccessGateEnabled() || unlocked) {
    return children;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const ok = await verifyPassword(password);
      if (!ok) {
        setError('Incorrect password.');
        return;
      }
      unlockSession();
      setUnlocked(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="access-gate">
      <div className="access-gate__card">
        <h1 className="access-gate__title">LF Confluence Catalog</h1>
        <p className="access-gate__hint">Enter the team password to continue.</p>
        <form className="access-gate__form" onSubmit={onSubmit}>
          <input
            className="access-gate__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
          />
          {error ? <p className="access-gate__error">{error}</p> : null}
          <button className="access-gate__button" type="submit" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
        <p className="access-gate__note">
          LotusFlare internal use. Keeps casual visitors out; not a substitute for full SSO.
        </p>
      </div>
    </div>
  );
}
