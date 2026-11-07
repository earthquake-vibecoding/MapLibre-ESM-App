// kmoni fetch 순수 로직 — URL 빌더 + 적응형 딜레이 탐색.
// reacct-eqm-1 server/upstream-fetchers.ts 패턴 이식: kmoni는 발행 지연이 수 초로 변동하므로
// 후보 딜레이를 순회해 첫 성공한 딜레이를 optimal로 기억한다. fetch는 주입형(테스트 대응).
const KMONI = 'http://www.kmoni.bosai.go.jp';
const FETCH_TIMEOUT_MS = 1800;
const GIF_MAGIC = 'GIF8';

/** epoch ms → kmoni 14자리 JST 스탬프 "YYYYMMDDHHmmss" */
export function jstStamp(ms) {
  const d = new Date(ms + 9 * 3600_000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** 실시간 진도 계열 (jma_s/jma_b/acmap_s/acmap_b) */
export function kmoniRealtimeImgUrl(time, type) {
  const dateStr = time.substring(0, 8);
  return `${KMONI}/data/map_img/RealTimeImg/${type}/${dateStr}/${time}.${type}.gif`;
}

/** EEW 계열 (PSWaveImg/EstShindoImg) */
export function kmoniEewImgUrl(time, kind) {
  const dateStr = time.substring(0, 8);
  return `${KMONI}/data/map_img/${kind}/eew/${dateStr}/${time}.eew.gif`;
}

/** kind → URL 디스패치 (버퍼 키와 엔드포인트 kind를 1:1로 맞추기 위함) */
export function kmoniImgUrl(time, kind) {
  return kind.startsWith('acmap') || kind.startsWith('jma_')
    ? kmoniRealtimeImgUrl(time, kind)
    : kmoniEewImgUrl(time, kind);
}

/** 후보 딜레이 목록 — 중복 제거, 1000~5000ms 클램프 (React 후보 순서 유지) */
export function candidateDelays(base) {
  const candidates = [base, base + 1000, base - 1000, 2000, 3000, 4000, 1000, 5000];
  return [...new Set(candidates)].filter((d) => d >= 1000 && d <= 5000);
}

async function fetchBuf(fetchImpl, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.subarray(0, 4).toString('latin1') === GIF_MAGIC ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 적응형 딜레이 탐색 — 후보 순서로 jma_s 프레임 fetch, 첫 성공이 정답.
 * 성공 → { timeStr, buf, delay }, 전부 실패 → null (매직바이트 불일치도 실패 취급).
 */
export async function fetchKmoniGif(fetchImpl, nowMs, baseDelay) {
  for (const delay of candidateDelays(baseDelay)) {
    const timeStr = jstStamp(nowMs - delay);
    const buf = await fetchBuf(fetchImpl, kmoniRealtimeImgUrl(timeStr, 'jma_s'));
    if (buf) return { timeStr, buf, delay };
  }
  return null;
}

/** kmoni latest.json → { security_time, latest_time } | null */
export async function fetchLatestJson(fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${KMONI}/webservice/server/pros/latest.json`, { signal: controller.signal });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text.startsWith('{')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
