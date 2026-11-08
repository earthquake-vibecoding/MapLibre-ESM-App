// SSE 푸시 허브 — /api/events. 클라이언트 폴링(latest-time/프레임 fetch)을 단일 스트림으로 대체.
// 이벤트: hello(접속 스냅샷), frame(1Hz), quake(p2p 551), eew(wolfx/p2p 556). 의존성 0.
// Cloudflare 뒤 버퍼링 방지: X-Accel-Buffering: no + 15s heartbeat.
import express from 'express';

const clients = new Set();
let helloProvider = null; // () => object — 접속 직후 스냅샷 (runner/feed가 등록)

export function setHelloProvider(fn) {
  helloProvider = fn;
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

const sseApp = express();
sseApp.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (helloProvider) {
    try {
      res.write(`event: hello\ndata: ${JSON.stringify(helloProvider())}\n\n`);
    } catch {
      // hello 실패해도 스트림은 계속
    }
  }
  clients.add(res);
  const ka = setInterval(() => {
    try {
      res.write(': ka\n\n');
    } catch {
      // close는 req 'close'에서 정리
    }
  }, 15000);
  req.on('close', () => {
    clearInterval(ka);
    clients.delete(res);
  });
});

export default sseApp;
