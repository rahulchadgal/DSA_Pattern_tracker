
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      components: new URL('./components', import.meta.url).pathname,
      hooks: new URL('./hooks', import.meta.url).pathname,
      lib: new URL('./lib', import.meta.url).pathname
    }
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  }
});
