import { JAPAN_MAIN_BOUNDS } from './map-style';
import { bootMap, createMapControllerInstance } from './map-boot';
import { createStationHighlightMarker, type StationLocation } from './map-marker';
import { VIEW } from '../config';

export interface VisState {
  tab: 'realtime' | 'earthquake' | 'overseas';
  mode: 'areas' | 'stations' | 'both';
  waveRings: boolean;
  eewActive: boolean;
  hasDetectedGrids: boolean;
}

export class MapController {
  readonly map: any;
  private Marker: any;
  private initialData = new Map<string, any>();
  private stationMarker: any = null;
  private alive = true;
  readonly ready: Promise<void>;

  /** destroy 후 늦게 도착하는 비동기 콜백(img.onload 등)이 죽은 맵을 만지지 않게 하는 공용 가드 */
  private live(): boolean {
    return this.alive && !!this.map.style;
  }

  constructor(map: any, Marker: any) {
    this.map = map;
    this.Marker = Marker;
    this.ready = new Promise(resolve => {
      map.on('load', () => {
        bootMap(map, this.initialData);
        resolve();
      });
    });
  }

  setInitialData(id: string, data: any): void {
    this.initialData.set(id, data);
  }

  setSource(id: string, data: any): void {
    if (!this.live()) return;
    const source = this.map.getSource(id);
    if (source) source.setData(data);
  }

  setTheme(dark: boolean): void {
    // 스타일 로드 전 호출 시 'Style is not done loading' 에러가 나므로 load 이후로 지연
    this.ready.then(() => {
      const map = this.map;
      map.setPaintProperty('background', 'background-color', dark ? '#18181b' : '#ffffff');
      map.setPaintProperty('world-fill', 'fill-color', dark ? '#27272a' : '#e4e4e7');
      map.setPaintProperty('world-outline', 'line-color', dark ? '#3f3f46' : '#a1a1aa');
      map.setPaintProperty('japan-fill', 'fill-color', dark ? '#27272a' : '#e4e4e7');
      map.setPaintProperty('japan-outline', 'line-color', dark ? '#3f3f46' : '#a1a1aa');
      if (map.getLayer('area-forecast-line')) {
        map.setPaintProperty('area-forecast-line', 'line-color', dark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)');
      }
      if (map.getLayer('est-shindo-mask-line')) {
        map.setPaintProperty('est-shindo-mask-line', 'line-color', dark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)');
      }
    });
  }

  applyVisibility(s: VisState): void {
    // 스타일 로드 전 호출 시 getLayer가 던지므로 로드 이후로 지연
    this.ready.then(() => {
      if (!this.live()) return;
      this.applyVisibilityNow(s);
    });
  }

  private applyVisibilityNow(s: VisState): void {
    const map = this.map;
    const isEarthquakeTab = s.tab === 'earthquake';
    const isRealtimeTab = s.tab === 'realtime';

    // 지역 진도 면적 색상 레이어
    const showAreas = isEarthquakeTab && (s.mode === 'areas' || s.mode === 'both');
    const vis = (show: boolean) => (show ? 'visible' : 'none');

    for (const id of ['area-forecast-fill', 'area-forecast-line']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(showAreas));
    }

    // 예상진도 마스크 — 실시간 탭 상시 + EEW 중엔 어느 탭에서든 (파 링과 동일 패턴).
    // EEW 중이 아니면 소스가 비어 표시되지 않음 (ticker가 클리어 유지)
    const maskVis = isRealtimeTab || s.eewActive;
    if (map.getLayer('est-shindo-mask-fill')) {
      map.setLayoutProperty('est-shindo-mask-fill', 'visibility', vis(maskVis));
    }
    if (map.getLayer('est-shindo-mask-line')) {
      map.setLayoutProperty('est-shindo-mask-line', 'visibility', vis(maskVis));
    }

    // 관측점 레이어: 지진 예보구역 탭 외 표시
    if (map.getLayer('points-layer')) {
      map.setLayoutProperty('points-layer', 'visibility', vis(!isEarthquakeTab));
    }
    if (map.getLayer('stations-hit')) {
      map.setLayoutProperty('stations-hit', 'visibility', vis(!isEarthquakeTab));
    }

    // 흔들림 격자 레이어: 실시간 탭이거나 격자 존재 시 지진 예보구역 탭에서도 표시
    if (map.getLayer('detected-layer')) {
      map.setLayoutProperty('detected-layer', 'visibility', vis(!isEarthquakeTab || s.hasDetectedGrids));
    }

    // P파/S파 레이어: showWaveRings && (실시간 탭 또는 EEW 활성)
    const waveVis = s.waveRings && (!isEarthquakeTab || s.eewActive);
    for (const id of ['p-wave-fill-layer', 'p-wave-layer', 's-wave-fill-layer', 's-wave-layer']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(waveVis));
    }

    // 진원지 마커: 지진정보 탭이거나 EEW 활성 시 항상 표시 / 해외 X는 해외 탭에서만
    const epiVis = isEarthquakeTab || s.eewActive;
    for (const [id, show] of [['p2p-epicenter-layer', epiVis], ['overseas-epicenter-layer', s.tab === 'overseas']] as const) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(show));
    }

    // 관측소 개별 진도 점: 지진 정보 탭 + (stations/both 모드)
    const showStations = isEarthquakeTab && (s.mode === 'stations' || s.mode === 'both');
    for (const id of ['quake-stations-halo', 'quake-stations-circle']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(showStations));
    }
  }

  setWavePaint(pFade: number, sFade: number): void {
    if (!this.live()) return;
    if (this.map.getLayer('p-wave-fill-layer')) {
      this.map.setPaintProperty('p-wave-fill-layer', 'fill-opacity', 0.05 * pFade);
      this.map.setPaintProperty('p-wave-layer', 'line-opacity', 0.8 * pFade);
    }
    if (this.map.getLayer('s-wave-fill-layer')) {
      this.map.setPaintProperty('s-wave-fill-layer', 'fill-opacity', 0.09 * sFade);
      this.map.setPaintProperty('s-wave-layer', 'line-opacity', 0.85 * sFade);
    }
  }

  blinkDetected(visible: boolean): void {
    if (!this.live()) return;
    if (this.map.getLayer('detected-layer')) {
      this.map.setPaintProperty('detected-layer', 'line-opacity', visible ? 1 : 0.2);
    }
  }

  flyTo(opts: any): void {
    if (!this.live()) return;
    this.map.flyTo(opts);
  }

  fitBounds(bounds: [[number, number], [number, number]], opts: any = {}): void {
    if (!this.live()) return;
    this.map.fitBounds(bounds, opts);
  }

  /** 전체 보기: 일본 본토(오키나와 제외)에 맞춰 프레임 고정 */
  fitFullView(duration = 800): void {
    this.map.fitBounds(JAPAN_MAIN_BOUNDS, { ...VIEW.fullFit, duration });
  }

  removeStationMarker(): void {
    if (this.stationMarker) {
      this.stationMarker.remove();
      this.stationMarker = null;
    }
  }

  focusStation(st: StationLocation): void {
    this.flyTo({
      center: [st.lon, st.lat],
      zoom: VIEW.focusStationZoom,
      speed: 1.2,
      essential: true
    });

    this.removeStationMarker();
    this.stationMarker = createStationHighlightMarker(this.map, this.Marker, st);
    setTimeout(() => this.removeStationMarker(), VIEW.focusStationMarkerMs);
  }

  destroy(): void {
    this.alive = false;
    this.removeStationMarker();
    this.map.remove();
  }
}

export async function createMapController(container: HTMLElement): Promise<MapController> {
  const { map, Marker } = await createMapControllerInstance(container);
  return new MapController(map, Marker);
}
