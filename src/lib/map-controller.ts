import { baseStyle, geoSources, MAP_CENTER, MAP_ZOOM } from './map-style';
import { mapLayers } from './map-layers';
import { bindStationPopups, createStationHighlightMarker, type StationLocation } from './map-marker';

export interface VisState {
  tab: 'realtime' | 'earthquake' | 'est_shindo_region';
  mode: 'areas' | 'stations' | 'both';
  waveRings: boolean;
  eewActive: boolean;
  hasDetectedGrids: boolean;
  estEpi: [number, number] | null;
}

export class MapController {
  readonly map: any;
  private Popup: any;
  private Marker: any;
  private initialData = new Map<string, any>();
  private stationMarker: any = null;
  readonly ready: Promise<void>;

  constructor(map: any, Popup: any, Marker: any) {
    this.map = map;
    this.Popup = Popup;
    this.Marker = Marker;
    this.ready = new Promise(resolve => {
      map.on('load', () => {
        for (const [id, data] of this.initialData) {
          map.addSource(id, { type: 'geojson', data });
        }
        for (const [id, data] of geoSources()) {
          if (!map.getSource(id)) {
            map.addSource(id, { type: 'geojson', data });
          }
        }
        for (const layer of mapLayers()) {
          map.addLayer(layer);
        }
        bindStationPopups(map, Popup);
        resolve();
      });
    });
  }

  setInitialData(id: string, data: any): void {
    this.initialData.set(id, data);
  }

  setSource(id: string, data: any): void {
    const source = this.map.getSource(id);
    if (source) source.setData(data);
  }

  hasSource(id: string): boolean {
    return !!this.map.getSource(id);
  }

  setTheme(dark: boolean): void {
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
  }

  applyVisibility(s: VisState): void {
    const map = this.map;
    const isEarthquakeTab = s.tab === 'earthquake';
    const isEstShindoTab = s.tab === 'est_shindo_region';

    // 지역 진도 면적 색상 레이어
    const showAreas = isEarthquakeTab && (s.mode === 'areas' || s.mode === 'both');
    const vis = (show: boolean) => (show ? 'visible' : 'none');

    for (const id of ['area-forecast-fill', 'area-forecast-line']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(showAreas));
    }

    // 실험적 예상진도 행정구역 마스킹 레이어
    if (map.getLayer('est-shindo-mask-fill')) {
      map.setLayoutProperty('est-shindo-mask-fill', 'visibility', vis(isEstShindoTab));
    }
    if (map.getLayer('est-shindo-mask-line')) {
      map.setLayoutProperty('est-shindo-mask-line', 'visibility', vis(isEstShindoTab));
    }

    // 관측점 레이어: 실시간/예상진도 탭 표시, 예상진도 탭에서는 아주 흐리게
    if (map.getLayer('points-layer')) {
      map.setLayoutProperty('points-layer', 'visibility', vis(!isEarthquakeTab));
      map.setPaintProperty('points-layer', 'circle-opacity', isEstShindoTab ? 0.1 : 1.0);
    }

    // 흔들림 격자 레이어: 실시간 탭이거나 격자 존재 시 지진 예보구역 탭에서도 표시
    if (map.getLayer('detected-layer')) {
      map.setLayoutProperty('detected-layer', 'visibility', vis(!isEarthquakeTab || s.hasDetectedGrids));
    }

    // P파/S파 레이어: showWaveRings && (실시간 탭 또는 EEW/추정진원 활성)
    const waveVis = s.waveRings && (!isEarthquakeTab || s.eewActive || s.estEpi !== null);
    for (const id of ['p-wave-fill-layer', 'p-wave-layer', 's-wave-fill-layer', 's-wave-layer']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(waveVis));
    }

    // 진원지 마커: 지진정보 탭이거나 EEW/추정진원 활성 시 항상 표시
    const epiVis = isEarthquakeTab || s.eewActive || s.estEpi !== null;
    for (const id of ['p2p-epicenter-halo', 'p2p-epicenter-layer']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(epiVis));
    }

    // 관측소 개별 진도 점: 지진 정보 탭 + (stations/both 모드)
    const showStations = isEarthquakeTab && (s.mode === 'stations' || s.mode === 'both');
    for (const id of ['quake-stations-halo', 'quake-stations-circle']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis(showStations));
    }
  }

  setWavePaint(pFade: number, sFade: number): void {
    if (this.map.getLayer('p-wave-fill-layer')) {
      this.map.setPaintProperty('p-wave-fill-layer', 'fill-opacity', 0.12 * pFade);
      this.map.setPaintProperty('p-wave-layer', 'line-opacity', 0.85 * pFade);
    }
    if (this.map.getLayer('s-wave-fill-layer')) {
      this.map.setPaintProperty('s-wave-fill-layer', 'fill-opacity', 0.18 * sFade);
      this.map.setPaintProperty('s-wave-layer', 'line-opacity', 0.9 * sFade);
    }
  }

  blinkDetected(visible: boolean): void {
    if (this.map.getLayer('detected-layer')) {
      this.map.setPaintProperty('detected-layer', 'line-opacity', visible ? 1 : 0.2);
    }
  }

  flyTo(opts: any): void {
    this.map.flyTo(opts);
  }

  fitBounds(bounds: [[number, number], [number, number]], opts: any = {}): void {
    this.map.fitBounds(bounds, opts);
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
      zoom: 10.5,
      speed: 1.2,
      essential: true
    });

    this.removeStationMarker();
    this.stationMarker = createStationHighlightMarker(this.map, this.Marker, st);
    setTimeout(() => this.removeStationMarker(), 7000);
  }

  destroy(): void {
    this.removeStationMarker();
    this.map.remove();
  }
}

export async function createMapController(container: HTMLElement): Promise<MapController> {
  // esbuild 등의 번들러가 URL import를 해석하려다 실패하는 것을 방지하기 위해
  // 네이티브 동적 import를 사용합니다.
  const maplibreModule = await new Function("return import('https://esm.sh/maplibre-gl@3')")();
  // esm.sh CDN의 default export와 named export를 모두 확인하여 사용합니다.
  const { Map, Popup, Marker } = maplibreModule;

  const map = new Map({
    container,
    renderWorldCopies: false,
    style: baseStyle(),
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    attributionControl: false // UI 제거 요구사항 반영
  });

  map.on('error', (e: any) => {
    console.error('Map error:', e);
  });

  return new MapController(map, Popup, Marker);
}
