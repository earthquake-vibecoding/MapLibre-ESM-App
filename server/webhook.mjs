// Discord 웹후크 릴레이 — WEBHOOK_URL은 서버 env로만 존재(클라이언트 번들 유출 방지).
// 클라이언트는 /api/webhook/{detect,eew}로 타입드 데이터만 보내고, 임베드 조립·발송은 여기서 담당.
// reacct-eqm-1 server/webhook-notifier.ts 정책 이식: 감지 60s 쿨다운, EEW 후속 보는 메시지 PATCH로 병합.
// 감지는 시작 POST(wait → message id) + 종료 PATCH(같은 메시지에 최종 요약) 2단계 — React lastAlertMessageId 패턴.
import express from 'express';
import { randomBytes } from 'node:crypto';
import { requestDiscord, detectPayload, disabled } from './discord.mjs';

const app = express();
app.use(express.json({ limit: '1mb' })); // 감지 리포트는 kmoni 프레임 PNG(base64)를 동반할 수 있음

const DETECT_COOLDOWN_MS = 60_000;
const EEW_COOLDOWN_MS = 60_000; // 신규 메시지 POST 한정 — 후속 보(PATCH)는 쿨다운 없이 통과
let detectCooldownUntil = 0;
let eewCooldownUntil = 0;
let lastDetectMessage = null; // { id, nonce } — 종료 PATCH는 이 조합만 허용 (무인증 엔드포인트로 임의 메시지 변조 차단)
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

/** "data:image/png;base64,…" 검증 → Buffer. 크기 상한 700KB, 이외는 null(첨부 없이 진행) */
export function extractPngDataUrl(v) {
  const m = typeof v === 'string' ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(v) : null;
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  return buf.length > 0 && buf.length <= 700_000 ? buf : null;
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

/** 같은 지진(OriginTime 동일)의 후속 보는 기존 메시지 PATCH, 새 지진은 POST */
export function nextEewAction(last, originTime) {
  return last && last.originTime === originTime ? 'patch' : 'post';
}

app.post('/detect', async (req, res) => {
  if (!process.env.WEBHOOK_URL) return disabled(res);
  const body = validateDetect(req.body);
  if (!body) return res.status(400).json({ error: 'Invalid payload' });
  const now = Date.now();
  if (now < detectCooldownUntil) return disabled(res);
  detectCooldownUntil = now + DETECT_COOLDOWN_MS;
  const image = extractPngDataUrl(req.body?.image);
  const sent = await requestDiscord(process.env.WEBHOOK_URL, 'POST', detectPayload(buildDetectEmbed(body), image), true);
  if (!sent) return res.status(502).end();
  if (sent.id && /^\d+$/.test(String(sent.id))) {
    lastDetectMessage = { id: String(sent.id), nonce: newNonce() };
    res.json(lastDetectMessage);
  } else {
    res.json({ id: null });
  }
});

// 에피소드 종료 — 시작 메시지에 최종 요약으로 덮어씀 (이미지도 최신 프레임으로 교체)
app.patch('/detect', async (req, res) => {
  if (!process.env.WEBHOOK_URL) return disabled(res);
  const body = validateDetect(req.body);
  const m = lastDetectMessage;
  if (!body || !m || req.body?.id !== m.id || req.body?.nonce !== m.nonce) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const image = extractPngDataUrl(req.body?.image);
  const ok = await requestDiscord(`${process.env.WEBHOOK_URL}/messages/${m.id}`, 'PATCH', detectPayload(buildDetectEmbed(body), image), false);
  res.status(ok ? 204 : 502).end();
});

app.post('/eew', async (req, res) => {
  if (!process.env.WEBHOOK_URL) return disabled(res);
  const body = validateEew(req.body);
  if (!body) return res.status(400).json({ error: 'Invalid payload' });
  const embed = buildEewEmbed(body);
  // 후속 보 = 같은 originTime + 서버가 발급한 nonce. 그 외는 신규 메시지로 쿨다운 적용
  if (nextEewAction(lastEewMessage, body.originTime) === 'patch' && req.body?.nonce === lastEewMessage.nonce) {
    const ok = await requestDiscord(process.env.WEBHOOK_URL, 'PATCH', JSON.stringify({ embeds: [embed] }), false);
    if (!ok) lastEewMessage = null; // 메시지 삭제 등 실패 시 다음 보는 새 메시지로
    return res.status(ok ? 204 : 502).end();
  }
  const now = Date.now();
  if (now < eewCooldownUntil) return disabled(res);
  eewCooldownUntil = now + EEW_COOLDOWN_MS;
  const sent = await requestDiscord(process.env.WEBHOOK_URL, 'POST', JSON.stringify({ embeds: [embed] }), true);
  if (!sent) return res.status(502).end();
  let nonce = null;
  if (sent.id && /^\d+$/.test(String(sent.id))) {
    nonce = newNonce();
    lastEewMessage = { id: String(sent.id), originTime: body.originTime, nonce };
  }
  res.json({ nonce });
});

export default app;
