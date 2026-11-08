// prod(웹 배포/Electron)용: /api + dist 정적 서빙
// reacct-eqm-1 server.ts 패턴 — cert.pem/key.pem이 cwd에 있으면 HTTPS(웹 배포), 없으면 HTTP(로컬 dev/Electron)
import express from 'express';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from './api.mjs';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// 보안 헤더 — 웹 배포 기준. Electron(http://127.0.0.1)에도 동일 적용되지만 무해.
// connect-src: 클라이언트가 직접 붙는 외부 채널(P2PQuake HTTPS/WS, Wolfx WS, USGS 피드)
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
    "connect-src 'self'; " +
    "worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

export function startServer(port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0') {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    next();
  });
  app.use('/api', apiRouter);
  // 해시된 assets만 1년 캐시, 나머지는 재검증 (데이터 파일 갱신이 묵히지 않게)
  app.use(express.static(distDir, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.use((req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  const certPath = path.resolve('cert.pem');
  const keyPath = path.resolve('key.pem');
  const listener = fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
    : app;

  return new Promise((resolve, reject) => {
    const server = listener.listen(port, host, () => resolve(server));
    server.on('error', reject);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then(() => {
    console.log(`Server listening on port ${Number(process.env.PORT) || 3000} (TLS: ${fs.existsSync(path.resolve('cert.pem'))})`);
  });
}
