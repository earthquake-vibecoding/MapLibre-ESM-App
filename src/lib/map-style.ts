export const MAP_CENTER: [number, number] = [137.5, 36.5];
export const MAP_ZOOM = 4.5;
// 전체 보기 프레임: 규슈~홋카이도 본토. 오키나와(24~27N)는 잘라냄.
export const JAPAN_MAIN_BOUNDS: [[number, number], [number, number]] = [
  [128.5, 30.8],
  [148.0, 45.8]
];

export function baseStyle(): any {
  return {
    version: 8,
    sources: {
      world: {
        type: 'geojson',
        data: '/world.json'
      },
      japan: {
        type: 'geojson',
        data: '/japan.json'
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#ffffff'
        }
      },
      {
        id: 'world-fill',
        type: 'fill',
        source: 'world',
        filter: ['!=', ['get', 'name'], 'Japan'],
        paint: {
          'fill-color': '#e4e4e7',
        }
      },
      {
        id: 'world-outline',
        type: 'line',
        source: 'world',
        filter: ['!=', ['get', 'name'], 'Japan'],
        paint: {
          'line-color': '#a1a1aa',
          'line-width': 0.5
        }
      },
      {
        id: 'japan-fill',
        type: 'fill',
        source: 'japan',
        paint: {
          'fill-color': '#e4e4e7',
        }
      },
      {
        id: 'japan-outline',
        type: 'line',
        source: 'japan',
        paint: {
          'line-color': '#a1a1aa',
          'line-width': 0.5
        }
      }
    ]
  };
}

export const GEO_SOURCE_IDS = [
  'area-forecast',
  'points',
  'detected',
  'p-wave',
  's-wave',
  'p2p-epicenter',
  'quake-stations',
  'est-shindo-mask-area'
] as const;

export function geoSources(): [string, any][] {
  const empty = { type: 'FeatureCollection', features: [] };
  return [
    ['area-forecast', empty],
    ['points', empty],
    ['detected', empty],
    ['p-wave', empty],
    ['s-wave', empty],
    ['p2p-epicenter', empty],
    ['quake-stations', empty],
    ['est-shindo-mask-area', empty]
  ];
}
