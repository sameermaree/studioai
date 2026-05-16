import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import studioApiPlugin from './server/vite-plugin.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    studioApiPlugin(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  ssr: {
    // These packages use Node.js APIs, mark them as external for SSR
    noExternal: ['express'],
  },
});
