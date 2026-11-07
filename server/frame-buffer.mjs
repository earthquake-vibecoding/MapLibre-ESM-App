// kmoni 프레임 버퍼 + 1Hz 백그라운드 폴러.
// 요청형 프록시의 504(kmoni 발행 지연/타임아웃)를 제거한다 — 폴러가 미리 받아둔 프레임을 즉시 서빙.
// 키가 정확히 일치하는 프레임만 반환(유사시간 대체 금지) — 감지기의 1프레임≈1초 가정과 replay 무결성 보호.
import { fetchKmoniGif, fetchLatestJson } from './kmoni-poll.mjs';

const TTL_MS = 15 * 60_000; // kmoni 프레임은 불변 — TTL은 메모리 상한용
const MAX_ENTRIES = 500; // 프레임 ~60KB × 500 ≈ 30MB 상한
const POLL_INTERVAL_MS = 1000;
const LATEST_FRESH_MS = 60_000; // latest.json 캐시 신선도 (kmoni 정지 시 마지막 실측값 유지)

export function createFrameBuffer({ fetchImpl = fetch, now = Date.now } = {}) {
  const frames = new Map(); // `${time}|${kind}` → { buf, type, at }
  let latest = null; // { body, at }
  let optimalDelay = 2000;
  let lastSuccessAt = 0;
  let consecutiveFailures = 0;

  function evict(t) {
    for (const [k, v] of frames) {
      if (t - v.at >= TTL_MS) frames.delete(k);
    }
    while (frames.size >= MAX_ENTRIES) frames.delete(frames.keys().next().value);
  }

  function put(time, kind, buf, type = 'image/gif') {
    if (!time || !kind || !Buffer.isBuffer(buf) || buf.length === 0) return;
    evict(now());
    frames.set(`${time}|${kind}`, { buf, type, at: now() });
  }

  function get(time, kind) {
    const hit = frames.get(`${time}|${kind}`);
    if (!hit) return null;
    if (now() - hit.at >= TTL_MS) {
      frames.delete(`${time}|${kind}`);
      return null;
    }
    return hit;
  }

  /** 폴러 1틱 — latest.json 1회 + jma_s 프레임 1장(적응형 딜레이) 적재 */
  async function pollOnce() {
    const body = await fetchLatestJson(fetchImpl);
    if (body) latest = { body, at: now() };
    const frame = await fetchKmoniGif(fetchImpl, now(), optimalDelay);
    if (frame) {
      optimalDelay = frame.delay;
      put(frame.timeStr, 'jma_s', frame.buf);
      lastSuccessAt = now();
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }
  }

  function getLatestJson() {
    return latest && now() - latest.at < LATEST_FRESH_MS ? latest.body : null;
  }

  return {
    put,
    get,
    pollOnce,
    getLatestJson,
    getOptimalDelay: () => optimalDelay,
    getConsecutiveFailures: () => consecutiveFailures,
    getLastSuccessAt: () => lastSuccessAt,
    size: () => frames.size,
  };
}

// --- 싱글턴 폴러 (api.mjs가 로드 시 start) ---
const singleton = createFrameBuffer();
let started = false;
let pollTimer = null;
let polling = false;

export function getFrameBuffer() {
  return singleton;
}

export function startKmoniPoller() {
  if (started) return;
  started = true;
  const loop = async () => {
    const t0 = Date.now();
    if (!polling) {
      polling = true;
      try {
        await singleton.pollOnce();
      } catch {
        // pollOnce는 내부에서 오류를 흡수하지만 방어막
      } finally {
        polling = false;
      }
    }
    if (started) pollTimer = setTimeout(loop, Math.max(50, POLL_INTERVAL_MS - (Date.now() - t0)));
  };
  loop();
}

export function stopKmoniPoller() {
  started = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}
