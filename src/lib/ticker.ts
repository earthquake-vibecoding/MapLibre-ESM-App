import { wolfxEewService } from './services/wolfx-eew.svelte';
import { isActiveEEW } from './quake/quake-utils';
import { computeWaveState, type SeismicTable } from './detect/seismic';
import { fetchLatestTime, type RealtimeHost } from './detect/realtime-img';
import { clearDetectedEvents } from './detect/grid';
import { reportAlertStatus } from './electron-bridge';
import { TIMING } from './config';
import { accumulateExpiredEvent, finishDetectionEpisode } from './detect/detection-log';
import { takeDetectSnapshot } from './detect/detect-snapshot';
import { reportDetectionEpisode } from './services/webhook';
import type { MapController } from './map/map-controller';

export interface TickerHost extends RealtimeHost {
  readonly seismicData: SeismicTable;
  updateVisibility(): void;
  updateEpicenter(): void;
  updateDetectedEvents(): void;
  /** EEW 예상진도 마스크 — 로컬 계산 전체 색칠 (500ms 스로틀, 시그니처 dedup) */
  updateEstShindoLocal(): void;
  clearEstShindoMask(): void;
}

export class Ticker {
  private animationId: number | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private lastWaveRenderTime = 0;
  private lastMaskRenderTime = 0;
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
        const entry = finishDetectionEpisode(); // 에피소드 종료 → 감지 기록 1건
        reportDetectionEpisode(entry, takeDetectSnapshot()); // 진도1 이상이면 기록+웹후크(지도 첨부)
        // 카메라만 전체 보기 복귀 (원본 동작) — 클린모드 진입은 전체보기 버튼 전용
        this.host.mapCtl?.fitFullView(800);
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
        this.host.clearEstShindoMask(); // 예상진도 마스크 잔상 제거
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

    // 예상진도 마스크: EEW 수신 즉시 전체 분포 색칠 — 파 링(33ms)보다 낮은 주기로 갱신
    if (eew && now - this.lastMaskRenderTime >= TIMING.maskThrottleMs) {
      this.lastMaskRenderTime = now;
      this.host.updateEstShindoLocal();
    }
  }
}
