import { KEYS } from './config';

export type Tab = 'realtime' | 'earthquake' | 'overseas';
export type IntensityDisplayMode = 'areas' | 'stations' | 'both';
export type RealtimeDataType = 'jma_s' | 'jma_b';

function loadTheme(): boolean {
  try {
    return localStorage.getItem(KEYS.theme) !== 'light';
  } catch {
    return true;
  }
}

export interface AreaFilter {
  enabled: boolean;
  minScale: number; // 진도 코드 (10=진도1 … 60=진도7)
  radiusKm: number;
}

function loadAlertFilter(): AreaFilter {
  const def: AreaFilter = { enabled: false, minScale: 30, radiusKm: 100 };
  try {
    const v = JSON.parse(localStorage.getItem(KEYS.alertFilter) || 'null');
    if (v && typeof v.enabled === 'boolean' && typeof v.minScale === 'number' && typeof v.radiusKm === 'number') return v;
  } catch {
    // ignore
  }
  return def;
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
  stationPanelCode: null as string | null, // StationPanel에서 보는 관측소
  stationsLoaded: false, // app.stationsState가 비반응성 Map이라 로드 완료 알림용 플래그
  areaFilter: loadAlertFilter(), // 관심 지역 알림 필터
  stationMap: new Map<string, any>()
});

export function applyTheme(): void {
  if (typeof document === 'undefined') return; // node(테스트/SSR) 환경 가드
  document.documentElement.classList.toggle('dark', ui.isDarkMode);
}

applyTheme();
