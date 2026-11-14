import { ui, applyTheme, type Tab } from './state.svelte';
import { p2pQuakeService } from './services/p2p-quake.svelte';
import { stopQuakeFeed } from './quake/quake-feed';
import { wolfxEewService } from './services/wolfx-eew.svelte';
import type { AreaData } from './quake/area-data';
import type { MapController } from './map/map-controller';
import type { Ticker } from './ticker';
import { buildDetectedFeatures, loadDetectedEvents, saveDetectedEvents } from './detect/grid';
import { applyAreaIntensity } from './quake/area-intensity';
import { buildEpicenterFeatures, buildMockEew, isActiveEEW } from './quake/quake-utils';
import { focusActiveGrids, focusOnEarthquake, focusOnEew, focusOnEpicenter } from './focus';
import { buildLocalMaskFc } from './quake/est-intensity';
import { clearMaskLayer, updateMaskLayer } from './quake/est-shindo';
import { soundService } from './services/sound';
import { notificationService } from './services/notification.svelte';
import { VIEW, KEYS, SIM } from './config';

export class AppController {
  mapCtl: MapController | null = null;
  stationsState = new Map<string, any>();
  geojson: any = null;
  seismicData: any = {};
  areaData: AreaData | null = null;
  ticker: Ticker | null = null;
  lastEewKey: string | null = null;
  lastEewTime = 0;

  destroy(): void {
    this.ticker?.stop();
    stopQuakeFeed(); // SSE 구독 정리
    this.mapCtl?.destroy();
  }

  // --- 지도 데이터 동기화 ---

  updateEpicenter(quake?: any): void {
    if (!this.mapCtl) return;
    const features = buildEpicenterFeatures({
      eew: wolfxEewService.eewData,
      tab: ui.activeTab,
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
    ui.hasDetectedGrids = gridCount > 0;
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
      hasDetectedGrids: Array.from(this.stationsState.values()).some(s => s.event !== null)
    });
  }

  applySavedDetectedEvents(): void {
    const { restored } = loadDetectedEvents(this.stationsState);
    if (!restored) return;
    this.updateDetectedEvents();
  }

  /** EEW 예상진도 마스크 — 실제 EEW는 kmoni EstShindoImg 프레임(JMA 예측) 샘플링,
   *  시뮬은 kmoni 프레임이 없으니 감쇠식(est-intensity)으로 색칠. ticker.updateWaves에서 호출 */
  updateEstShindoMask(): void {
    if (!this.mapCtl) return;
    const eew = wolfxEewService.eewData;
    if (eew?.isSimulation && this.areaData) {
      this.mapCtl.setSource('est-shindo-mask-area', buildLocalMaskFc(this.areaData.areaForecastGeoJSON.features, eew));
      return;
    }
    updateMaskLayer(this.mapCtl, ui.estshindoGifUrl);
  }

  clearEstShindoMask(): void {
    if (this.mapCtl) clearMaskLayer(this.mapCtl);
  }

  // --- UI 액션 ---

  setTab(tab: Tab): void {
    ui.isCleanMode = false;
    ui.activeTab = tab;
    this.updateVisibility();
    if (tab === 'earthquake') {
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
      this.updateEstShindoMask(); // 탭 전환 즉시 마스크 반영 (EEW 중엔 kmoni 프레임, 시뮬엔 감쇠식)
      this.mapCtl?.fitFullView(1000);
    }
  }

  selectQuakeFromHistory(item: any): void {
    this.setTab('earthquake');
    p2pQuakeService.selectedQuake = item;
    this.updateEpicenter(item);
    this.updateAreaIntensity(item);
    focusOnEarthquake(this.mapCtl, item, this.areaData?.areaForecastGeoJSON);
  }

  /** 진앙지 이동 버튼: 선택 지진의 진원지로 플라이 */
  focusEpicenter(item: any): void {
    focusOnEpicenter(this.mapCtl, item);
  }

  loadMoreHistory(): void {
    ui.historyOffset += 100;
    p2pQuakeService.fetchHistory(ui.historyOffset);
  }

  toggleDarkMode(): void {
    ui.isDarkMode = !ui.isDarkMode;
    applyTheme();
    try {
      localStorage.setItem(KEYS.theme, ui.isDarkMode ? 'dark' : 'light');
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
      localStorage.setItem(KEYS.dataType, type);
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
    this.mapCtl?.fitFullView(800);
    ui.isCleanMode = true;
  }

  exitCleanMode(): void {
    ui.isCleanMode = false;
  }

  triggerEewSimulation(): void {
    const mockEew = buildMockEew();
    // 시뮬의 목적은 실시간 예상진도 확인 — 마스크·파 링·배너가 모두 있는 실시간 탭으로
    if (ui.activeTab !== 'realtime') this.setTab('realtime');
    wolfxEewService.isEewDismissed = false;
    wolfxEewService.eewData = mockEew;
    this.updateEpicenter({ earthquake: { hypocenter: { latitude: SIM.lat, longitude: SIM.lon } } });
    this.updateAreaIntensity(mockEew);
    this.updateVisibility();
    soundService.playShindoAudio(); // 실제 EEW와 동일 — Shindo.wav만
    notificationService.notifyEew(mockEew);
    this.mapCtl?.flyTo({ center: [SIM.lon, SIM.lat], ...VIEW.epicenterFly });
  }
}

export const app = new AppController();
