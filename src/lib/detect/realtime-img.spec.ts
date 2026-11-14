import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ui } from '../state.svelte';
import { soundService } from '../services/sound';
import { notificationService } from '../services/notification.svelte';
import { appendDetectionEntry } from './detection-log';
import { clearDetectedEvents } from './grid';
import { applyFrameEvent, reapplyLastFrame, type FrameEvent, type RealtimeHost } from './realtime-img';

// 사이드이펙트 관측용 목킹 — 실제 소리/알림/저장 없음
vi.mock('../services/sound', () => ({ soundService: { playShakeDetected: vi.fn() } }));
vi.mock('../services/notification.svelte', () => ({ notificationService: { notifyShakingDetection: vi.fn() } }));
vi.mock('./detection-log', () => ({ appendDetectionEntry: vi.fn() }));
vi.mock('./grid', () => ({ clearDetectedEvents: vi.fn() }));
vi.mock('./catch-up', () => ({ needsCatchUp: () => false, startCatchUp: vi.fn(), catchUpPlaying: () => false, trackLatest: vi.fn() }));
vi.mock('../debug', () => ({ dbg: vi.fn() }));

function host(): RealtimeHost {
  return { geojson: { features: [] }, stationsState: new Map(), mapCtl: null, updateDetectedEvents: () => {} };
}

const frame = (over: Partial<FrameEvent>): FrameEvent => ({
  time: '20261114120000', delayMs: 2000, gif: '', j: [], c: [], ev: [],
  sound: null, center: null, ended: null, ...over
});

describe('reapplyLastFrame — 지표/지중 전환 재적용', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ui.realtimeDataType = 'jma_s';
    ui.latestTime = '';
    ui.currentGifUrl = '';
    ui.acmapGifUrl = '';
    ui.estshindoGifUrl = '';
  });

  it('sound/ended 사이드이펙트는 재적용하지 않는다 — 전환 시 비프/기록 중복 방지', () => {
    applyFrameEvent(frame({ sound: 1.2, ended: { start: 1, end: 2 } }), host());
    expect(soundService.playShakeDetected).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyShakingDetection).toHaveBeenCalledTimes(1);
    expect(appendDetectionEntry).toHaveBeenCalledTimes(1);
    expect(clearDetectedEvents).toHaveBeenCalledTimes(1);

    reapplyLastFrame();
    expect(soundService.playShakeDetected).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyShakingDetection).toHaveBeenCalledTimes(1);
    expect(appendDetectionEntry).toHaveBeenCalledTimes(1);
    expect(clearDetectedEvents).toHaveBeenCalledTimes(1);
  });

  it('표시 소스는 현재 타입으로 갱신 — jma_b 전환 시 URL 재구성', () => {
    applyFrameEvent(frame({}), host());
    ui.realtimeDataType = 'jma_b';
    reapplyLastFrame();
    expect(ui.currentGifUrl).toBe('/api/realtime-img?time=20261114120000&type=jma_b');
    expect(ui.acmapGifUrl).toBe('/api/acmap-img?time=20261114120000&type=jma_b');
    expect(ui.latestTime).toBe('2026/11/14 12:00:00');
  });
});
