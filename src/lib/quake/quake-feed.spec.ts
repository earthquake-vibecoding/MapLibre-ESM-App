import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFeedHandlers } from './quake-feed';
import { wolfxEewService } from '../services/wolfx-eew.svelte';
import { soundService } from '../services/sound';
import { notificationService } from '../services/notification.svelte';
import type { AppController } from '../app-controller';

vi.mock('../services/sound', () => ({
  soundService: { playShindoAudio: vi.fn(), playShakeDetected: vi.fn() }
}));
vi.mock('../services/notification.svelte', () => ({
  notificationService: { notifyEew: vi.fn(), notifyQuake: vi.fn() }
}));
vi.mock('../services/p2p-quake.svelte', () => ({
  p2pQuakeService: { fetchHistory: vi.fn(async () => []), connectWebSocket: vi.fn() }
}));

function fakeController(): AppController {
  return {
    setTab: vi.fn(),
    updateEpicenter: vi.fn(),
    updateAreaIntensity: vi.fn(),
    updateVisibility: vi.fn(),
    lastEewKey: null,
    lastEewTime: 0
  } as unknown as AppController;
}

beforeEach(() => {
  vi.clearAllMocks();
  wolfxEewService.eewData = null;
  wolfxEewService.isEewDismissed = false;
});

describe('handleEew 알림 게이트', () => {
  it('취소 보고는 소리/알림 없이 무시', () => {
    createFeedHandlers(fakeController()).onEew({
      OriginTime: '2026/11/07 12:00:00',
      AnnouncedTime: '2026/11/07 12:00:01',
      Hypocenter: '테스트',
      MaxIntensity: '4',
      isCancel: true
    });
    expect(soundService.playShindoAudio).not.toHaveBeenCalled();
    expect(notificationService.notifyEew).not.toHaveBeenCalled();
    expect(wolfxEewService.eewData).toBeNull();
  });

  it('정상 EEW는 소리/알림 유지', () => {
    createFeedHandlers(fakeController()).onEew({
      OriginTime: '2026/11/07 12:00:00',
      Hypocenter: '테스트',
      MaxIntensity: '4'
    });
    expect(soundService.playShindoAudio).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyEew).toHaveBeenCalledTimes(1);
  });

  it('시뮬레이션 진행 중 실제 EEW 수신은 차단 (p2p 경로)', () => {
    wolfxEewService.eewData = { isSimulation: true, simulationStartTime: Date.now() } as any;
    createFeedHandlers(fakeController()).onEew({
      OriginTime: '2026/11/07 12:00:00',
      Hypocenter: '실제 지진',
      MaxIntensity: '5-'
    });
    expect(soundService.playShindoAudio).not.toHaveBeenCalled();
    expect((wolfxEewService.eewData as any).isSimulation).toBe(true);
  });
});

describe('handleNewQuake 알림 게이트', () => {
  const scalePrompt = {
    id: 'sp1',
    time: '2026/11/07 12:00:00',
    issue: { type: 'ScalePrompt' },
    earthquake: { maxScale: 30, hypocenter: { name: '', magnitude: -1, latitude: -200, longitude: -200, depth: -1 } },
    areas: []
  };

  it('ScalePrompt(진원지 미상 속보)는 소리/알림/탭 전환 생략, 표시는 유지', () => {
    const c = fakeController();
    createFeedHandlers(c).onNewQuake(scalePrompt);
    expect(soundService.playShindoAudio).not.toHaveBeenCalled();
    expect(notificationService.notifyQuake).not.toHaveBeenCalled();
    expect(c.setTab).not.toHaveBeenCalled();
    expect(c.updateAreaIntensity).toHaveBeenCalledTimes(1);
  });

  it('상세 통보(DetailScale)는 소리/알림 유지', () => {
    const c = fakeController();
    createFeedHandlers(c).onNewQuake({
      ...scalePrompt,
      id: 'ds1',
      issue: { type: 'DetailScale' },
      earthquake: { maxScale: 45, hypocenter: { name: '테스트', magnitude: 5.1, latitude: 35, longitude: 140, depth: 10 } }
    });
    expect(soundService.playShindoAudio).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyQuake).toHaveBeenCalledTimes(1);
    expect(c.setTab).toHaveBeenCalledWith('earthquake');
  });
});
