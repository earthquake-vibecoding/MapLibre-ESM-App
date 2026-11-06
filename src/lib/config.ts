/**
 * 튜닝 상수 단일 출처 — 값을 바꿀 가능성이 있는 런타임 상수는 여기만 수정.
 * 스펙 테이블(JMA_LEVELS·컬러맵·TJMA)과 구조 값(그리드 원점 등)은 각 전용 모듈에 둠.
 */

/** 감지 판정 (detector.ts / noise-filter.ts) */
export const DETECT = {
  deltaWindow: 10,         // 상승률 계산 프레임 수 (1프레임 ≈ 1초)
  historyFrames: 60,       // 스파크라인 링버퍼 프레임 수 (≈ 1분)
  medianWindow: 3,         // 미디언 노이즈 필터 프레임 수
  riseThreshold: 1.2,      // 이벤트 판정: deltaWindow 상승률 임계
  neighborRise: 0.8,       // 이벤트 판정: 이웃 상승률 임계
  neighborMinCount: 2,     // 이벤트 판정: 최소 상승 이웃 수
  neighborMinRatio: 0.6,   // 이벤트 판정: 이웃 상승 비율
  feltJindo: -0.5,         // 이벤트 성립 최소 계측진도
  sustainJindo: -0.5,      // 이벤트 유지 최소 계측진도
  anomalyJindo: 3.0,       // 이상치 필터: 단일 스파이크 의심 진도
  anomalyJindoIsland: 4.5, // 이상치 필터: 도서지역 기준
  islandStrongJindo: 4.2,  // 도서지역 단독 판정 최소 진도
  displayJindoMin: 0.5,    // 진도 계급 표기 최소 계측진도 (미만은 진도 0 취급)
  expireMs: 10_000,        // 마지막 상승 후 이벤트 유지 시간
} as const;

/** 폴링/갱신 주기·쓰로틀 */
export const TIMING = {
  heartbeatMs: 1000,       // kmoni 프레임 폴링 (ticker)
  blinkMs: 500,            // 감지 격자 점멸 주기
  waveThrottleMs: 33,      // P/S파 렌더 스로틀 (≈30fps)
  relayMs: 500,            // 메인 → 외부 패널 스냅샷 릴레이
  panelSnapMs: 500,        // 패널 UI 스냅샷 갱신
  quakePollMs: 20_000,     // P2PQuake 이력 폴링
  usgsPollMs: 300_000,     // USGS 해외지진 피드 폴링 (5분)
  p2pKeepMs: 180_000,      // 실시간 수신 지진 정보 유지 시간
  kmoniLagS: 2,            // kmoni 발행 지연 보정 (초)
  shindoSoundGapMs: 1500,  // 같은 계급 진도음 재생 최소 간격
  eewSoundGapMs: 10_000,   // 같은 EEW 음성 재생 최소 간격
  detectBeepGapMs: 15_000, // 감지 비프(shi0) 쓰로틀
  notifyGapMs: 60_000,     // 감지 푸시 알림 쓰로틀
  eewActiveWindowS: 240,   // EEW 활성 유지 시간
  eewFutureAllowS: 60,     // EEW 시작 시각 미래 여유
  simGuardMs: 120_000,     // 시뮬레이션 진행 중 실제 EEW 수신 차단 시간
  soundOverlapMs: 200,     // 계급음 겹침 방지 지연 (triggerScaleSound)
  estGifGuardMs: 8000,     // 예상진도 GIF 로드 타임아웃 가드
  wsBaseMs: 5000,          // WS 재접속 초기 백오프
  wsMaxMs: 30000,          // WS 재접속 최대 백오프
  wsBackoff: 1.5,          // WS 재접속 백오프 배수
} as const;

/** 외부 API 엔드포인트 (server/api.mjs의 kmoni는 별도 node 프로세스라 여기와 무관) */
export const NET = {
  p2pHistoryBase: 'https://api.p2pquake.net/v2/history?codes=551&limit=100&offset=',
  p2pWs: 'wss://api.p2pquake.net/v2/ws',
  wolfxWs: 'wss://ws-api.wolfx.jp/jma_eew',
  usgsFeed: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
} as const;

/** localStorage 키 — 문자열 리터럴은 여기 외 금지 */
export const KEYS = {
  theme: 'quake_theme',
  dataType: 'realtime_data_type',
  alertFilter: 'alert_filter',
  detected: 'eq_detected_stations',
  notifyEnabled: 'browser_notifications_enabled',
  favorites: 'station_favorites',
  detectionLog: 'detection_log',
} as const;

/** EEW 시뮬레이션 진원 (임의의 후지산 인근 고정점) */
export const SIM = {
  lat: 35.5,
  lon: 140.0,
} as const;

/** 알림음/알림 */
export const ALERT = {
  shindoVolume: 0.85,      // Shindo.wav 볼륨
} as const;

/** 카메라 이동 (키는 maplibre flyTo 옵션명 그대로 — spread로 사용) */
export const VIEW = {
  stationFly: { zoom: 7, duration: 800 },            // 관측소 1개 플라이 (패널·감지 기록 공용)
  detectionFly: { zoom: 6.2, speed: 1.2, curve: 1.4 }, // 신규 감지 자동 이동
  clusterFly: { zoom: 6.2, speed: 1.2 },             // 감지 격자 묶음 이동
  eewFly: { zoom: 6.2, speed: 1.2 },                 // EEW 진원 이동
  epicenterFly: { zoom: 6.8, speed: 1.2, duration: 1200 }, // 진앙지 이동 버튼
  overseasFly: { zoom: 5, duration: 1000 }, // 해외지진 행 클릭 (광역 시야)
  fitMaxZoom: 8,          // 진도 분포 fitBounds 상한
  focusStationZoom: 10.5, // 목록 관측소 포커스 줌
  focusStationMarkerMs: 7000, // 관측소 하이라이트 마커 유지 시간
  clusterFit: { padding: 60, maxZoom: 6.5, duration: 1000 }, // 감지 격자 묶음 fitBounds
  clusterBoundsPad: 0.8,  // 감지 격자 묶음 bounds 확장 (도)
  quakeFit: { padding: 80, duration: 1200 }, // 진도 분포 fitBounds
  fullFit: { padding: 48, pitch: 0, bearing: 0 }, // 전체 보기 공통 옵션 (duration은 호출부)
} as const;

/** 관측소 이웃 계산·감지 복구 (grid.ts) */
export const GRID = {
  neighborNearKm: 20,      // 이웃 확정 거리
  neighborFarKm: 30,       // 이웃 후보 최대 거리 (농어가/도서)
  neighborMin: 3,          // 거리 무관 보장 최소 이웃 수
  restoreValidMs: 300_000, // 저장된 감지 복구 유효 시간
  restoreMinMs: 3_000,     // 복구 후 최소 유지 시간
  restoreMaxMs: 15_000,    // 복구 후 최대 유지 시간
} as const;

/** P/S파 반경 (seismic.ts) */
export const WAVE = {
  fallbackPKmsPerS: 6.5,   // 테이블 없을 때 P파 속도 근사
  fallbackSKmsPerS: 3.5,   // 테이블 없을 때 S파 속도 근사
  maxRadiusByMag: [[4.5, 300], [6.0, 450], [7.0, 600]] as [number, number][], // [규모 미만, 최대 반경 km]
  maxRadiusDefault: 750,   // 상기 어느 것도 해당 없을 때
} as const;
