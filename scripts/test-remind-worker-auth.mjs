#!/usr/bin/env node
/**
 * Smoke-test remind Worker auth (uses REMIND_API_SECRET from env).
 * Usage: REMIND_API_SECRET=… node scripts/test-remind-worker-auth.mjs [worker-base-url]
 */
const base = (process.argv[2] || process.env.VITE_REMIND_TRACK_URL || '').replace(/\/$/, '');
const secret = process.env.REMIND_API_SECRET || process.env.VITE_REMIND_API_KEY || '';

if (!base || !secret) {
  console.error('Usage: REMIND_API_SECRET=… node scripts/test-remind-worker-auth.mjs https://….workers.dev');
  process.exit(1);
}

const health = await fetch(`${base}/health`).then((r) => r.json());
console.log('health', health);

const auth = await fetch(`${base}/v1/auth-check`, {
  headers: { Authorization: `Bearer ${secret}` },
}).then((r) => r.json());
console.log('auth-check', auth);

if (!auth.ok) process.exit(1);
