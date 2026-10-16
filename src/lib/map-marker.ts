import { getIntensityColor, getJindoString } from './jma-utils';

export interface StationLocation {
  lat: number;
  lon: number;
  name: string;
  pref?: string;
  scale?: number;
}

export function bindStationPopups(map: any, Popup: any): void {
  map.on('click', 'quake-stations-circle', (e: any) => {
    if (!e.features || e.features.length === 0) return;
    const feat = e.features[0];
    const props = feat.properties;
    const coords = feat.geometry.coordinates.slice();

    new Popup({ closeButton: true, className: 'station-popup' })
      .setLngLat(coords)
      .setHTML(`
        <div style="font-family: sans-serif; padding: 4px; font-size: 12px; color: #1f2937;">
          <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span>📍 ${props.pref || ''} ${props.name}</span>
            <span style="background-color: ${props.color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">진도 ${props.jindoStr}</span>
          </div>
          <div style="color: #6b7280; font-size: 11px; line-height: 1.4;">
            <div>소속: <strong>${props.affi || '기상청'}</strong></div>
            <div>위도/경도: ${Number(props.lat)?.toFixed(2)}°, ${Number(props.lon)?.toFixed(2)}°</div>
          </div>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'quake-stations-circle', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'quake-stations-circle', () => {
    map.getCanvas().style.cursor = '';
  });
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
        📍 ${st.pref ? st.pref + ' ' : ''}${st.name} (진도 ${jindoStr})
      </span>
    </div>
  `;

  return new Marker({ element: el, anchor: 'center' })
    .setLngLat([st.lon, st.lat])
    .addTo(map);
}
