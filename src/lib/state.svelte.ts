export type Tab = 'realtime' | 'earthquake' | 'est_shindo_region';
export type IntensityDisplayMode = 'areas' | 'stations' | 'both';
export type RealtimeDataType = 'jma_s' | 'jma_b';

function loadTheme(): boolean {
  try {
    return localStorage.getItem('quake_theme') !== 'light';
  } catch {
    return true;
  }
}

export const ui = $state({
  activeTab: 'earthquake' as Tab,
  isDarkMode: loadTheme(),
  isCleanMode: false,
  isGifExpanded: false,
  currentGifUrl: '',
  acmapGifUrl: '',
  estshindoGifUrl: '',
  latestTime: '',
  hasDetectedGrids: false,
  showWaveRings: true,
  intensityDisplayMode: 'both' as IntensityDisplayMode,
  realtimeDataType: 'jma_s' as RealtimeDataType,
  isHistoryOpen: false,
  groupUnknown: true,
  expandedGroupKeys: {} as Record<string, boolean>,
  historyOffset: 0,
  stationMap: new Map<string, any>()
});

export function applyTheme(): void {
  document.documentElement.classList.toggle('dark', ui.isDarkMode);
}

applyTheme();
