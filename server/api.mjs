// kmoni(기상청 강진모니터링) 프록시 API — dev(vite middleware)/prod(express) 공용
// 주의: Router 대신 mini express app을 export해야 connect에서 res.json 등 augment가 동작함
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = express();
const TJMA_PATH = fileURLToPath(new URL('../tjma2020a.-00000', import.meta.url));

const KMONI = 'http://www.kmoni.bosai.go.jp';
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

// 짧은 이미지 캐시 — 렌더러 1초 폴링마다 kmoni를 두드리지 않게 (지연 504 완화)
const IMG_CACHE_MS = 1500;
const imgCache = new Map(); // url -> { at, type, buf }

function sendCached(res, url) {
  const hit = imgCache.get(url);
  if (!hit || Date.now() - hit.at >= IMG_CACHE_MS) return false;
  res.setHeader('Content-Type', hit.type);
  res.send(hit.buf);
  return true;
}

function storeImage(url, type, buf) {
  const now = Date.now();
  for (const [k, v] of imgCache) {
    if (now - v.at >= IMG_CACHE_MS) imgCache.delete(k);
  }
  if (imgCache.size >= 12) imgCache.delete(imgCache.keys().next().value);
  imgCache.set(url, { at: now, type, buf });
}

async function sendImage(res, url, fallback) {
  if (sendCached(res, url)) return;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    storeImage(url, 'image/gif', buffer);
    res.setHeader('Content-Type', 'image/gif');
    res.send(buffer);
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

app.get('/latest-time', async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${KMONI}/webservice/server/pros/latest.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = (await response.text()).trim();
    if (!text.startsWith('{')) throw new Error('Invalid JSON response body from kmoni');
    res.json(JSON.parse(text));
  } catch {
    // kmoni 연결 타임아웃/실패 시 JST 현재 시각(-2초) fallback
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
    });
  }
});

function kmoniRealtimeImgUrl(time, type) {
  const dateStr = time.substring(0, 8);
  return `${KMONI}/data/map_img/RealTimeImg/${type}/${dateStr}/${time}.${type}.gif`;
}
function kmoniEewImgUrl(time, kind) {
  const dateStr = time.substring(0, 8);
  return `${KMONI}/data/map_img/${kind}/eew/${dateStr}/${time}.eew.gif`;
}

app.get('/acmap-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  const type = req.query['type'] === 'jma_b' ? 'acmap_b' : 'acmap_s';
  sendImage(res, kmoniRealtimeImgUrl(time, type), false);
});

app.get('/realtime-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  const imgType = req.query['type'] === 'jma_b' ? 'jma_b' : 'jma_s';
  sendImage(res, kmoniRealtimeImgUrl(time, imgType), false);
});

app.get('/pswave-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  sendImage(res, kmoniEewImgUrl(time, 'PSWaveImg'), true);
});

app.get('/estshindo-img', (req, res) => {
  const time = validTime(req, res);
  if (!time) return;
  sendImage(res, kmoniEewImgUrl(time, 'EstShindoImg'), true);
});

export default app;
