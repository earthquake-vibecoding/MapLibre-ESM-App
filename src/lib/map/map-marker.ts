import { getIntensityColor, getJindoString } from '../quake/jma-utils';
import { t } from '../i18n/i18n';

export interface StationLocation {
  lat: number;
  lon: number;
  name: string;
  pref?: string;
  scale?: number;
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
