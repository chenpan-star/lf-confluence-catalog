#!/usr/bin/env node
/**
 * Generate VITE_ACCESS_PASSWORD_HASH for .env or GitHub Actions.
 * Usage: npm run access:hash -- your-password
 */
import { createHash } from 'crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run access:hash -- <password>');
  process.exit(1);
}

const hash = createHash('sha256').update(password).digest('hex');
console.log(hash);
console.error('\nAdd to .env:');
console.error(`VITE_ACCESS_PASSWORD_HASH=${hash}`);
console.error('\nOr set GitHub secret SITE_ACCESS_PASSWORD to the plain password (CI hashes at build).');
