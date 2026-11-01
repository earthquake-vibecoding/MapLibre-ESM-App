import { wolfxEewService } from './services/wolfx-eew.svelte';
import { isActiveEEW } from './quake-utils';
import { computeWaveState, type SeismicTable } from './seismic';
import { fetchLatestTime, type RealtimeHost } from './realtime-img';
import { clearDetectedEvents } from './grid';
import { reportAlertStatus } from './electron-bridge';
import { TIMING } from './config';
import { accumulateExpiredEvent, finishDetectionEpisode } from './detection-log';
import type { MapController } from './map-controller';

export interface TickerHost extends RealtimeHost {
  readonly seismicData: SeismicTable;
  updateVisibility(): void;
  updateEpicenter(): void;
  updateDetectedEvents(): void;
  resetMapView(): void;
}

export class Ticker {
  private animationId: number | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private lastWaveRenderTime = 0;
  private wavesActive = false;

  constructor(private host: TickerHost) {}

  start(): void {
    this.startHeartbeat();
    this.loop();
  }

  stop(): void {
    if (this.animationId !== null && typeof window !== 'undefined') {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = null;
    if (this.heartbeatId !== null) clearInterval(this.heartbeatId);
    this.heartbeatId = null;
  }

  refreshTime(): void {
    fetchLatestTime(this.host);
  }

  /** 감지 폴링(1s) — rAF는 백그라운드 탭에서 완전 정지하므로 타이머로 분리. 스로틀링 회피는 sound.ts keep-alive */
  private startHeartbeat(): void {
    if (typeof window === 'undefined') return;
    this.heartbeatId = setInterval(() => fetchLatestTime(this.host), TIMING.heartbeatMs);
  }

  private loop = () => {
    try {
      this.tickOnce();
    } catch (e) {
      // 지도/서비스 예외가 rAF 루프 자체를 죽여 만료 처리가 멈추는 것 방지
      console.warn('ticker loop error (continuing):', e);
    } finally {
      if (typeof window !== 'undefined') {
        this.animationId = requestAnimationFrame(this.loop);
      }
    }
  };

  private tickOnce(): void {
    const now = Date.now();

    // EEW 만료 체크: 오래된 EEW 제거
    const currentEew = wolfxEewService.eewData;
    if (currentEew && !isActiveEEW(currentEew)) {
      wolfxEewService.eewData = null;
      wolfxEewService.isEewDismissed = false;
      this.host.updateVisibility();
    }

    // 2+3. station event: 감지 블링/만료를 단일 패스로 처리 (프레임마다 Array.from 할당 방지)
    const mapCtl = this.host.mapCtl;
    let activeCount = 0;
    let expired = false;
    for (const stn of this.host.stationsState.values()) {
      if (!stn.event) continue;
      if (stn.expireTime && now >= stn.expireTime) {
        accumulateExpiredEvent(stn); // 기록용 — event가 지워지기 전에 누적
        stn.event = null;
        stn.expireTime = null;
        expired = true;
      } else {
        activeCount++;
      }
    }
    if (activeCount > 0 && mapCtl) {
      mapCtl.blinkDetected(Math.floor(now / TIMING.blinkMs) % 2 === 0);
    }
    if (expired) {
      if (activeCount === 0) {
        finishDetectionEpisode(); // 에피소드 종료 → 감지 기록 1건
        this.host.resetMapView();
        clearDetectedEvents();
      }
      this.host.updateDetectedEvents();
    }

    // 트레이 상태 보고: 감지 격자 또는 활성 EEW (브라우저에선 noop)
    reportAlertStatus(activeCount > 0 || !!wolfxEewService.eewData);

    // 4. wave animation
    this.updateWaves(now);
  }

  private updateWaves(now: number): void {
    const mapCtl = this.host.mapCtl;
    if (!mapCtl) return;

    const eew = wolfxEewService.eewData;
    const wave = computeWaveState(eew, this.host.seismicData, now);

    if (!wave.active) {
      if (this.wavesActive) {
        this.wavesActive = false;
        mapCtl.setSource('p-wave', wave.pFc);
        mapCtl.setSource('s-wave', wave.sFc);
      }
      return;
    }

    this.wavesActive = true;
    if (now - this.lastWaveRenderTime < TIMING.waveThrottleMs) return;
    this.lastWaveRenderTime = now;

    if (eew) {
      this.host.updateEpicenter();
    }

    mapCtl.setWavePaint(wave.pFade, wave.sFade);
    mapCtl.setSource('p-wave', wave.pFc);
    mapCtl.setSource('s-wave', wave.sFc);
  }
}
