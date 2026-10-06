import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeBasePath } from './server/routing';

const base = normalizeBasePath(process.env.BASE_PATH ?? '/');

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      [`${base}api`]: 'http://127.0.0.1:4310',
      [`${base}listen`]: { target: 'ws://127.0.0.1:4310', ws: true },
    },
  },
});
