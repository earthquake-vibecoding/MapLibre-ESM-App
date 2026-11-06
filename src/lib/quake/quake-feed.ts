import { p2pQuakeService } from '../services/p2p-quake.svelte';
import { wolfxEewService } from '../services/wolfx-eew.svelte';
import { notificationService } from '../services/notification.svelte';
import { soundService } from '../services/sound';
import { ui } from '../state.svelte';
import { getQuakeUniqueKey } from './quake-utils';
import { focusOnEarthquake } from '../focus';
import { TIMING } from '../config';
import type { AppController } from '../app-controller';

let lastSeenQuakeId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** 20초 이력 폴링 중지 — destroy 시 누수 방지 */
export function stopQuakeFeed(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export interface QuakeFeedHandlers {
  onInitialQuake: (item: any) => void;
  onNewQuake: (item: any) => void;
  onEew: (mappedEew: any) => void;
}

export function createFeedHandlers(c: AppController): QuakeFeedHandlers {
  return {
    onInitialQuake: (item) => {
      c.updateEpicenter(item);
      c.updateAreaIntensity(item);
      c.setTab('earthquake');
    },
    onNewQuake: (data) => handleNewQuake(c, data),
    onEew: (mappedEew) => handleEew(c, mappedEew)
  };
}

function handleNewQuake(c: AppController, data: any): void {
  // Shindo.wav만 — 진도음 계급은 p2p 소식 진도값이 아니라 실시간 감지(playShakeDetected)가 담당
  soundService.playShindoAudio();
  notificationService.notifyQuake(data);
  c.setTab('earthquake');
  c.updateEpicenter(data);
  c.updateAreaIntensity(data);
  focusOnEarthquake(c.mapCtl, data, c.areaData?.areaForecastGeoJSON);
}

function handleEew(c: AppController, mappedEew: any): void {
  if (!mappedEew) return;
  const eewKey = `${mappedEew.AnnouncedTime || ''}_${mappedEew.OriginTime || ''}_${mappedEew.Hypocenter || ''}_${mappedEew.MaxIntensity || ''}`;
  const now = Date.now();

  wolfxEewService.eewData = mappedEew;
  wolfxEewService.isEewDismissed = false;

  // 사운드/알림을 지도 갱신보다 먼저 — 맵 로드 전 EEW 수신 시 예외로 소리를 놓치지 않게
  if (eewKey !== c.lastEewKey || (now - c.lastEewTime > TIMING.eewSoundGapMs)) {
    c.lastEewKey = eewKey;
    c.lastEewTime = now;
    // Shindo.wav만 — 진도음 계급은 예보(MaxIntensity)가 아니라 실측 감지가 담당
    soundService.playShindoAudio();
    notificationService.notifyEew(mappedEew);
  }
  c.updateEpicenter();
  // 예보 구역/지점이 있을 때만 색칠 — areas 없는 EEW(wolfx)가 기존 지진 탭 색을 지우지 않게 (원본은 EEW에서 색칠 안 함)
  if (mappedEew.areas?.length || mappedEew.points?.length) {
    c.updateAreaIntensity(mappedEew);
  }
  c.updateVisibility();
}

export async function startQuakeFeed(handlers: QuakeFeedHandlers): Promise<void> {
  ui.historyOffset = 0;
  const history = await p2pQuakeService.fetchHistory(0);
  if (history.length > 0) {
    const latest = history[0];
    lastSeenQuakeId = getQuakeUniqueKey(latest);
    p2pQuakeService.selectedQuake = latest;
    handlers.onInitialQuake(latest);
  }

  p2pQuakeService.connectWebSocket(
    (data) => {
      const newKey = getQuakeUniqueKey(data);
      if (newKey && newKey !== lastSeenQuakeId) {
        lastSeenQuakeId = newKey;
        p2pQuakeService.selectedQuake = data;
        handlers.onNewQuake(data);
      }
    },
    (mappedEew) => handlers.onEew(mappedEew)
  );

  wolfxEewService.connectWebSocket((_mappedEew) => handlers.onEew(_mappedEew));

  if (typeof window !== 'undefined') {
    stopQuakeFeed();
    pollTimer = setInterval(async () => {
      const updatedHistory = await p2pQuakeService.fetchHistory(0);
      if (updatedHistory.length > 0) {
        const newest = updatedHistory[0];
        const newKey = getQuakeUniqueKey(newest);
        if (newKey && newKey !== lastSeenQuakeId) {
          lastSeenQuakeId = newKey;
          p2pQuakeService.selectedQuake = newest;
          handlers.onNewQuake(newest);
        }
      }
    }, TIMING.quakePollMs);
  }
}
