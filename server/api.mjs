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

async function sendImage(res, url, fallback) {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/gif');
    res.send(Buffer.from(buffer));
  } catch {
    if (fallback) {
      res.setHeader('Content-Type', 'image/gif');
      res.send(TRANSPARENT_GIF);
    } else {
      res.status(504).json({ error: 'Failed to fetch image or timeout' });
    }
  }
}

app.get('/seismic-data', (req, res) => {
  try {
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
    res.json(result);
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
  const time = req.query['time'];
  if (!time || typeof time !== 'string') {
    res.status(400).json({ error: 'Missing time parameter' });
    return;
  }
  const type = req.query['type'] === 'jma_b' ? 'acmap_b' : 'acmap_s';
  sendImage(res, kmoniRealtimeImgUrl(time, type), false);
});

app.get('/realtime-img', (req, res) => {
  const time = req.query['time'];
  if (!time || typeof time !== 'string') {
    res.status(400).json({ error: 'Missing time parameter' });
    return;
  }
  const imgType = req.query['type'] === 'jma_b' ? 'jma_b' : 'jma_s';
  sendImage(res, kmoniRealtimeImgUrl(time, imgType), false);
});

app.get('/pswave-img', (req, res) => {
  const time = req.query['time'];
  if (!time || typeof time !== 'string') {
    res.status(400).json({ error: 'Missing time parameter' });
    return;
  }
  sendImage(res, kmoniEewImgUrl(time, 'PSWaveImg'), true);
});

app.get('/estshindo-img', (req, res) => {
  const time = req.query['time'];
  if (!time || typeof time !== 'string') {
    res.status(400).json({ error: 'Missing time parameter' });
    return;
  }
  sendImage(res, kmoniEewImgUrl(time, 'EstShindoImg'), true);
});

export default app;
