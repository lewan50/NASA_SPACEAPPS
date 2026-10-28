import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Pin IPv4: uvicorn binds 0.0.0.0 (IPv4-only) and Node resolves
        // 'localhost' to ::1 first on Windows, which fails the proxy.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
