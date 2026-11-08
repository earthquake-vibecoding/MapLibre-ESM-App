import type { EEWMessage } from '../models';
import { TIMING, SIM } from '../config';
import { t } from '../i18n/i18n';

export function parseJSTTime(str: any): number {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  if (typeof str === 'string' && !isNaN(Number(str)) && Number(str) > 1000000000000) return Number(str);

  if (typeof str === 'string' && (str.includes('Z') || str.includes('+') || str.includes('T'))) {
    const parsed = Date.parse(str);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const clean = String(str).replace(/[^\d]/g, '');
  if (clean.length >= 14) {
    const yyyy = parseInt(clean.substring(0, 4), 10);
    const mm = parseInt(clean.substring(4, 6), 10) - 1;
    const dd = parseInt(clean.substring(6, 8), 10);
    const hh = parseInt(clean.substring(8, 10), 10);
    const mi = parseInt(clean.substring(10, 12), 10);
    const ss = parseInt(clean.substring(12, 14), 10);
    return Date.UTC(yyyy, mm, dd, hh - 9, mi, ss);
  } else if (clean.length === 12) {
    const yyyy = parseInt(clean.substring(0, 4), 10);
    const mm = parseInt(clean.substring(4, 6), 10) - 1;
    const dd = parseInt(clean.substring(6, 8), 10);
    const hh = parseInt(clean.substring(8, 10), 10);
    const mi = parseInt(clean.substring(10, 12), 10);
    return Date.UTC(yyyy, mm, dd, hh - 9, mi, 0);
  }
  return 0;
}

/** 일본 근해 좌표 범위 — 진원 후보 판정 공용 */
export function isJapanCoord(lon: number, lat: number): boolean {
  return lon >= 120 && lon <= 155 && lat >= 20 && lat <= 55;
}

/** EEW 진원 좌표 유효성 — 누락/0/일본 밖 좌표 거부 (마커 표시와 지도 이동이 공용) */
export function isEewCoordValid(eew: any): boolean {
  return !!eew && typeof eew.Longitude === 'number' && typeof eew.Latitude === 'number'
    && eew.Longitude !== 0 && eew.Latitude !== 0
    && isJapanCoord(eew.Longitude, eew.Latitude);
}

/** p2p 551 지진 정보의 진원 좌표 유효성 — 진앙지 이동·자동 줌 폴백이 공용 */
export function isHypocenterValid(item: any): boolean {
  const hyp = item?.earthquake?.hypocenter;
  return !!hyp && typeof hyp.latitude === 'number' && typeof hyp.longitude === 'number'
    && hyp.latitude !== 0 && hyp.longitude !== 0
    && isJapanCoord(hyp.longitude, hyp.latitude);
}

export function isActiveEEW(eew: any): boolean {
  if (!eew) return false;
  if (eew.isCancel) return false;
  if (eew.isSimulation) {
    const elapsed = (Date.now() - (eew.simulationStartTime || Date.now())) / 1000 + (eew.simulatedElapsed || 5);
    return elapsed >= 0 && elapsed < 180;
  }

  const timeStr = eew.OriginTime || eew.AnnouncedTime || eew.ReportTime;
  if (!timeStr) return false;

  const origin = parseJSTTime(timeStr);
  if (!origin) return false;
  const elapsedSeconds = (Date.now() - origin) / 1000;

  return elapsedSeconds >= -TIMING.eewFutureAllowS && elapsedSeconds < TIMING.eewActiveWindowS;
}

export function getQuakeUniqueKey(item: any): string {
  if (!item) return '';
  const id = item.id;
  const eqTime = item.earthquake?.time || item.time || '';
  const issueType = item.issue?.type || '';
  const maxScale = item.earthquake?.maxScale ?? '';
  const hypName = item.earthquake?.hypocenter?.name || '';
  if (id) return `${id}_${eqTime}_${issueType}`;
  return `${eqTime}_${issueType}_${maxScale}_${hypName}`;
}

export function isUnknownQuake(item: any): boolean {
  if (!item) return false;
  const name = item.earthquake?.hypocenter?.name;
  const mag = item.earthquake?.hypocenter?.magnitude;
  const issueType = item.issue?.type;

  const isUnknownName = !name || name === '진원지 미상' || name === '진원지 정보 없음' || name === '不明' || name.includes('미상');
  const isUnknownMag = mag === -1 || mag === undefined || mag === 0;

  return isUnknownName || isUnknownMag || issueType === 'ScalePrompt';
}

export function buildMockEew(): EEWMessage {
  const nowMs = Date.now();
  const nowJST = new Date(nowMs + 9 * 60 * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const originTime =
    `${nowJST.getUTCFullYear()}/${pad(nowJST.getUTCMonth() + 1)}/${pad(nowJST.getUTCDate())} ` +
    `${pad(nowJST.getUTCHours())}:${pad(nowJST.getUTCMinutes())}:${pad(nowJST.getUTCSeconds())}`;

  return {
    Title: t('緊急地震速報 (모의 테스트)'),
    Issue: { Status: 'テスト' },
    AnnouncedTime: originTime,
    OriginTime: originTime,
    Hypocenter: t('도쿄 근해 (P/S파 모의 시뮬레이션)'),
    Latitude: SIM.lat,
    Longitude: SIM.lon,
    Magunitude: 6.5,
    Depth: 20,
    MaxIntensity: '5+',
    isWarn: true,
    isCancel: false,
    isSimulation: true,
    simulationStartTime: nowMs,
    simulatedElapsed: 10,
    areas: [
      { name: '東京都２３区', scaleFrom: 40 },
      { name: '東京都多摩東部', scaleFrom: 30 },
      { name: '千葉県北西部', scaleFrom: 45 },
      { name: '神奈川県東部', scaleFrom: 50 },
      { name: '埼玉県南部', scaleFrom: 30 },
      { name: '茨城県南部', scaleFrom: 30 }
    ]
  };
}

export interface EpicenterDeps {
  eew: any;
  tab: string;
  quake: any;
}

export function buildEpicenterFeatures({ eew, tab, quake }: EpicenterDeps): any[] {
  const features: any[] = [];

  if (eew && isActiveEEW(eew) && isEewCoordValid(eew)) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [eew.Longitude, eew.Latitude] },
      properties: { isEEW: true }
    });
    return features;
  }

  if (tab === 'realtime') {
    return features; // 실시간 탭엔 진원지 마커 없음 (선택 지진 X는 지진 탭 전용)
  }

  const targetData = quake;
  if (targetData) {
    let lon: number | null = null;
    let lat: number | null = null;

    if (targetData.earthquake?.hypocenter) {
      lon = targetData.earthquake.hypocenter.longitude;
      lat = targetData.earthquake.hypocenter.latitude;
    } else if (typeof targetData.Longitude === 'number' && typeof targetData.Latitude === 'number') {
      lon = targetData.Longitude;
      lat = targetData.Latitude;
    } else if (typeof targetData.longitude === 'number' && typeof targetData.latitude === 'number') {
      lon = targetData.longitude;
      lat = targetData.latitude;
    }

    if (lon !== null && lat !== null && typeof lon === 'number' && typeof lat === 'number'
      && isJapanCoord(lon, lat)) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {}
      });
    }
  }
  return features;
}
