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

  // 외부 피드(p2p 551 addr/pref)가 name으로 흘러온다 — innerHTML 금지, textContent로만 조립
  const el = document.createElement('div');
  el.className = 'station-highlight-marker';

  const wrap = document.createElement('div');
  wrap.className = 'relative flex items-center justify-center pointer-events-none';

  const ping = document.createElement('span');
  ping.className = 'animate-ping absolute inline-flex h-12 w-12 rounded-full opacity-75';
  ping.style.backgroundColor = color;

  const badge = document.createElement('span');
  badge.className = 'relative inline-flex rounded-full px-3 py-1 border-2 border-white shadow-2xl items-center justify-center text-xs font-black text-white';
  badge.style.backgroundColor = color;
  const label = `${st.pref ? st.pref + ' ' : ''}${st.name} (${t('진도')} ${jindoStr})`;
  badge.textContent = `📍 ${label}`;

  wrap.append(ping, badge);
  el.append(wrap);

  return new Marker({ element: el, anchor: 'center' })
    .setLngLat([st.lon, st.lat])
    .addTo(map);
}
