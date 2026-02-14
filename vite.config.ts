import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const resolveFunctionsProxy = () => {
  const rawTarget =
    process.env.FUNCTIONS_API_URL ||
    'https://southamerica-east1-painel-administrativo-br.cloudfunctions.net/api';
  const url = new URL(rawTarget);
  const target = `${url.protocol}//${url.host}`;
  const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');

  const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

  return {
    target,
    rewrite(path: string) {
      const stripped = path.replace(/^\/api/, '') || '/';
      if (!basePath) {
        return stripped.startsWith('/') ? stripped : ensureLeadingSlash(stripped);
      }
      if (stripped === '/' || stripped.length === 0) {
        return basePath;
      }
      return `${basePath}${ensureLeadingSlash(stripped)}`;
    },
  };
};

const functionsProxy = resolveFunctionsProxy();

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/checkout': {
        target: 'http://localhost:4242',
        changeOrigin: true,
      },
      '/api': {
        target: functionsProxy.target,
        changeOrigin: true,
        rewrite: functionsProxy.rewrite,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('firebase')) {
            return 'firebase';
          }
          if (id.includes('recharts')) {
            return 'recharts';
          }
          if (id.includes('react-router')) {
            return 'react-router';
          }
          if (id.includes('react-hot-toast')) {
            return 'react-hot-toast';
          }
          return 'vendor';
        },
      },
    },
  },
});
