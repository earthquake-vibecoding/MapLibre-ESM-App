export function mapLayers(): any[] {
  return [
    // Area forecast layers (below waves and points)
    {
      id: 'area-forecast-fill',
      type: 'fill',
      source: 'area-forecast',
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], 'transparent'],
        'fill-opacity': ['coalesce', ['get', 'opacity'], 0.75]
      }
    },
    {
      id: 'area-forecast-line',
      type: 'line',
      source: 'area-forecast',
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.15)',
        'line-width': 0.7
      }
    },
    // 실험적 예상진도 행정구역 마스킹 레이어
    {
      id: 'est-shindo-mask-fill',
      type: 'fill',
      source: 'est-shindo-mask-area',
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], 'transparent'],
        'fill-opacity': ['coalesce', ['get', 'opacity'], 0.75]
      }
    },
    {
      id: 'est-shindo-mask-line',
      type: 'line',
      source: 'est-shindo-mask-area',
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.15)',
        'line-width': 0.7
      }
    },
    {
      id: 'p-wave-fill-layer',
      type: 'fill',
      source: 'p-wave',
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.12
      }
    },
    {
      id: 'p-wave-layer',
      type: 'line',
      source: 'p-wave',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2.5,
        'line-opacity': 0.85
      }
    },
    {
      id: 's-wave-fill-layer',
      type: 'fill',
      source: 's-wave',
      paint: {
        'fill-color': '#ef4444',
        'fill-opacity': 0.18
      }
    },
    {
      id: 's-wave-layer',
      type: 'line',
      source: 's-wave',
      paint: {
        'line-color': '#ef4444',
        'line-width': 2.5,
        'line-opacity': 0.9
      }
    },
    {
      id: 'points-layer',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4, 3,
          8, 6,
          12, 10,
          16, 16
        ],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 0
      }
    },
    // 흔들림 감지 격자 (관측소 점 위)
    {
      id: 'detected-layer',
      type: 'line',
      source: 'detected',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3
      }
    },
    // 진원지 레이어 (최상단) — 런타임에 addImage로 등록한 X 아이콘 사용
    {
      id: 'p2p-epicenter-layer',
      type: 'symbol',
      source: 'p2p-epicenter',
      layout: {
        'icon-image': 'epicenter-x',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    },
    // 관측소 개별 진도 점 레이어
    {
      id: 'quake-stations-halo',
      type: 'circle',
      source: 'quake-stations',
      filter: ['>=', ['get', 'scale'], 40],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 14, 12, 20],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.35,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    },
    {
      id: 'quake-stations-circle',
      type: 'circle',
      source: 'quake-stations',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 7, 12, 10],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff'
      }
    }
  ];
}
