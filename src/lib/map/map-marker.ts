import { getIntensityColor, getJindoString } from '../quake/jma-utils';
import { ui } from '../state.svelte';
import { t } from '../i18n/i18n';

export interface StationLocation {
  lat: number;
  lon: number;
  name: string;
  pref?: string;
  scale?: number;
}

export function bindStationClicks(map: any): void {
  // 두 레이어 모두 바인딩: quake-stations(지진 탭) + stations-hit(실시간 탭 points-layer 위 판정영역)
  for (const layer of ['quake-stations-circle', 'stations-hit']) {
    map.on('click', layer, (e: any) => {
      if (!e.features || e.features.length === 0) return;
      // 정적 Popup 대신 실시간 갱신되는 StationPanel을 연다
      ui.stationPanelCode = e.features[0].properties.code;
    });
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

export function createStationHighlightMarker(map: any, Marker: any, st: StationLocation): any {
  const jindoStr = getJindoString(st.scale);
  const color = getIntensityColor(st.scale || 0);

  const el = document.createElement('div');
  el.className = 'station-highlight-marker';
  el.innerHTML = `
    <div class="relative flex items-center justify-center pointer-events-none">
      <span class="animate-ping absolute inline-flex h-12 w-12 rounded-full opacity-75" style="background-color: ${color}"></span>
      <span class="relative inline-flex rounded-full px-3 py-1 border-2 border-white shadow-2xl items-center justify-center text-xs font-black text-white" style="background-color: ${color}">
        📍 ${st.pref ? st.pref + ' ' : ''}${st.name} (${t('진도')} ${jindoStr})
      </span>
    </div>
  `;

  return new Marker({ element: el, anchor: 'center' })
    .setLngLat([st.lon, st.lat])
    .addTo(map);
}
