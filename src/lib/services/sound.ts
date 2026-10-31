import { playIntensitySound } from '../chime';
import { playShindoSample, playDetectionSample } from '../sound-samples';

export class SoundService {
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;
  private shindoAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.shindoAudio = new Audio('/Shindo.wav');
        this.shindoAudio.preload = 'auto';
        this.shindoAudio.volume = 0.85;
      } catch {
        // ignore
      }

      const unlockAudio = () => {
        if (this.isUnlocked) return;
        const ctx = this.getAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
              this.isUnlocked = true;
              this.removeUnlockListeners(unlockAudio);
            }).catch(() => undefined);
          } else if (ctx.state === 'running') {
            this.isUnlocked = true;
            this.removeUnlockListeners(unlockAudio);
          }

          // Play a silent buffer to fully unlock iOS Safari
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        }

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
    if (now - this.lastShindoPlayTime < 1500 && this.lastShindoScale === scale) {
      return;
    }
    this.lastShindoPlayTime = now;
    this.lastShindoScale = scale;

    try {
      const audio = this.shindoAudio || new Audio('/Shindo.wav');
      audio.currentTime = 0;
      audio.volume = 0.85;
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

  playSyntheticShindoSound(): void {
    this.playIntensity(5);
  }

  playDetectionSound(intensity: number | string): void {
    this.playIntensity(intensity);
  }

  /** 흔들림 감지 비프 (shi0 샘플, 실패 시 신스) */
  playShakeDetected(): void {
    if (playDetectionSample()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    playIntensitySound(ctx, 1);
  }
}

export const soundService = new SoundService();
