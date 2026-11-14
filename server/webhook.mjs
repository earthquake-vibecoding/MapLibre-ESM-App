// Discord 웹후크 발송 — 감지 러너(detect-runner.mjs)/EEW 피드(eew-feed.mjs)가 직접 호출.
// WEBHOOK_URL은 서버 env로만 존재(클라이언트 번들 유출 방지). 클라이언트 엔드포인트는 서버 감지 전환으로 제거됨.
// reacct-eqm-1 server/webhook-notifier.ts 정책 이식: 감지 60s 쿨다운, EEW 후속 보는 메시지 PATCH로 병합.
// 감지는 시작 POST(wait → message id) + 종료 PATCH(같은 메시지에 최종 요약) 2단계 — React lastAlertMessageId 패턴.
import { randomBytes } from 'node:crypto';
import { requestDiscord, detectPayload } from './discord.mjs';

const DETECT_COOLDOWN_MS = 60_000;
const EEW_COOLDOWN_MS = 60_000; // 신규 메시지 POST 한정 — 후속 보(PATCH)는 쿨다운 없이 통과
let detectCooldownUntil = 0;
let eewCooldownUntil = 0;
let lastDetectMessage = null; // { id, nonce } — 종료 PATCH는 이 조합만 허용
let lastEewMessage = null;    // { id, originTime, nonce } — 같은 지진의 후속 보 PATCH 대상

function newNonce() {
  return randomBytes(16).toString('hex');
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function str(v, max) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}
function hexColor(v, fallback) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? parseInt(v.slice(1), 16) : fallback;
}

/** epoch ms → JST "HH:MM:SS" — kmoni/JMA 데이터가 전부 JST 기준이라 로컬 타임존 무시 */
function jstHms(ms) {
  const d = new Date(ms + 9 * 3600_000);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

/** 감지 리포트 바디 검증 — 엔트리 그대로 반환(임베드 빌더 입력), 무효면 null */
export function validateDetect(b) {
  if (!b || typeof b !== 'object') return null;
  const maxJindo = num(b.maxJindo);
  const count = num(b.count);
  const start = num(b.start);
  const end = num(b.end);
  if (maxJindo === null || count === null || start === null || end === null) return null;
  let center = null;
  if (Array.isArray(b.center) && b.center.length === 2) {
    const lon = num(b.center[0]);
    const lat = num(b.center[1]);
    if (lon !== null && lat !== null) center = [lon, lat];
  }
  return {
    maxJindo,
    count: Math.floor(count),
    start,
    end,
    center,
    scaleLabel: str(b.scaleLabel, 8) ?? '불명',
    color: hexColor(b.color, 0x95a5a6),
    top: validTop(b.top)
  };
}

function validTop(t) {
  if (!t || typeof t !== 'object') return null;
  const name = str(t.name, 60);
  if (!name) return null;
  return { name, region: str(t.region, 60) ?? '', jindo: num(t.jindo) };
}

export function buildDetectEmbed(v) {
  const fields = [];
  if (v.top) {
    const topValue = `${v.top.region} ${v.top.name}${v.top.jindo !== null ? ` 계측 ${v.top.jindo.toFixed(1)}` : ''}`.trim();
    fields.push({ name: '감지 격자 관측소', value: topValue, inline: false });
  }
  fields.push({ name: '최대 진도', value: `**${v.scaleLabel}** (계측 ${v.maxJindo.toFixed(1)})`, inline: true });
  fields.push({ name: '데이터 소스', value: '강진모니터(K-moni)', inline: true });
  if (v.center) {
    fields.push({ name: '중심(위도, 경도)', value: `${v.center[1].toFixed(2)}, ${v.center[0].toFixed(2)}`, inline: true });
  }
  fields.push({ name: '감지 관측소', value: `${v.count}개소`, inline: true });
  fields.push({ name: '시각 (JST)', value: `${jstHms(v.start)} ~ ${jstHms(v.end)}`, inline: false });
  return {
    title: '🚨 흔들림 감지',
    description: '관측망(kmoni)에서 실시간 흔들림이 감지되었습니다.',
    color: v.color,
    fields,
    timestamp: new Date(v.end).toISOString(),
  };
}

/** EEW 리포트 바디 검증 — originTime은 PATCH 병합 키라 필수 */
export function validateEew(b) {
  if (!b || typeof b !== 'object') return null;
  const hypocenter = str(b.hypocenter, 120);
  const originTime = str(b.originTime, 40);
  if (!hypocenter || !originTime) return null;
  return {
    serial: num(b.serial) ?? 1,
    originTime,
    hypocenter,
    mag: num(b.mag),
    depth: num(b.depth),
    maxIntensity: str(b.maxIntensity, 8),
    isWarn: b.isWarn === true,
    isFinal: b.isFinal === true,
  };
}

export function buildEewEmbed(e) {
  const tag = e.isFinal ? '최종보' : e.isWarn ? '경보' : '예보';
  return {
    title: `📡 긴급지진속보 (제${e.serial}보 · ${tag})`,
    color: e.isWarn ? 0xe74c3c : 0x5d6d7e,
    fields: [
      { name: '진원지', value: `**${e.hypocenter}**`, inline: false },
      { name: '규모', value: e.mag !== null ? `M${e.mag}` : '-', inline: true },
      { name: '깊이', value: e.depth !== null ? `${e.depth}km` : '-', inline: true },
      { name: '최대진도', value: e.maxIntensity ?? '-', inline: true },
    ],
    timestamp: new Date().toISOString(),
  };
}

/** 감지 리포트 POST — 웹후크 미설정/쿨다운/손상 시 null. 성공 시 {id, nonce} (종료 PATCH 대상) */
export async function sendDetectStart(body, pngBuf) {
  if (!process.env.WEBHOOK_URL) return null;
  const v = validateDetect(body);
  if (!v) return null;
  const now = Date.now();
  if (now < detectCooldownUntil) return null;
  detectCooldownUntil = now + DETECT_COOLDOWN_MS;
  const sent = await requestDiscord(process.env.WEBHOOK_URL, 'POST', detectPayload(buildDetectEmbed(v), pngBuf), true);
  if (!sent) return null;
  if (sent.id && /^\d+$/.test(String(sent.id))) {
    lastDetectMessage = { id: String(sent.id), nonce: newNonce() };
    return lastDetectMessage;
  }
  return null;
}

/** 감지 에피소드 종료 PATCH — 시작 메시지를 최종 요약으로 덮어씀. 실패 시 false (호출부가 신규 POST 폴백) */
export async function sendDetectFinal(body, pngBuf, msg) {
  if (!process.env.WEBHOOK_URL || !msg) return false;
  const v = validateDetect(body);
  if (!v) return false;
  const m = lastDetectMessage;
  if (!m || msg.id !== m.id || msg.nonce !== m.nonce) return false;
  return requestDiscord(`${process.env.WEBHOOK_URL}/messages/${m.id}`, 'PATCH', detectPayload(buildDetectEmbed(v), pngBuf), false);
}

/** EEW 리포트 — 후속 보(같은 originTime + 서버 발급 nonce)는 PATCH, 새 지진은 POST(쿨다운). 성공 시 {nonce} */
export async function sendEewReport(body) {
  if (!process.env.WEBHOOK_URL) return null;
  const v = validateEew(body);
  if (!v) return null;
  const embed = buildEewEmbed(v);
  if (lastEewMessage && lastEewMessage.originTime === v.originTime && body?.nonce === lastEewMessage.nonce) {
    // 메시지 수정은 /messages/{id} 경로만 — 루트 PATCH는 '웹후크 수정'(이름/아바타) 엔드포인트라 임베드를 무시하고 200으로 끝남
    const ok = await requestDiscord(`${process.env.WEBHOOK_URL}/messages/${lastEewMessage.id}`, 'PATCH', JSON.stringify({ embeds: [embed] }), false);
    if (!ok) lastEewMessage = null; // 메시지 삭제 등 실패 시 다음 보는 새 메시지로
    return ok ? {} : null;
  }
  const now = Date.now();
  if (now < eewCooldownUntil) return null;
  eewCooldownUntil = now + EEW_COOLDOWN_MS;
  const sent = await requestDiscord(process.env.WEBHOOK_URL, 'POST', JSON.stringify({ embeds: [embed] }), true);
  if (!sent) return null;
  let nonce = null;
  if (sent.id && /^\d+$/.test(String(sent.id))) {
    nonce = newNonce();
    lastEewMessage = { id: String(sent.id), originTime: v.originTime, nonce };
  }
  return { nonce };
}
