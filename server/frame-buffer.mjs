// kmoni 프레임 버퍼 + 1Hz 백그라운드 폴러.
// 요청형 프록시의 504(kmoni 발행 지연/타임아웃)를 제거한다 — 폴러가 미리 받아둔 프레임을 즉시 서빙.
// 키가 정확히 일치하는 프레임만 반환(유사시간 대체 금지) — 감지기의 1프레임≈1초 가정과 replay 무결성 보호.
import { fetchKmoniGif, fetchLatestJson } from './kmoni-poll.mjs';

const TTL_MS = 15 * 60_000; // kmoni 프레임은 불변 — TTL은 메모리 상한용
const MAX_ENTRIES = 500; // 프레임 ~60KB × 500 ≈ 30MB 상한
const POLL_INTERVAL_MS = 1000;
const LATEST_FRESH_MS = 60_000; // latest.json 캐시 신선도 (kmoni 정지 시 마지막 실측값 유지)
const OD_TTL_MS = 5 * 60_000;
const OD_MAX = 120; // on-demand 캐시 상한 — 외부 요청이 폴러 프레임을 밀어내지 못하게 별도 Map 분리

export function createFrameBuffer({ fetchImpl = fetch, now = Date.now } = {}) {
  const frames = new Map(); // `${time}|${kind}` → { buf, type, at } — 폴러 전용(감지 소스)
  const onDemand = new Map(); // 요청 경로 온디맨드 캐시 — 폴러 버퍼와 절대 섞이지 않음
  let latest = null; // { body, at }
  let optimalDelay = 2000;
  let lastPollTime = ''; // 마지막 적재 jma_s 스탬프 — 시간 역행/중복 프레임 차단
  let lastSuccessAt = 0;
  let consecutiveFailures = 0;

  function evict(store, ttl, max, t) {
    for (const [k, v] of store) {
      if (t - v.at >= ttl) store.delete(k);
    }
    while (store.size >= max) store.delete(store.keys().next().value);
  }

  function evictFrames(t) {
    evict(frames, TTL_MS, MAX_ENTRIES, t);
  }

  function put(time, kind, buf, type = 'image/gif') {
    if (!time || !kind || !Buffer.isBuffer(buf) || buf.length === 0) return;
    evictFrames(now());
    frames.set(`${time}|${kind}`, { buf, type, at: now() });
  }

  /** 요청 경로(on-demand fetch) 전용 — 폴러가 관리하는 감지 프레임 버퍼를 건드리지 않는다 */
  function putOnDemand(time, kind, buf, type = 'image/gif') {
    if (!time || !kind || !Buffer.isBuffer(buf) || buf.length === 0) return;
    evict(onDemand, OD_TTL_MS, OD_MAX, now());
    onDemand.set(`${time}|${kind}`, { buf, type, at: now() });
  }

  /** 폴러 버퍼 우선, 없으면 on-demand 캐시 폴백 */
  function get(time, kind) {
    const key = `${time}|${kind}`;
    const hit = frames.get(key);
    if (hit && now() - hit.at < TTL_MS) return hit;
    if (hit) frames.delete(key);
    const od = onDemand.get(key);
    if (!od) return null;
    if (now() - od.at >= OD_TTL_MS) {
      onDemand.delete(key);
      return null;
    }
    return od;
  }

  /** 폴러 1틱 — latest.json 1회 + jma_s 프레임 1장(적응형 딜레이) 적재. 신규 프레임 정보를 반환(없으면 null) */
  async function pollOnce() {
    const body = await fetchLatestJson(fetchImpl);
    if (body) latest = { body, at: now() };
    const frame = await fetchKmoniGif(fetchImpl, now(), optimalDelay);
    if (frame) {
      // 적응형 딜레이(base-1000 후포함)가 이전 틱보다 오래된/같은 프레임을 새 프레임으로
      // 적재하면 감지기가 감쇠 구간을 "흔들림 상승"으로 오판한다 — 역행/중복은 무시.
      if (frame.timeStr <= lastPollTime) return null;
      lastPollTime = frame.timeStr;
      optimalDelay = frame.delay;
      put(frame.timeStr, 'jma_s', frame.buf);
      lastSuccessAt = now();
      consecutiveFailures = 0;
      return frame;
    }
    consecutiveFailures++;
    return null;
  }

  function getLatestJson() {
    return latest && now() - latest.at < LATEST_FRESH_MS ? latest.body : null;
  }

  /** from(14자리 JST) 이후 jma_s 프레임 시간 오름차순 최대 cap장 — 부재 복귀 되감기(catch-up)용.
   *  삽입 순서에 의존하지 않고 시각으로 직접 정렬 (14자리 고정폭이라 문자열 비교가 곧 시간 비교). */
  function getFramesAfter(from, cap) {
    if (!/^\d{14}$/.test(from)) return [];
    const out = [];
    for (const [key, v] of frames) {
      if (!key.endsWith('|jma_s') || now() - v.at >= TTL_MS) continue;
      const time = key.slice(0, 14);
      if (time > from) out.push({ time, buf: v.buf });
    }
    out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return out.slice(-cap); // cap 초과 시 가장 오래된 것부터 버림 — 항상 최신 쪽까지 따라잡음
  }

  return {
    put,
    putOnDemand,
    get,
    pollOnce,
    getLatestJson,
    getFramesAfter,
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
let onFrameHook = null; // 신규 프레임 도착 시 호출 — 감지 러너가 등록

/** 신규 프레임 콜백 등록 — ({timeStr, buf, delayMs}) 인자. 러너 크래시가 폴러를 죽이지 않게 루프에서 방어 */
export function setOnFrame(fn) {
  onFrameHook = fn;
}

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
        const frame = await singleton.pollOnce();
        if (frame && onFrameHook) onFrameHook(frame);
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
