/**
 * 감지 이벤트 기록 — 만료 증발하는 감지를 에피소드 단위로 저장해 다시 볼 수 있게 함.
 * ticker가 만료 직전 accumulateExpiredEvent()를, 전체 종료 시 finishDetectionEpisode()를 호출.
 * localStorage 'detection_log'에 최신순 최대 50건.
 */

import { KEYS } from '../config';

export interface DetectionTopStation {
  name: string;
  region: string;
  jindo: number; // 그 관측소 이벤트 최대 계측진도
}

export interface DetectionLogEntry {
  id: string;
  start: number;   // 에피소드 시작 시각 (첫 이벤트 startTime)
  end: number;     // 기록 시각
  maxJindo: number; // 에피소드 중 최대 계측진도
  count: number;   // 감지 관측소 수
  center: [number, number];
  top?: DetectionTopStation | null; // 최대 진도 관측소 (웹후크 리포트용)
}

/** 감지 진행 중 라이브 상태 (웹후크 시작 리포트용) */
export interface LiveEpisode {
  start: number;
  count: number;
  maxJindo: number;
  center: [number, number] | null;
  top: DetectionTopStation | null;
}

const KEY = KEYS.detectionLog;
const MAX_ENTRIES = 50;

let episode = newEpisode();

function newEpisode() {
  return { start: Infinity, end: 0, maxJindo: -99, sumLon: 0, sumLat: 0, count: 0, top: null as DetectionTopStation | null };
}

/** 현재 진행 중인 감지의 라이브 집계 — 에피소드 시작 즉시 웹후크를 보내기 위한 스냅샷. 감지 없으면 null */
export function collectLiveEpisode(stationsState: Map<string, any>): LiveEpisode | null {
  let count = 0;
  let maxJindo = -99;
  let start = Infinity;
  let sumLon = 0;
  let sumLat = 0;
  let top: DetectionTopStation | null = null;
  for (const stn of stationsState.values()) {
    if (!stn.event) continue;
    count++;
    const evMax = stn.event.maxJindo ?? stn.jindo ?? -99;
    maxJindo = Math.max(maxJindo, evMax);
    start = Math.min(start, stn.event.startTime ?? Infinity);
    if (stn.lonlat) {
      sumLon += stn.lonlat[0];
      sumLat += stn.lonlat[1];
    }
    if (stn.name && (!top || evMax > top.jindo)) {
      top = { name: stn.name, region: stn.region ?? '', jindo: evMax };
    }
  }
  if (count === 0) return null;
  return {
    start: start === Infinity ? Date.now() : start,
    count,
    maxJindo,
    center: [sumLon / count, sumLat / count],
    top
  };
}

/** 만료되는 관측소의 이벤트 정보 누적 (event가 지워지기 직전에 호출) */
export function accumulateExpiredEvent(stn: any): void {
  if (!stn.event) return;
  episode.count++;
  episode.start = Math.min(episode.start, stn.event.startTime ?? Infinity);
  episode.maxJindo = Math.max(episode.maxJindo, stn.event.maxJindo ?? stn.jindo ?? -99);
  const evMax = stn.event.maxJindo ?? stn.jindo ?? -99;
  if (stn.name && (!episode.top || evMax > episode.top.jindo)) {
    episode.top = { name: stn.name, region: stn.region ?? '', jindo: evMax };
  }
  if (stn.lonlat) {
    episode.sumLon += stn.lonlat[0];
    episode.sumLat += stn.lonlat[1];
  }
}

/** 모든 감지가 끝난 순간 에피소드 1건 기록. 기록한 엔트리 반환(웹후크 리포트용), 에피소드가 없으면 null */
export function finishDetectionEpisode(): DetectionLogEntry | null {
  let saved: DetectionLogEntry | null = null;
  if (episode.count > 0 && episode.maxJindo > -99) {
    saved = {
      id: String(episode.start),
      start: episode.start === Infinity ? Date.now() : episode.start,
      end: Date.now(),
      maxJindo: episode.maxJindo,
      count: episode.count,
      center: [episode.sumLon / episode.count, episode.sumLat / episode.count],
      top: episode.top
    };
    const entries = getDetectionLog();
    entries.unshift(saved);
    saveLog(entries.slice(0, MAX_ENTRIES));
  }
  episode = newEpisode();
  return saved;
}

export function getDetectionLog(): DetectionLogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function clearDetectionLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

function saveLog(entries: DetectionLogEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // quota/private mode — 기록 실패는 치명적이지 않음
  }
}
