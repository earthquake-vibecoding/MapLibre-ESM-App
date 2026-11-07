/**
 * 감지/EEW 리포트 → 서버 /api/webhook (server/webhook.mjs가 Discord 임베드로 조립·발송).
 * 서버에 WEBHOOK_URL env가 없으면 204로 무시 — 여기선 실패해도 무음 (감지·알림 파이프라인과 독립).
 */
import { WEBHOOK } from '../config';
import { jindoToScale, getJindoString, getIntensityColor } from '../quake/jma-utils';
import type { DetectionLogEntry } from '../detect/detection-log';

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    // 웹후크 실패는 무음 — 네트워크 단절이 감지 기능을 막지 않게
  }
}

/** 감지 에피소드 종료 리포트 — 에피소드 없으면 null, 진도1(WEBHOOK.minJindo) 미만 소음은 무시.
 *  서버 기록(/api/history, 이미지 제외)과 Discord 릴레이(/api/webhook, 지도 스냅샷 첨부)가 독립이라
 *  한쪽 실패가 다른 쪽을 막지 않음 */
export function reportDetectionEpisode(e: DetectionLogEntry | null, snapshot: string | null): void {
  if (!e || e.maxJindo < WEBHOOK.minJindo) return;
  const scale = jindoToScale(e.maxJindo);
  const body = {
    start: e.start,
    end: e.end,
    count: e.count,
    center: e.center,
    maxJindo: Math.round(e.maxJindo * 10) / 10,
    scaleLabel: getJindoString(scale),
    color: getIntensityColor(scale),
    top: e.top
      ? { name: e.top.name, region: e.top.region, jindo: Math.round(e.top.jindo * 10) / 10 }
      : null
  };
  void post('/api/history/detect', body);
  void post('/api/webhook/detect', snapshot ? { ...body, image: snapshot } : body);
}

/** EEW 수신 리포트 — 취소보/시뮬레이션 제외 (호출부 funnel 게이트와 동일 기준) */
export function reportEew(eew: any): void {
  if (!eew || eew.isCancel || eew.isSimulation) return;
  void post('/api/webhook/eew', {
    serial: eew.Serial,
    originTime: eew.OriginTime,
    hypocenter: eew.Hypocenter,
    mag: eew.Magunitude,
    depth: eew.Depth,
    maxIntensity: eew.MaxIntensity,
    isWarn: eew.isWarn === true,
    isFinal: eew.isFinal === true
  });
}
