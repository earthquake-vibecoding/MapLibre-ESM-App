/**
 * 감지/EEW 리포트 → 서버 /api/webhook (server/webhook.mjs가 Discord 임베드로 조립·발송).
 * 서버에 WEBHOOK_URL env가 없으면 204로 무시 — 여기선 실패해도 무음 (감지·알림 파이프라인과 독립).
 * 감지는 2단계: 시작 즉시 POST(지도 스냅샷 첨부, message id 수령) → 종료 시 같은 메시지에 최종 요약 PATCH.
 */
import { WEBHOOK } from '../config';
import { jindoToScale, getJindoString, getIntensityColor } from '../quake/jma-utils';
import type { DetectionLogEntry, LiveEpisode } from '../detect/detection-log';

interface DetectBody {
  start: number;
  end: number;
  count: number;
  center: [number, number] | null;
  maxJindo: number;
  scaleLabel: string;
  color: string;
  top: { name: string; region: string; jindo: number } | null;
}

function episodeBody(start: number, end: number, count: number, center: [number, number] | null, maxJindo: number, top: DetectBody['top']): DetectBody {
  const scale = jindoToScale(maxJindo);
  return {
    start,
    end,
    count,
    center,
    maxJindo: Math.round(maxJindo * 10) / 10,
    scaleLabel: getJindoString(scale),
    color: getIntensityColor(scale),
    top
  };
}

/** JSON 전송 — 성공 시 응답 JSON 반환(204는 {}), 실패/네트워크 오류 null. 실패해도 무음 (감지 파이프라인과 독립) */
async function sendJson(path: string, method: 'POST' | 'PATCH', body: object): Promise<any | null> {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    return await res.json().catch(() => ({}));
  } catch {
    return null;
  }
}

async function post(path: string, body: object): Promise<void> {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    // 무음
  }
}

/** 감지 에피소드 시작 — 진도1(WEBHOOK.minJindo) 미만이면 아직 무시(상승하면 ticker가 재시도).
 *  Discord 메시지 id+nonce를 받아 종료 PATCH 대상으로 보관 (다른 방문자가 먼저 보내 204면 null) */
let activeDetectMessage: { id: string; nonce: string } | null = null;

export async function reportDetectionStart(live: LiveEpisode, snapshot: string | null): Promise<void> {
  if (live.maxJindo < WEBHOOK.minJindo) return;
  const body = episodeBody(live.start, Date.now(), live.count, live.center, live.maxJindo, live.top);
  const withImage = snapshot ? { ...body, image: snapshot } : body;
  const sent = await sendJson('/api/webhook/detect', 'POST', withImage);
  if (sent?.id && sent?.nonce) activeDetectMessage = { id: sent.id, nonce: sent.nonce };
}

/** 감지 에피소드 종료 — 서버 기록(/api/history, 이미지 제외)은 항상 POST.
 *  Discord는 시작 메시지에 최종 요약 PATCH(스냅샷으로 이미지 교체), PATCH 거절(서버 재시작 등) 시 신규 POST */
export function reportDetectionEpisode(e: DetectionLogEntry | null, snapshot: string | null): void {
  const msg = activeDetectMessage;
  activeDetectMessage = null;
  if (!e || e.maxJindo < WEBHOOK.minJindo) return;
  const body = episodeBody(e.start, e.end, e.count, e.center, e.maxJindo, e.top
    ? { name: e.top.name, region: e.top.region, jindo: e.top.jindo }
    : null);
  void post('/api/history/detect', body);
  const withImage = snapshot ? { ...body, image: snapshot } : body;
  if (msg) {
    void sendJson('/api/webhook/detect', 'PATCH', { ...withImage, id: msg.id, nonce: msg.nonce })
      .then((ok) => { if (!ok) void post('/api/webhook/detect', withImage); });
  } else {
    void post('/api/webhook/detect', withImage);
  }
}

/** EEW 수신 리포트 — 취소보/시뮬레이션 제외 (호출부 funnel 게이트와 동일 기준).
 *  첫 보 POST 응답의 nonce를 후속 보에 실어 PATCH 병합 (nonce는 서버 발급이라 위조 불가) */
let eewNonce: string | null = null;

export function reportEew(eew: any): void {
  if (!eew || eew.isCancel || eew.isSimulation) return;
  const body: Record<string, unknown> = {
    serial: eew.Serial,
    originTime: eew.OriginTime,
    hypocenter: eew.Hypocenter,
    mag: eew.Magunitude,
    depth: eew.Depth,
    maxIntensity: eew.MaxIntensity,
    isWarn: eew.isWarn === true,
    isFinal: eew.isFinal === true
  };
  if (eewNonce) body.nonce = eewNonce;
  void sendJson('/api/webhook/eew', 'POST', body).then((j) => { if (j?.nonce) eewNonce = j.nonce; });
}
