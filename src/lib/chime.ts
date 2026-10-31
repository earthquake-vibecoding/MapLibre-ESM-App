/**
 * 진도 1~7(5弱/5強, 6弱/6強 포함)별 알림음 합성.
 * 방송 two-tone 차임 + 언ison 디튠 + 컨볼루션 리버브 마스터 체인.
 */

import { createMasterChain } from './audio-reverb';

export function parseScale(scale: number | string | undefined): number {
  if (scale === undefined || scale === null) return 3;
  if (typeof scale === 'string') {
    const s = scale.trim();
    if (s === '5-' || s === '5弱' || s === '5a') return 5;
    if (s === '5+' || s === '5強' || s === '5b') return 5.5;
    if (s === '6-' || s === '6弱' || s === '6a') return 6;
    if (s === '6+' || s === '6強' || s === '6b') return 6.5;
    if (s === '7') return 7;
    const num = parseFloat(s);
    if (!isNaN(num)) return parseScale(num);
  }
  if (typeof scale === 'number') {
    if (scale === 10) return 1;
    if (scale === 20) return 2;
    if (scale === 30) return 3;
    if (scale === 40) return 4;
    if (scale === 45) return 5;
    if (scale === 46) return 5.5;
    if (scale === 50) return 6;
    if (scale === 55) return 6.5;
    if (scale === 60) return 7;
    if (scale >= 1 && scale <= 7) return scale;
    if (scale > 7) return 7;
  }
  return 3;
}

type ToneFn = (freq: number, startTime: number, duration: number, vol: number, pan?: number) => void;

export function playIntensitySound(ctx: AudioContext, scale: number | string | undefined): void {
  const normalized = parseScale(scale);
  const now = ctx.currentTime;

  // 리버브+컴프레서 마스터 체인 (공간감)
  const masterGain = createMasterChain(ctx, 0.38);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(normalized >= 5.5 ? 5000 : 3800, now);
  lowpass.connect(masterGain);

  // 두 박 차임 기본 톤: 디튠 유니슨 2개 + 2.76배 배음(종 울림 근사)
  const tone: ToneFn = (freq, startTime, duration, vol, pan = 0) => {
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const harmGain = ctx.createGain();

    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(freq, startTime);
    oscB.type = 'sine';
    oscB.frequency.setValueAtTime(freq * 1.0025, startTime); // 유니슨 디튠 = 폭/온기
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2.76, startTime);
    harmGain.gain.value = 0.12;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(vol, startTime + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscA.connect(gainNode);
    oscB.connect(gainNode);
    harmonic.connect(harmGain);
    harmGain.connect(gainNode);

    if ('createStereoPanner' in ctx) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, startTime);
      gainNode.connect(panner);
      panner.connect(masterGain);
    } else {
      gainNode.connect(masterGain);
    }

    oscA.start(startTime);
    oscB.start(startTime);
    harmonic.start(startTime);
    oscA.stop(startTime + duration + 0.05);
    oscB.stop(startTime + duration + 0.05);
    harmonic.stop(startTime + duration + 0.05);
  };

  // 저음 서브: 강한 진도일수록 깊은 울림
  const thump = (freq: number, startTime: number, duration: number, vol: number) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(vol, startTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  };

  // 반복 두 박 패턴: [고음, 저음] 쌍을 reps번 반복
  const twoTone = (high: number, low: number, reps: number, interval: number, vol: number) => {
    for (let i = 0; i < reps; i++) {
      const t = now + i * interval;
      const pan = i % 2 === 0 ? -0.15 : 0.15;
      tone(high, t, 0.55, vol, pan);
      tone(low, t + 0.09, 0.7, vol * 0.85, -pan);
    }
  };

  switch (normalized) {
    case 1:
      // 진도 1: 은은한 단일 핑
      tone(783.99, now, 0.5, 0.15);
      break;

    case 2:
      // 진도 2: 부드러운 두 백 (E5 -> G5)
      tone(659.25, now, 0.5, 0.18, -0.1);
      tone(783.99, now + 0.14, 0.6, 0.18, 0.1);
      break;

    case 3:
      // 진도 3: 밝은 상승 세 백 (C5 -> E5 -> G5)
      tone(523.25, now, 0.45, 0.2, -0.15);
      tone(659.25, now + 0.12, 0.5, 0.2, 0);
      tone(783.99, now + 0.24, 0.65, 0.22, 0.15);
      break;

    case 4:
      // 진도 4: 단정한 세 백 + 낮은 울림 (A4 -> C#5 -> E5, A2 서브)
      thump(110.0, now, 1.2, 0.12);
      tone(440.00, now, 0.5, 0.22, -0.15);
      tone(554.37, now + 0.13, 0.55, 0.22, 0.15);
      tone(659.25, now + 0.26, 0.8, 0.24, 0);
      break;

    case 5:
      // 진도 5弱: 두 박 차임 2회 반복
      thump(110.0, now, 1.6, 0.16);
      twoTone(659.25, 880.00, 2, 0.45, 0.24);
      break;

    case 5.5:
      // 진도 5強: 두 박 차임 3회 반복, 더 낮은 서브
      thump(87.31, now, 1.8, 0.2);
      twoTone(587.33, 783.99, 3, 0.42, 0.26);
      break;

    case 6:
      // 진도 6弱: 3회 반복 + 무거운 서브 (D)
      thump(73.42, now, 2.2, 0.26);
      twoTone(523.25, 698.46, 3, 0.4, 0.28);
      break;

    case 6.5:
      // 진도 6強: 4회 반복 + 깊은 서브 (C)
      thump(65.41, now, 2.5, 0.3);
      twoTone(466.16, 622.25, 4, 0.38, 0.3);
      break;

    case 7: {
      // 진도 7: 긴급 4회 반복 + 상승 마무리 + 깊은 서브
      thump(65.41, now, 3.0, 0.34);
      twoTone(415.30, 554.37, 4, 0.36, 0.32);
      const tEnd = now + 4 * 0.36 + 0.1;
      tone(554.37, tEnd, 0.5, 0.3);
      tone(622.25, tEnd + 0.12, 0.6, 0.3);
      tone(830.61, tEnd + 0.24, 1.2, 0.34);
      break;
    }

    default:
      tone(523.25, now, 0.6, 0.2);
      break;
  }
}
