import { app } from './app-controller';
import { ui } from './state.svelte';
import { p2pQuakeService } from './services/p2p-quake.svelte';
import { createMapController } from './map-controller';
import { loadAreaData } from './area-data';
import { loadStations } from './stations';
import { fetchSeismicData } from './seismic';
import { Ticker } from './ticker';
import { createFeedHandlers, startQuakeFeed, stopQuakeFeed } from './quake-feed';

// HMR/리마운트 시 이전 initApp이 아직 await 중일 수 있음 — 시퀀스로 판별해 폐기
let initSeq = 0;

export function destroyApp(): void {
  initSeq++;
  stopQuakeFeed();
  app.destroy();
}

export async function initApp(container: HTMLElement): Promise<void> {
  const seq = ++initSeq;
  try {
    const savedType = localStorage.getItem('realtime_data_type');
    if (savedType === 'jma_s' || savedType === 'jma_b') ui.realtimeDataType = savedType;
  } catch {
    // ignore
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('detect')) {
    urlParams.set('detect', 'true');
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
  }

  fetchSeismicData().then(data => {
    app.seismicData = data;
  });

  try {
    app.mapCtl = await createMapController(container);
  } catch (error) {
    console.warn('Failed to load maplibre-gl from esm.sh:', error);
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

  if (app.mapCtl) {
    app.mapCtl.setInitialData('points', app.geojson);
    app.mapCtl.setInitialData('area-forecast', areaData.areaForecastGeoJSON);
    app.mapCtl.setTheme(ui.isDarkMode);
    app.mapCtl.ready.then(() => onMapReady());
  }

  startTicker();
  startQuakeFeed(createFeedHandlers(app));
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
