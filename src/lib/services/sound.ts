import { playIntensitySound } from '../chime';
import { playShindoSample, playDetectionSample, shindoSampleIndex } from '../sound-samples';
import { jindoToScale } from '../jma-utils';
import { dbg } from '../debug';
import { ALERT, DETECT, TIMING } from '../config';

export class SoundService {
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;
  private shindoAudio: HTMLAudioElement | null = null;
  private keepAliveOsc: OscillatorNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.shindoAudio = new Audio('/Shindo.wav');
        this.shindoAudio.preload = 'auto';
        this.shindoAudio.volume = ALERT.shindoVolume;
      } catch {
        // ignore
      }

      const unlockAudio = () => {
        const ctx = this.getAudioContext();
        if (!ctx) {
          // AudioContext 자체가 없는 환경 — 재시도 무의미, 리스너 정리
          this.removeUnlockListeners(unlockAudio);
          return;
        }
        if (this.isUnlocked) return;
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            this.isUnlocked = true;
            this.startKeepAlive(ctx);
            this.removeUnlockListeners(unlockAudio);
          }).catch(() => undefined);
        } else if (ctx.state === 'running') {
          this.isUnlocked = true;
          this.startKeepAlive(ctx);
          this.removeUnlockListeners(unlockAudio);
        }

        // Play a silent buffer to fully unlock iOS Safari
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);

        if (this.shindoAudio) {
          this.shindoAudio.load();
        }
      };

      document.addEventListener('click', unlockAudio);
      document.addEventListener('touchstart', unlockAudio);
      document.addEventListener('keydown', unlockAudio);
    }
  }

  private removeUnlockListeners(handler: EventListener) {
    document.removeEventListener('click', handler);
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('keydown', handler);
  }

  /**
   * 백그라운드 스로틀링 회피: 무음 수준(0.001) 오실레이터로 탭을 audible 상태로 유지.
   * Chrome은 audible 탭을 강제 스로틀링(Intensive Wake Up Throttling) 대상에서 제외 —
   * 백그라운드에서도 감지 폴링 setInterval이 1초 주기를 유지함. 탭에 🔊 표시가 생기는 게 부작용.
   */
  private startKeepAlive(ctx: AudioContext): void {
    if (this.keepAliveOsc) return;
    // Electron은 backgroundThrottling: false로 스로틀링 자체가 없음 — 트릭은 브라우저에서만 필요
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) return;
    try {
      const osc = ctx.createOscillator();
      osc.frequency.value = 15; // 가청 하한(~20Hz) 아래 — 대부분의 스피커가 물리적으로 재생 불가, 사람에겐 무음
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.keepAliveOsc = osc;
    } catch {
      // WebAudio 미지원 환경 — 포기
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => undefined);
    }
    return this.audioCtx;
  }

  playIntensity(scale: number | string | undefined): void {
    // 실제 샘플(shi0-6) 우선, 사용 불가 시 신스 폴백
    if (playShindoSample(scale)) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    playIntensitySound(ctx, scale);
  }

  private lastShindoPlayTime = 0;
  private lastShindoScale: string | number | undefined = undefined;

  playShindoAudio(scale?: number | string): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    if (now - this.lastShindoPlayTime < TIMING.shindoSoundGapMs && this.lastShindoScale === scale) {
      return;
    }
    this.lastShindoPlayTime = now;
    this.lastShindoScale = scale;

    try {
      const audio = this.shindoAudio || new Audio('/Shindo.wav');
      audio.currentTime = 0;
      audio.volume = ALERT.shindoVolume;
      const playPromise = audio.play();

      let scaleSoundTriggered = false;
      const triggerScaleSound = () => {
        if (scaleSoundTriggered || scale === undefined) return;
        scaleSoundTriggered = true;
        this.playIntensity(scale);
      };

      if (scale !== undefined) {
        // 진도 알림음도 함께 플레이 (약간의 딜레이로 오버랩)
        setTimeout(() => {
          triggerScaleSound();
        }, 200);
      }

      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Shindo.wav playback failed/blocked, fallback to synthetic sound:', err);
          triggerScaleSound();
        });
      }
    } catch (e) {
      console.warn('Shindo.mp3 playback error:', e);
      if (scale !== undefined) {
        this.playIntensity(scale);
      } else {
        this.playIntensity(5);
      }
    }
  }

  playDetectionSound(intensity: number | string): void {
    this.playIntensity(intensity);
  }

  private lastDetectBeep = 0;

  /** 흔들림 감지: shi0 비프(15초 쓰로틀 — 감지 프레임마다 호출되므로 도배 방지) + 계급 상승 시 진도 알림음(shi1~7) 겹침 */
  playShakeDetected(jindo?: number): void {
    const scale = jindo !== undefined && jindo >= DETECT.displayJindoMin ? jindoToScale(jindo) : 0;
    const now = Date.now();
    const beepAllowed = now - this.lastDetectBeep > TIMING.detectBeepGapMs;
    let played = false;
    if (beepAllowed) {
      played = playDetectionSample();
      if (played) {
        this.lastDetectBeep = now;
        dbg(`감지비프 shi0 (jindo=${jindo ?? '없음'})`);
      }
    }
    if (scale > 0 && playShindoSample(scale)) {
      played = true;
      dbg(`진도음 shi${shindoSampleIndex(scale)}`);
    }
    // shi0 쓰로틀 중이어도 감지 프레임 자체는 처리된 것 — 신스 폴백은 샘플이 전부 실패했을 때만
    if (played || !beepAllowed) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    playIntensitySound(ctx, scale > 0 ? scale : 1);
  }
}

export const soundService = new SoundService();
