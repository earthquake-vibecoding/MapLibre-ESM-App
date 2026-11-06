import { app } from './app-controller';
import { ui } from './state.svelte';
import { p2pQuakeService } from './services/p2p-quake.svelte';
import { createMapController } from './map/map-controller';
import { loadAreaData } from './quake/area-data';
import { loadStations } from './quake/stations';
import { fetchSeismicData } from './detect/seismic';
import { Ticker } from './ticker';
import { createFeedHandlers, startQuakeFeed, stopQuakeFeed } from './quake/quake-feed';
import { usgsService } from './services/usgs.svelte';
import { dbg } from './debug';
import { KEYS } from './config';

// HMR/리마운트 시 이전 initApp이 아직 await 중일 수 있음 — 시퀀스로 판별해 폐기
let initSeq = 0;

export function destroyApp(): void {
  initSeq++;
  stopQuakeFeed();
  usgsService.stop();
  app.destroy();
}

export async function initApp(container: HTMLElement): Promise<void> {
  const seq = ++initSeq;
  try {
    const savedType = localStorage.getItem(KEYS.dataType);
    if (savedType === 'jma_s' || savedType === 'jma_b') ui.realtimeDataType = savedType;
  } catch {
    // ignore
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('detect')) {
    urlParams.set('detect', 'true');
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
  }
  // DevTools 디버깅 핸들: window.__quake(전체 상태), window.__quakeLog(최근 로그). ?debug=1 → console 출력
  (window as any).__quakeDebug = urlParams.has('debug');
  (window as any).__quake = { ui, app };

  fetchSeismicData().then(data => {
    app.seismicData = data;
  });

  try {
    app.mapCtl = await createMapController(container);
  } catch (error) {
    console.warn('Failed to create map controller:', error);
  }
  if (seq !== initSeq) {
    // 대기 중에 destroy됨 — 새로 만든 맵이 있으면 회수하고 중단
    app.mapCtl?.destroy();
    return;
  }

  const [areaData, stationData] = await Promise.all([loadAreaData(), loadStations()]);
  if (seq !== initSeq) {
    app.mapCtl?.destroy();
    return;
  }
  app.areaData = areaData;
  app.geojson = stationData.geojson;
  app.stationsState = stationData.stationsState;
  ui.stationsLoaded = true;

  if (app.mapCtl) {
    app.mapCtl.setInitialData('points', app.geojson);
    app.mapCtl.setInitialData('area-forecast', areaData.areaForecastGeoJSON);
    app.mapCtl.setTheme(ui.isDarkMode);
    app.mapCtl.ready.then(() => onMapReady());
  }

  startTicker();
  startQuakeFeed(createFeedHandlers(app));
  usgsService.start();
}

function onMapReady(): void {
  app.applySavedDetectedEvents();
  const current = p2pQuakeService.selectedQuake || p2pQuakeService.p2pQuakeData;
  if (current) {
    app.updateEpicenter(current);
    app.updateAreaIntensity(current);
  }
  app.updateDetectedEvents();
  app.updateVisibility();
}

function startTicker(): void {
  app.ticker = new Ticker(app);
  app.ticker.start();
}
