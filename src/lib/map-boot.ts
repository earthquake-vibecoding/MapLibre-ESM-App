/**
 * 지도 로드 시 1회 부팅: 초기 소스/레이어 등록, 관측소 팝업, 진원지 X 아이콘, 초기 카메라.
 * map-controller에서 분리 (200줄 규칙).
 */

import { Map as MaplibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// 워커를 번들 청크로 내보고 URL을 직접 지정 — maplibre 기본 경로는 Vite dev/prod 모두 404
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { baseStyle, JAPAN_MAIN_BOUNDS, MAP_CENTER, MAP_ZOOM, geoSources } from './map-style';
import { mapLayers } from './map-layers';
import { bindStationClicks } from './map-marker';
import { addTectonicLabels } from './map-tectonics'; // addHistoricalQuakes — 역사지진 일단 숨김 (2026-11-04)

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

export function bootMap(map: any, initialData: Map<string, any>): void {
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
  bindStationClicks(map);
  addEpicenterIcon(map);
  addTectonicLabels(map);
  // 역사지진 마커 — 일단 숨김. 다시 켜려면 아래 주석 해제 (데이터·코드는 map-tectonics.ts에 보존됨)
  // addHistoricalQuakes(map);
  // 초기 카메라: 일본 본토(오키나와 제외) 고정 프레임
  map.fitBounds(JAPAN_MAIN_BOUNDS, { padding: 48, pitch: 0, bearing: 0, duration: 0 });
}

export function createMapControllerInstance(container: HTMLElement): { map: any; Marker: any } {
  setWorkerUrl(maplibreWorkerUrl);
  const map = new MaplibreMap({
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

  return { map, Marker };
}
