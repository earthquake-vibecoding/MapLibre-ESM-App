import { wolfxEewService } from './services/wolfx-eew.svelte';
import { isActiveEEW } from './quake-utils';
import { computeWaveState, type SeismicTable } from './seismic';
import { fetchLatestTime, type RealtimeHost } from './realtime-img';
import { clearDetectedEvents } from './grid';
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
  private lastTimeFetchMs = 0;
  private lastWaveRenderTime = 0;
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

  refreshTime(): void {
    fetchLatestTime(this.host);
  }

  private loop = () => {
    const now = Date.now();

    // 1. time update tick (1000ms)
    if (now - this.lastTimeFetchMs >= 1000) {
      this.lastTimeFetchMs = now;
      fetchLatestTime(this.host);
    }

    // EEW 만료 체크: 오래된 EEW 제거
    const currentEew = wolfxEewService.eewData;
    if (currentEew && !isActiveEEW(currentEew)) {
      wolfxEewService.eewData = null;
      wolfxEewService.isEewDismissed = false;
      this.host.updateVisibility();
    }

    // 2. detected layer blink tick (500ms)
    const mapCtl = this.host.mapCtl;
    const stationsState = this.host.stationsState;
    const hasDetectedEvents = Array.from(stationsState.values()).some(s => s.event !== null);
    if (hasDetectedEvents && mapCtl) {
      mapCtl.blinkDetected(Math.floor(now / 500) % 2 === 0);
    }

    // 3. station event expiration check
    let expired = false;
    for (const stn of stationsState.values()) {
      if (stn.event && stn.expireTime && now >= stn.expireTime) {
        stn.event = null;
        stn.expireTime = null;
        expired = true;
      }
    }
    if (expired) {
      this.host.updateDetectedEvents();
      const hasActiveEvents = Array.from(stationsState.values()).some(s => s.event !== null);
      if (!hasActiveEvents) {
        this.host.resetMapView();
        clearDetectedEvents();
      }
    }

    // 4. wave animation
    this.updateWaves(now);

    if (typeof window !== 'undefined') {
      this.animationId = requestAnimationFrame(this.loop);
    }
  };

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
    if (now - this.lastWaveRenderTime < 33) return;
    this.lastWaveRenderTime = now;

    if (eew) {
      this.host.updateEpicenter();
    }

    mapCtl.setWavePaint(wave.pFade, wave.sFade);
    mapCtl.setSource('p-wave', wave.pFc);
    mapCtl.setSource('s-wave', wave.sFc);
  }
}
