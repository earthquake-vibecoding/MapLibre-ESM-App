// Discord 웹후크 릴레이 — WEBHOOK_URL은 서버 env로만 존재(클라이언트 번들 유출 방지).
// 클라이언트는 /api/webhook/{detect,eew}로 타입드 데이터만 보내고, 임베드 조립·발송은 여기서 담당.
// reacct-eqm-1 server/webhook-notifier.ts 정책 이식: 감지 60s 쿨다운, EEW 후속 보는 메시지 PATCH로 병합.
import express from 'express';

const app = express();
app.use(express.json({ limit: '8kb' }));

const DETECT_COOLDOWN_MS = 60_000;
const EEW_COOLDOWN_MS = 5_000;
let detectCooldownUntil = 0;
let eewCooldownUntil = 0;
let lastEewMessage = null; // { id, originTime } — 같은 지진의 후속 보 PATCH 대상

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
  };
}

export function buildDetectEmbed(v) {
  const fields = [
    { name: '최대 진도', value: `**${v.scaleLabel}** (계측 ${v.maxJindo.toFixed(1)})`, inline: true },
    { name: '감지 관측소', value: `${v.count}개소`, inline: true },
  ];
  if (v.center) {
    fields.push({ name: '중심(위도, 경도)', value: `${v.center[1].toFixed(2)}, ${v.center[0].toFixed(2)}`, inline: true });
  }
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

/** 같은 지진(OriginTime 동일)의 후속 보는 기존 메시지 PATCH, 새 지진은 POST */
export function nextEewAction(last, originTime) {
  return last && last.originTime === originTime ? 'patch' : 'post';
}

async function requestDiscord(url, method, payload, wait) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(wait ? `${url}?wait=true` : url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return wait ? await res.json().catch(() => null) : {};
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function disabled(res) {
  res.status(204).end();
}

app.post('/detect', async (req, res) => {
  if (!process.env.WEBHOOK_URL) return disabled(res);
  const body = validateDetect(req.body);
  if (!body) return res.status(400).json({ error: 'Invalid payload' });
  const now = Date.now();
  if (now < detectCooldownUntil) return disabled(res);
  detectCooldownUntil = now + DETECT_COOLDOWN_MS;
  const ok = await requestDiscord(process.env.WEBHOOK_URL, 'POST', { embeds: [buildDetectEmbed(body)] }, false);
  res.status(ok ? 204 : 502).end();
});

app.post('/eew', async (req, res) => {
  if (!process.env.WEBHOOK_URL) return disabled(res);
  const body = validateEew(req.body);
  if (!body) return res.status(400).json({ error: 'Invalid payload' });
  const now = Date.now();
  if (now < eewCooldownUntil) return disabled(res);
  eewCooldownUntil = now + EEW_COOLDOWN_MS;
  const embed = buildEewEmbed(body);
  if (nextEewAction(lastEewMessage, body.originTime) === 'patch') {
    const ok = await requestDiscord(process.env.WEBHOOK_URL, 'PATCH', { embeds: [embed] }, false);
    if (!ok) lastEewMessage = null; // 메시지 삭제 등 실패 시 다음 보는 새 메시지로
    return res.status(ok ? 204 : 502).end();
  }
  const sent = await requestDiscord(process.env.WEBHOOK_URL, 'POST', { embeds: [embed] }, true);
  if (sent?.id && /^\d+$/.test(String(sent.id))) {
    lastEewMessage = { id: sent.id, originTime: body.originTime };
  }
  res.status(sent ? 204 : 502).end();
});

export default app;
