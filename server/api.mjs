// kmoni(기상청 강진모니터링) 프록시 API — dev(vite middleware)/prod(express) 공용
// 주의: Router 대신 mini express app을 export해야 connect에서 res.json 등 augment가 동작함
// 프레임은 server/frame-buffer.mjs의 백그라운드 폴러가 미리 수신한 버퍼 우선, 미스 시 on-demand fetch.
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import webhookApp from './webhook.mjs';
import historyApp from './history.mjs';
import { kmoniImgUrl } from './kmoni-poll.mjs';
import { getFrameBuffer, startKmoniPoller } from './frame-buffer.mjs';

const app = express();
const TJMA_PATH = fileURLToPath(new URL('../tjma2020a.-00000', import.meta.url));
const buffer = getFrameBuffer();
startKmoniPoller(); // 백그라운드 1Hz 폴러 — jma_s 프레임 선수신으로 감지 경로 504 제거

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

async function fetchWithTimeout(url, ms = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// 간단 고정윈도우 레이트 리밋 (IP당) — kmoni 증폭 프록시 방지
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || now - h[0] > windowMs) {
      h = [now, 0];
      hits.set(ip, h);
      if (hits.size > 1000) {
        for (const [k, v] of hits) {
          if (now - v[0] > windowMs) hits.delete(k);
        }
      }
    }
    h[1]++;
    if (h[1] > max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
}
app.use(rateLimit(120, 10000));

// time 파라미터 검증: 14자리 숫자만 허용 (경로 순회/쿼리 주입 차단)
function validTime(req, res) {
  const time = req.query['time'];
  if (typeof time !== 'string' || !/^\d{14}$/.test(time)) {
    res.status(400).json({ error: 'Invalid time parameter' });
    return null;
  }
  return time;
}

/** 버퍼 hit → 즉시 서빙, miss → on-demand fetch 후 버퍼 적재. 폴러가 받지 않는 kind(acmap/eew)도 이 경로로 캐시됨 */
async function sendImage(res, time, kind, fallback) {
  const hit = buffer.get(time, kind);
  if (hit) {
    res.setHeader('Content-Type', hit.type);
    res.setHeader('X-Frame-Source', 'buffer');
    res.send(hit.buf);
    return;
  }
  try {
    const response = await fetchWithTimeout(kmoniImgUrl(time, kind));
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const buf = Buffer.from(await response.arrayBuffer());
    buffer.put(time, kind, buf);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('X-Frame-Source', 'fetch');
    res.send(buf);
  } catch {
    if (fallback) {
      res.setHeader('Content-Type', 'image/gif');
      res.send(TRANSPARENT_GIF);
    } else {
      res.status(504).json({ error: 'Failed to fetch image or timeout' });
    }
  }
}

// 정적 데이터 — 파싱 결과 1회 캐시 (요청마다 readFileSync 블로킹 방지)
let seismicTableCache = null;
app.get('/seismic-data', (req, res) => {
  try {
    if (!seismicTableCache) {
      const lines = readFileSync(TJMA_PATH, 'utf-8').split('\n');
      const result = {};
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length === 6 && parts[0] === 'P' && parts[2] === 'S') {
          const depth = parts[4];
          (result[depth] ??= []).push({
            distance: parseFloat(parts[5]),
            pTime: parseFloat(parts[1]),
            sTime: parseFloat(parts[3]),
          });
        }
      }
      seismicTableCache = result;
    }
    res.json(seismicTableCache);
  } catch (error) {
    console.warn('Failed to read seismic data:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// latest.json은 폴러가 1Hz로 수신한 캐시를 서빙 (요청마다 kmoni 두드리지 않음)
// optimal_delay_ms: 폴러가 적응한 발행 지연 — 클라이언트가 이 만큼을 latest_time에서 빼 요청해야 버퍼에 항상 있음
app.get('/latest-time', (req, res) => {
  const cached = buffer.getLatestJson();
  if (cached) return res.json({ ...cached, optimal_delay_ms: buffer.getOptimalDelay() });
  const delayMs = buffer.getOptimalDelay();
  // 폴러 캐시 없음(기동 직후/kmoni 장애) → JST 현재 시각(-2초) fallback
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000 - 2000);
  const p = (n) => String(n).padStart(2, '0');
  const y = nowJST.getUTCFullYear();
  const mm = p(nowJST.getUTCMonth() + 1);
  const dd = p(nowJST.getUTCDate());
  const hh = p(nowJST.getUTCHours());
  const mi = p(nowJST.getUTCMinutes());
  const ss = p(nowJST.getUTCSeconds());
  res.json({
    security_time: `${y}${mm}${dd}${hh}${mi}${ss}`,
    latest_time: `${y}/${mm}/${dd} ${hh}:${mi}:${ss}`,
    fallback: true,
    optimal_delay_ms: delayMs,
  });
});

app.get('/acmap-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  sendImage(res, time, req.query['type'] === 'jma_b' ? 'acmap_b' : 'acmap_s', false);
});

app.get('/realtime-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  sendImage(res, time, req.query['type'] === 'jma_b' ? 'jma_b' : 'jma_s', false);
});

app.get('/pswave-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  sendImage(res, time, 'PSWaveImg', true);
});

app.get('/estshindo-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  sendImage(res, time, 'EstShindoImg', true);
});

// Discord 웹후크 릴레이 — /api/webhook/{detect,eew} (server/webhook.mjs, 전역 레이트 리밋 공유)
app.use('/webhook', webhookApp);

// 감지 기록 저장소 — /api/history (GET 목록, POST /detect 적재)
app.use('/history', historyApp);

export default app;
