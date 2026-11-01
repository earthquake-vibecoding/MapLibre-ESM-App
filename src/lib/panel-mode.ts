import { app } from './app-controller';
import { ui } from './state.svelte';
import { loadStations } from './stations';

/** 외부 미니 창 모드 여부 (main.cjs가 ?panel=station 으로 로드) */
export const isPanelMode =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('panel') === 'station';

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
