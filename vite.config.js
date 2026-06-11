import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project site: set VITE_BASE_PATH=/your-repo-name/ when building
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base,
});
