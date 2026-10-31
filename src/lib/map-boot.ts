/**
 * 지도 로드 시 1회 부팅: 초기 소스/레이어 등록, 관측소 팝업, 진원지 X 아이콘, 초기 카메라.
 * map-controller에서 분리 (200줄 규칙).
 */

import { baseStyle, JAPAN_MAIN_BOUNDS, MAP_CENTER, MAP_ZOOM, geoSources } from './map-style';
import { mapLayers } from './map-layers';
import { bindStationPopups } from './map-marker';

/** 고해상도 진원지 X 아이콘 등록 — 96px 캔버스 @pixelRatio 4 (확대해도 계단 없음) */
function addEpicenterIcon(map: any): void {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const drawX = (color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 18);
    ctx.lineTo(size - 18, size - 18);
    ctx.moveTo(size - 18, 18);
    ctx.lineTo(18, size - 18);
    ctx.stroke();
  };
  drawX('#ffffff', 30);
  drawX('#ef4444', 18);
  map.addImage('epicenter-x', ctx.getImageData(0, 0, size, size), { pixelRatio: 4 });
}

export function bootMap(map: any, Popup: any, initialData: Map<string, any>): void {
  for (const [id, data] of initialData) {
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
  addEpicenterIcon(map);
  // 초기 카메라: 일본 본토(오키나와 제외) 고정 프레임
  map.fitBounds(JAPAN_MAIN_BOUNDS, { padding: 48, pitch: 0, bearing: 0, duration: 0 });
}

export async function createMapControllerInstance(container: HTMLElement): Promise<{ map: any; Popup: any; Marker: any }> {
  // esbuild 등의 번들러가 URL import를 해석하려다 실패하는 것을 방지하기 위해
  // 네이티브 동적 import를 사용. esm.sh 실패 시 jsdelivr로 폴백.
  const sources = [
    'https://esm.sh/maplibre-gl@3',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@3/+esm'
  ];
  let maplibreModule: any = null;
  let lastError: unknown = null;
  for (const src of sources) {
    try {
      maplibreModule = await new Function('src', 'return import(src)')(src);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!maplibreModule) throw lastError ?? new Error('maplibre-gl 로드 실패');
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

  return { map, Popup, Marker };
}
