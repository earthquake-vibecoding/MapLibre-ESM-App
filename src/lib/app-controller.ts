import { ui, applyTheme, type Tab } from './state.svelte';
import { p2pQuakeService } from './services/p2p-quake.svelte';
import { wolfxEewService } from './services/wolfx-eew.svelte';
import type { AreaData } from './area-data';
import type { MapController } from './map-controller';
import type { Ticker } from './ticker';
import { buildDetectedFeatures, loadDetectedEvents, saveDetectedEvents } from './grid';
import { applyAreaIntensity } from './area-intensity';
import { buildEpicenterFeatures, buildMockEew, isActiveEEW } from './quake-utils';
import { focusActiveGrids, focusOnEarthquake, focusOnEew } from './focus';
import { updateMaskLayer } from './est-shindo';
import { soundService } from './services/sound';
import { notificationService } from './services/notification.svelte';
import { MAP_CENTER, MAP_ZOOM } from './map-style';

export class AppController {
  mapCtl: MapController | null = null;
  stationsState = new Map<string, any>();
  geojson: any = null;
  seismicData: any = {};
  areaData: AreaData | null = null;
  estEpi: [number, number] | null = null;
  ticker: Ticker | null = null;
  lastEewKey: string | null = null;
  lastEewTime = 0;

  destroy(): void {
    this.ticker?.stop();
    p2pQuakeService.disconnect();
    wolfxEewService.disconnect();
    this.mapCtl?.destroy();
  }

  // --- 지도 데이터 동기화 ---

  updateEpicenter(quake?: any): void {
    if (!this.mapCtl) return;
    const features = buildEpicenterFeatures({
      eew: wolfxEewService.eewData,
      tab: ui.activeTab,
      estEpi: this.estEpi,
      quake: quake ?? p2pQuakeService.selectedQuake
    });
    this.mapCtl.setSource('p2p-epicenter', { type: 'FeatureCollection', features });
  }

  updateAreaIntensity(quakeData: any): void {
    if (!this.mapCtl || !this.areaData) return;
    applyAreaIntensity(this.mapCtl.map, {
      quakeData,
      areaForecastGeoJSON: this.areaData.areaForecastGeoJSON,
      areaNameToCode: this.areaData.areaNameToCode,
      stationToAreaCode: this.areaData.stationToAreaCode,
      stationMap: ui.stationMap,
      isEarthquakeTab: ui.activeTab === 'earthquake'
    });
  }

  updateDetectedEvents(): void {
    const { features, gridCount } = buildDetectedFeatures(this.stationsState);
    this.mapCtl?.setSource('detected', { type: 'FeatureCollection', features });
    this.estEpi = null;
    ui.hasDetectedGrids = gridCount > 0;
    this.updateEpicenter();
    this.updateVisibility();
    saveDetectedEvents(this.stationsState);
  }

  updateVisibility(): void {
    if (!this.mapCtl) return;
    this.mapCtl.applyVisibility({
      tab: ui.activeTab,
      mode: ui.intensityDisplayMode,
      waveRings: ui.showWaveRings,
      eewActive: isActiveEEW(wolfxEewService.eewData),
      hasDetectedGrids: Array.from(this.stationsState.values()).some(s => s.event !== null),
      estEpi: this.estEpi
    });
  }

  applySavedDetectedEvents(): void {
    const { restored } = loadDetectedEvents(this.stationsState);
    if (!restored) return;
    this.updateDetectedEvents();
  }

  updateEstShindoMask(): void {
    updateMaskLayer(this.mapCtl, ui.estshindoGifUrl);
  }

  // --- UI 액션 ---

  setTab(tab: Tab): void {
    ui.isCleanMode = false;
    ui.activeTab = tab;
    this.updateVisibility();
    if (tab === 'est_shindo_region') {
      this.updateEstShindoMask();
      this.mapCtl?.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM, pitch: 0, bearing: 0, duration: 1000 });
    } else if (tab === 'earthquake') {
      if (!p2pQuakeService.selectedQuake && p2pQuakeService.p2pHistoryList.length > 0) {
        p2pQuakeService.selectedQuake = p2pQuakeService.p2pHistoryList[0];
      }
      const quake = p2pQuakeService.selectedQuake;
      if (quake) {
        this.updateAreaIntensity(quake);
        this.updateEpicenter(quake);
        focusOnEarthquake(this.mapCtl, quake, this.areaData?.areaForecastGeoJSON);
      }
    } else if (tab === 'realtime') {
      this.mapCtl?.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM, pitch: 0, bearing: 0, duration: 1000 });
    }
  }

  selectQuakeFromHistory(item: any): void {
    this.setTab('earthquake');
    p2pQuakeService.selectedQuake = item;
    this.updateEpicenter(item);
    this.updateAreaIntensity(item);
    focusOnEarthquake(this.mapCtl, item, this.areaData?.areaForecastGeoJSON);
  }

  loadMoreHistory(): void {
    ui.historyOffset += 100;
    p2pQuakeService.fetchHistory(ui.historyOffset);
  }

  toggleDarkMode(): void {
    ui.isDarkMode = !ui.isDarkMode;
    applyTheme();
    try {
      localStorage.setItem('quake_theme', ui.isDarkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
    this.mapCtl?.setTheme(ui.isDarkMode);
  }

  toggleWaveRings(): void {
    ui.showWaveRings = !ui.showWaveRings;
    this.updateVisibility();
  }

  setIntensityDisplayMode(mode: 'areas' | 'stations' | 'both'): void {
    ui.intensityDisplayMode = mode;
    this.updateVisibility();
  }

  setRealtimeDataType(type: 'jma_s' | 'jma_b'): void {
    ui.realtimeDataType = type;
    try {
      localStorage.setItem('realtime_data_type', type);
    } catch {
      // ignore
    }
    this.ticker?.refreshTime();
  }

  focusOnDetectedGrid(): void {
    if (!focusActiveGrids(this.mapCtl, this.stationsState)) {
      this.applySavedDetectedEvents();
    }
  }

  focusOnEew(): void {
    focusOnEew(this.mapCtl, wolfxEewService.eewData);
  }

  onFocusStation(st: { lat: number; lon: number; name: string; pref?: string; scale?: number }): void {
    this.mapCtl?.focusStation(st);
  }

  resetMapView(): void {
    this.mapCtl?.flyTo({ center: MAP_CENTER, zoom: MAP_ZOOM, pitch: 0, bearing: 0, duration: 800 });
    ui.isCleanMode = true;
  }

  exitCleanMode(): void {
    ui.isCleanMode = false;
  }

  triggerEewSimulation(): void {
    const mockEew = buildMockEew();
    if (ui.activeTab !== 'earthquake') this.setTab('earthquake');
    wolfxEewService.isEewDismissed = false;
    wolfxEewService.eewData = mockEew;
    this.updateEpicenter({ earthquake: { hypocenter: { latitude: 35.5, longitude: 140.0 } } });
    this.updateAreaIntensity(mockEew);
    this.updateVisibility();
    soundService.playShindoAudio('5+');
    notificationService.notifyEew(mockEew);
    this.mapCtl?.flyTo({ center: [140.0, 35.5], zoom: 6.8, speed: 1.2, duration: 1200 });
  }
}

export const app = new AppController();
