import { p2pQuakeService } from '../services/p2p-quake.svelte';
import { wolfxEewService } from '../services/wolfx-eew.svelte';
import { notificationService } from '../services/notification.svelte';
import { soundService } from '../services/sound';
import { ui } from '../state.svelte';
import { TIMING } from '../config';
import { getQuakeUniqueKey, isUnknownQuake } from './quake-utils';
import { focusOnEarthquake } from '../focus';
import { startServerEvents, stopServerEvents } from '../services/server-events';
import type { AppController } from '../app-controller';

let lastSeenQuakeId: string | null = null;

/** destroy 시 SSE 정리 */
export function stopQuakeFeed(): void {
  stopServerEvents();
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
  // ScalePrompt(확정 전 진도속보)·진원지 미상은 소리/알림/탭 전환 생략 — 상세 통보(DetailScale)가 이어서 오므로 그때 울림
  if (!isUnknownQuake(data)) {
    // Shindo.wav만 — 진도음 계급은 p2p 소식 진도값이 아니라 실시간 감지(playShakeDetected)가 담당
    soundService.playShindoAudio();
    notificationService.notifyQuake(data);
    c.setTab('earthquake');
  }
  c.updateEpicenter(data);
  c.updateAreaIntensity(data);
  focusOnEarthquake(c.mapCtl, data, c.areaData?.areaForecastGeoJSON);
}

function handleEew(c: AppController, mappedEew: any): void {
  if (!mappedEew) return;
  // 취소 보고 — 소리/알림/지도 갱신 없이 무시. 서비스가 넣은 eewData는 ticker의 !isActiveEEW 경로가 정리(파 링·마스크·배너)
  if (mappedEew.isCancel) return;
  // 시뮬레이션 진행 중 실제 수신 차단 — 시뮬은 클라이언트 주입이라 이 funnel에서도 검사
  const current = wolfxEewService.eewData;
  if (current?.isSimulation && Date.now() - (current.simulationStartTime || 0) < TIMING.simGuardMs) return;

  const eewKey = `${mappedEew.AnnouncedTime || ''}_${mappedEew.OriginTime || ''}_${mappedEew.Hypocenter || ''}_${mappedEew.MaxIntensity || ''}`;
  const now = Date.now();

  wolfxEewService.eewData = mappedEew;
  wolfxEewService.isEewDismissed = false;

  // 사운드/알림을 지도 갱신보다 먼저 — 맵 로드 전 EEW 수신 시 예외로 소리를 놓치지 않게
  if (eewKey !== c.lastEewKey || (now - c.lastEewTime > TIMING.eewSoundGapMs)) {
    c.lastEewKey = eewKey;
    c.lastEewTime = now;
    // Shindo.wav만 — 진도음 계급은 예보(MaxIntensity)가 아니라 실측 감지가 담당 (웹후크는 서버가 직접 발사)
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

/** 초기 이력(서버 프록시) 로드 후 SSE 구독 — p2p/wolfx 직접 WS·20초 이력 폴링 폐지 */
export async function startQuakeFeed(handlers: QuakeFeedHandlers, host: AppController): Promise<void> {
  ui.historyOffset = 0;
  const history = await p2pQuakeService.fetchHistory(0);
  if (history.length > 0) {
    const latest = history[0];
    lastSeenQuakeId = getQuakeUniqueKey(latest);
    p2pQuakeService.selectedQuake = latest;
    handlers.onInitialQuake(latest);
  }

  startServerEvents({
    host,
    onQuake: (data) => {
      const newKey = getQuakeUniqueKey(data);
      if (newKey && newKey !== lastSeenQuakeId) {
        lastSeenQuakeId = newKey;
        handlers.onNewQuake(data);
      }
    },
    onEew: (mappedEew) => handlers.onEew(mappedEew)
  });
}
