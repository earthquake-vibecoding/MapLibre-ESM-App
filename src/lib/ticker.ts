import { wolfxEewService } from './services/wolfx-eew.svelte';
import { isActiveEEW } from './quake/quake-utils';
import { computeWaveState, type SeismicTable } from './detect/seismic';
import { reapplyLastFrame, type RealtimeHost } from './detect/realtime-img';
import { reportAlertStatus } from './electron-bridge';
import { TIMING } from './config';
import type { MapController } from './map/map-controller';

export interface TickerHost extends RealtimeHost {
  readonly seismicData: SeismicTable;
  updateVisibility(): void;
  updateEpicenter(): void;
  updateDetectedEvents(): void;
  /** EEW 예상진도 마스크 — kmoni EstShindoImg 프레임 샘플링(시뮬은 감쇠식), 500ms 스로틀 */
  updateEstShindoMask(): void;
  clearEstShindoMask(): void;
}

/** 렌더 루프 — 감지 판정·만료·웹후크는 서버(detect-runner.mjs)가 SSE로 밀어주고 여기선 표시만 담당 */
export class Ticker {
  private animationId: number | null = null;
  private lastWaveRenderTime = 0;
  private lastMaskRenderTime = 0;
  private wavesActive = false;

  constructor(private host: TickerHost) {}

  start(): void {
    this.loop();
  }

  stop(): void {
    if (this.animationId !== null && typeof window !== 'undefined') {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = null;
  }

  /** 지표/지중 전환 — 마지막 프레임을 표시 소스만 갱신 (사이드이펙트 재생 없음) */
  refreshTime(): void {
    reapplyLastFrame();
  }

  private loop = () => {
    try {
      this.tickOnce();
    } catch (e) {
      // 지도/서비스 예외가 rAF 루프 자체를 죽이는 것 방지
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

    // 감지 격자 점멸 — 이벤트는 서버가 SSE frame.ev로 밀어줌 (로컬 만료/웹후크 없음)
    const mapCtl = this.host.mapCtl;
    let activeCount = 0;
    for (const stn of this.host.stationsState.values()) {
      if (stn.event) activeCount++;
    }
    if (activeCount > 0 && mapCtl) {
      mapCtl.blinkDetected(Math.floor(now / TIMING.blinkMs) % 2 === 0);
    }

    // 트레이 상태 보고: 감지 격자 또는 활성 EEW (브라우저에선 noop)
    reportAlertStatus(activeCount > 0 || !!wolfxEewService.eewData);

    // wave animation
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
      this.host.updateEstShindoMask();
    }
  }
}
