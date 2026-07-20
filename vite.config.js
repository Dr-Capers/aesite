import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
    proxy: {
      '/api': {
        target: 'https://us-central1-aesite-30f9e.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
