// 서버 감지 러너 — 클라이언트 없이 감지 판정 → 웹후크/기록/SSE 푸시 (사이트가 닫혀도 동작).
// 판정 로직은 detect-core.mjs(esbuild 번들 — 클라이언트 detector와 동일 코드).
// 사운드/알림/관심지역 필터는 개인 설정이라 클라이언트 몫 — 서버는 상태만 푸시.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeGifRgba } from './gif-decode.mjs';
import { encodePng, drawDetectBounds } from './png-encode.mjs';
import { getFrameBuffer, setOnFrame } from './frame-buffer.mjs';
import { sendDetectStart, sendDetectFinal } from './webhook.mjs';
import { getHistoryStore } from './history.mjs';
import { broadcast, setHelloProvider } from './push.mjs';

let core = null; // detect-core.mjs (동적 import — 미빌드 시 감지 비활성)
let stations = null; // { features, stationsState }
let historyStore = null;
let started = false;

// 에피소드 엣지 상태 — 클라이언트 ticker.ts 로직 포트
let wasDetecting = false;
let pendingStart = false;
let activeDetectMessage = null; // { id, nonce } — 종료 PATCH 대상

// 마지막 활성 프레임 — 종료 리포트 스냅샷(흔들림 당시 프레임)용
let lastActive = null; // { rgba, width, height, hits }

function resolveStationsPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const rel of ['../dist/intensity-points-v1.json', '../public/intensity-points-v1.json']) {
    const p = path.resolve(here, rel);
    if (fs.existsSync(p)) return p;
  }
  throw new Error('intensity-points-v1.json 없음 (dist/public 확인)');
}

function eventHits() {
  const hits = [];
  for (const f of stations.features) {
    if (!Number.isFinite(f.properties.px) || !Number.isFinite(f.properties.py)) continue;
    if (stations.stationsState.get(f.properties.code)?.event) hits.push({ x: f.properties.px, y: f.properties.py });
  }
  return hits;
}

/** stn.color 'rgba(r,g,b,a)' → 0xRRGGBB 팩킹. 투명/없음 → -1 (kmoni 연속 컬러맵 유지용) */
function stnColorInt(stn) {
  const m = stn && stn.color ? /^rgba\((\d+),(\d+),(\d+),/.exec(stn.color) : null;
  if (!m) return -1;
  return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
}

/** 스냅샷 PNG — kmoni 프레임 + 감지 전체 영역 바운딩 박스 (밀집 시 점 사각형이 통짜가 되어 제거) */
function composeSnapshot(rgba, width, height, hits) {
  const copy = rgba.slice();
  drawDetectBounds(copy, width, height, hits);
  return encodePng(copy, width, height);
}

function expireStations(nowTick) {
  let expiredAny = false;
  for (const stn of stations.stationsState.values()) {
    if (stn.event && nowTick > stn.expireTime) {
      core.accumulateExpiredEvent(stn);
      stn.event = null;
      stn.expireTime = null;
      expiredAny = true;
    }
  }
  return expiredAny;
}

async function reportStart(live, decoded) {
  const body = core.makeEpisodeBody(live.start, Date.now(), live.count, live.center, live.maxJindo, live.top);
  const png = composeSnapshot(decoded.rgba, decoded.width, decoded.height, eventHits());
  const sent = await sendDetectStart(body, png);
  if (sent?.id && sent?.nonce) activeDetectMessage = sent;
}

async function reportFinal(entry) {
  const msg = activeDetectMessage;
  activeDetectMessage = null;
  if (!entry || entry.maxJindo < core.WEBHOOK.minJindo) return;
  const body = core.makeEpisodeBody(entry.start, entry.end, entry.count, entry.center, entry.maxJindo, entry.top);
  historyStore.add(body);
  const src = lastActive ?? null;
  const png = src ? composeSnapshot(src.rgba, src.width, src.height, src.hits) : null;
  if (msg) {
    const ok = await sendDetectFinal(body, png, msg);
    if (!ok) void sendDetectStart(body, png); // PATCH 거절(서버 재시작 등) — 신규 POST 폴백
  } else {
    void sendDetectStart(body, png);
  }
}

function onFrame({ timeStr, buf, delay }) {
  if (!stations) return;
  const decoded = decodeGifRgba(buf);
  if (!decoded) return;
  const nowTick = Date.now();
  const expiredAny = expireStations(nowTick);

  const result = core.processFrame(decoded.rgba, decoded.width, decoded.height, stations.features, stations.stationsState, true);

  // 감지 시작 엣지 — 진도1 이상이면 즉시 웹후크(클라이언트 ticker 로직과 동일)
  let activeCount = 0;
  for (const stn of stations.stationsState.values()) if (stn.event) activeCount++;
  if (activeCount > 0 && !wasDetecting) pendingStart = true;
  wasDetecting = activeCount > 0;
  if (pendingStart && activeCount > 0) {
    const live = core.collectLiveEpisode(stations.stationsState);
    if (live && live.maxJindo >= core.WEBHOOK.minJindo) {
      pendingStart = false;
      void reportStart(live, decoded).catch(err => console.error('[Detect] 시작 리포트 실패:', err));
    }
  }
  if (activeCount > 0) {
    lastActive = { rgba: decoded.rgba.slice(), width: decoded.width, height: decoded.height, hits: eventHits() };
  }

  // 감지 종료 엣지 — 마지막 격자 만료 시 에피소드 확정 + 기록 + 웹후크 최종 PATCH
  let ended = null;
  if (expiredAny && activeCount === 0) {
    const entry = core.finishDetectionEpisode();
    if (entry) {
      ended = entry;
      void reportFinal(entry).catch(err => console.error('[Detect] 종료 리포트 실패:', err));
      lastActive = null;
    }
  }

  // SSE frame 푸시 — j[]/c[]는 관측소 순서(intensity-points-v1.json)와 정렬. -30 = 진도 없음, c -1 = 투명 픽셀
  const j = [];
  const c = [];
  const ev = [];
  for (const f of stations.features) {
    const stn = stations.stationsState.get(f.properties.code);
    j.push(stn && stn.jindo !== null ? Math.round(stn.jindo * 10) : -30);
    c.push(stnColorInt(stn));
    if (stn?.event) {
      ev.push({ c: stn.code, m: Math.round((stn.event.maxJindo ?? stn.jindo ?? -3) * 10), s: stn.event.startTime });
    }
  }
  broadcast('frame', {
    time: timeStr,
    delayMs: delay,
    gif: buf.toString('base64'),
    j,
    c,
    ev,
    sound: result.soundJindo > -3 ? result.soundJindo : null,
    center: result.newEventCenter,
    ended
  });
}

/** api.mjs가 로드 시 호출 — 미빌드(detect-core.mjs 없음)면 감지 비활성하고 계속 */
export function startDetectRunner() {
  if (started) return;
  started = true;
  (async () => {
    try {
      core = await import('./detect-core.mjs');
      const points = JSON.parse(fs.readFileSync(resolveStationsPath(), 'utf-8'));
      stations = core.initDetectCore(points);
      historyStore = getHistoryStore();
      setOnFrame(frame => {
        try {
          onFrame(frame);
        } catch (err) {
          console.error('[Detect] onFrame 오류:', err);
        }
      });
      console.log('[Detect] 서버 감지 러너 시작 — 관측소', stations.stationsState.size);
    } catch (err) {
      console.error('[Detect] 러너 초기화 실패 — 감지 비활성 (pnpm build:detect 필요):', err?.message ?? err);
    }
  })();

  setHelloProvider(() => {
    const b = getFrameBuffer();
    const latest = b.getLatestJson();
    return { latestTime: latest?.latest_time ?? null, delayMs: b.getOptimalDelay() };
  });
}
