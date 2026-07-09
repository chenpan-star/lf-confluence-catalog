const SESSION_KEY = 'lf-catalog-auth';

export function getPasswordHash() {
  return import.meta.env.VITE_ACCESS_PASSWORD_HASH?.trim() || '';
}

export function isAccessGateEnabled() {
  return Boolean(getPasswordHash());
}

export function hasValidSession() {
  if (!isAccessGateEnabled()) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === getPasswordHash();
  } catch {
    return false;
  }
}

export function unlockSession() {
  sessionStorage.setItem(SESSION_KEY, getPasswordHash());
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password) {
  const expected = getPasswordHash();
  if (!expected) return true;
  const actual = await hashPassword(password);
  return actual === expected;
}
