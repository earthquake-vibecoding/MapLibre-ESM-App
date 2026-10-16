// prod(웹 배포/Electron)용: /api + dist 정적 서빙
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from './api.mjs';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

export function startServer(port = Number(process.env.PORT) || 3000) {
  const app = express();
  app.use('/api', apiRouter);
  app.use(express.static(distDir, { index: false, maxAge: '1y' }));
  app.use((req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => resolve(server));
    server.on('error', reject);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then(() => {
    console.log(`Server listening on http://0.0.0.0:${Number(process.env.PORT) || 3000}`);
  });
}
