import { KEYS } from './config';

export type Tab = 'realtime' | 'earthquake' | 'overseas';
export type IntensityDisplayMode = 'areas' | 'stations' | 'both';
export type RealtimeDataType = 'jma_s' | 'jma_b';
export type Locale = 'ko' | 'en' | 'ja';

const LOCALES: Locale[] = ['ko', 'en', 'ja'];

function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEYS.locale);
    if (saved && (LOCALES as string[]).includes(saved)) return saved as Locale;
  } catch {
    // ignore
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.startsWith('ja')) return 'ja';
    if (navigator.language.startsWith('ko')) return 'ko';
    return 'en';
  }
  return 'ko'; // node(테스트) 등 navigator 없는 환경
}

function loadTheme(): boolean {
  try {
    return localStorage.getItem(KEYS.theme) !== 'light';
  } catch {
    return true;
  }
}

export const ui = $state({
  activeTab: 'earthquake' as Tab,
  locale: loadLocale(), // UI 언어 (ko/en/ja) — LanguageSettings에서 변경·저장
  isDarkMode: loadTheme(),
  isCleanMode: false,
  isGifExpanded: false,
  currentGifUrl: '',
  acmapGifUrl: '',
  estshindoGifUrl: '',
  latestTime: '',
  sseConnected: false, // /api/events 연결 상태 — TopBar 상태 점이 참조
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
  if (typeof document === 'undefined') return; // node(테스트/SSR) 환경 가드
  document.documentElement.classList.toggle('dark', ui.isDarkMode);
}

applyTheme();
