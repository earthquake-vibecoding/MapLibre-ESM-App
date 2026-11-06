import { ui } from '../state.svelte';

export interface AreaData {
  areaForecastGeoJSON: any;
  stationToAreaCode: Map<string, string>;
  areaNameToCode: Map<string, string>;
}

export async function loadAreaData(): Promise<AreaData> {
  let areaForecastGeoJSON: any = null;
  let stations: any[] = [];
  try {
    const [areaRes, stationRes] = await Promise.all([
      fetch('/area_forecast.json'),
      fetch('/JMAstations.json')
    ]);
    if (!areaRes.ok || !stationRes.ok) throw new Error(`HTTP ${areaRes.status}/${stationRes.status}`);
    areaForecastGeoJSON = await areaRes.json();
    stations = await stationRes.json();
  } catch (e) {
    console.error('지역 데이터 로드 실패 — 빈 데이터로 계속:', e);
  }
  const stMap = new Map<string, any>();

  const stationToAreaCode = new Map<string, string>();
  const areaNameToCode = new Map<string, string>();

  if (Array.isArray(stations)) {
    for (const st of stations) {
      if (st.lat && st.lon) {
        const info = {
          code: st.code,
          name: st.name,
          pref: st.pref?.name,
          city: st.city?.name,
          area: st.area?.name,
          lat: parseFloat(st.lat),
          lon: parseFloat(st.lon),
          affi: st.affi
        };
        if (st.name) stMap.set(st.name, info);
        if (st.pref?.name && st.name) {
          stMap.set(st.pref.name + st.name, info);
        }
      }

      if (st.area?.code) {
        if (st.name) stationToAreaCode.set(st.name, st.area.code);
        if (st.city?.name) stationToAreaCode.set(st.city.name, st.area.code);
        if (st.area.name) areaNameToCode.set(st.area.name, st.area.code);
        if (st.pref?.name && st.area?.name) {
          areaNameToCode.set(st.pref.name + st.area.name, st.area.code);
        }
        if (st.pref?.name && st.city?.name) {
          stationToAreaCode.set(st.pref.name + st.city.name, st.area.code);
        }
      }
    }
  }

  ui.stationMap = stMap;

  if (areaForecastGeoJSON?.features) {
    for (const f of areaForecastGeoJSON.features) {
      if (f.properties?.name && f.properties?.code) {
        areaNameToCode.set(f.properties.name, f.properties.code);
      }
    }
  }

  return { areaForecastGeoJSON, stationToAreaCode, areaNameToCode };
}
