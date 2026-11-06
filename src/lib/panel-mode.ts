import { app } from './app-controller';
import { ui } from './state.svelte';
import { loadStations } from './quake/stations';
import { setPanelRelay } from './quake/station-relay';
import { VIEW } from './config';

/** 외부 미니 창 모드 여부 (main.cjs가 ?panel=station 으로 로드) */
export const isPanelMode =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('panel') === 'station';

/** Electron 외부 패널 브리지 존재 여부 — 없으면(브라우저) PiP 버튼을 숨기는 데 씀 */
export const hasPanelBridge = typeof window !== 'undefined' && !!window.quakeBridge?.panel;

/**
 * 패널 창 초기화: 맵/피드 없이 정적 관측소 목록만 로드하고,
 * 실시간 필드(jindo/deltaSum/event/history)는 메인 창 릴레이로 덮어씀
 */
export async function initPanelMode(): Promise<void> {
  document.body.style.background = 'transparent'; // 프레임리스 라운드 윈도우용
  app.stationsState = (await loadStations()).stationsState;
  ui.stationsLoaded = true;
  const bridge = window.quakeBridge?.panel;
  bridge?.onData((d) => {
    const s = app.stationsState.get(d.code);
    if (s) Object.assign(s, d);
  });
  bridge?.onSelect((code) => {
    ui.stationPanelCode = code;
  });
}

/** 선택 관측소 → 패널 창 동기화 (브리지 없는 브라우저 no-op) */
export function sendPanelSelect(code: string | null): void {
  window.quakeBridge?.panel?.select(code);
}

export function togglePanelWindow(): void {
  window.quakeBridge?.panel?.toggle();
}

/** 메인 창: 패널 창 개폐/플라이/선택 이벤트 배선 (브리지 없으면 no-op) */
export function initPanelBridge(onOpenChange: (open: boolean) => void): void {
  const bridge = window.quakeBridge?.panel;
  if (!bridge) return;
  bridge.onState((open) => {
    onOpenChange(open);
    setPanelRelay(open);
    // 열림 직후 현재 선택 동기화 — $effect는 값 변경에만 반응해서 패널이 나중에 열리면 못 받음
    if (open) sendPanelSelect(ui.stationPanelCode);
  });
  bridge.isOpen().then((open) => {
    onOpenChange(open);
    setPanelRelay(open);
  });
  bridge.onFlyTo((lonlat) => app.mapCtl?.flyTo({ center: lonlat, ...VIEW.stationFly }));
  // 패널 창에서 고른 관측소 → 메인 선택 갱신 (릴레이 대상 + 오버레이가 따라옴)
  bridge.onSelect((code) => {
    ui.stationPanelCode = code;
  });
}
