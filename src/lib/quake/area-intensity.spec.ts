import { describe, it, expect } from 'vitest';
import { buildAreaIntensityRows } from './area-intensity';
import type { AreaData } from './area-data';

const areaData: AreaData = {
  areaForecastGeoJSON: {
    features: [
      { properties: { code: '402000', name: '愛知県西部' } },
      { properties: { code: '401000', name: '静岡県中部' } }
    ]
  },
  stationToAreaCode: new Map([['富士宮市', '401000'], ['名古屋市', '402000']]),
  areaNameToCode: new Map([['静岡県中部', '401000']]),
  areaCodeToPref: new Map([['401000', '静岡県'], ['402000', '愛知県']])
};

describe('buildAreaIntensityRows', () => {
  it('points에서 예보구역별 최대진도를 파생해 진도 내림차순으로 정렬한다', () => {
    const quake = {
      points: [
        { pref: '静岡県', addr: '富士宮市', scale: 50 },
        { pref: '静岡県', addr: '富士宮市', scale: 30 }, // 같은 지역 — 50 유지
        { pref: '愛知県', addr: '名古屋市', scale: 40 }
      ]
    };
    expect(buildAreaIntensityRows(quake, areaData)).toEqual([
      { name: '静岡県中部', pref: '静岡県', scale: 50 },
      { name: '愛知県西部', pref: '愛知県', scale: 40 }
    ]);
  });

  it('진도 1 미만(scale<10) 지점은 무시한다', () => {
    expect(buildAreaIntensityRows({ points: [{ addr: '富士宮市', scale: 0 }] }, areaData)).toEqual([]);
  });

  it('points/areas가 모두 없으면 빈 배열 (551 Destination 등)', () => {
    expect(buildAreaIntensityRows({}, areaData)).toEqual([]);
    expect(buildAreaIntensityRows(null, areaData)).toEqual([]);
  });
});
