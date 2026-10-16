import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// dev 서버에서 prod와 동일한 /api 핸들러 사용 (configureServer는 Plugin 훅)
function kmoniApi() {
  return {
    name: 'kmoni-api',
    async configureServer(server: any) {
      const api = (await import('./server/api.mjs')).default;
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/')) {
          req.url = req.url.slice('/api'.length);
          api(req, res, next);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), svelte(), kmoniApi()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
  },
});
