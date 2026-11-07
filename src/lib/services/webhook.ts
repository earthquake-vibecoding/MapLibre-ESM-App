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

/** 감지 에피소드 종료 리포트 — 에피소드 없으면 null, 진도1(WEBHOOK.minJindo) 미만 소음은 무시 */
export function reportDetectionEpisode(e: DetectionLogEntry | null): void {
  if (!e || e.maxJindo < WEBHOOK.minJindo) return;
  const scale = jindoToScale(e.maxJindo);
  void post('/api/webhook/detect', {
    start: e.start,
    end: e.end,
    count: e.count,
    center: e.center,
    maxJindo: Math.round(e.maxJindo * 10) / 10,
    scaleLabel: getJindoString(scale),
    color: getIntensityColor(scale)
  });
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
