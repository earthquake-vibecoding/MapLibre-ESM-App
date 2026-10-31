/**
 * 의존성 없는 고퀄리티 마스터 체인:
 * 생성형 임펄스 응답 컨볼루션 리버브 + 컴프레서로 종소리에 공간감을 부여.
 */

const irCache = new WeakMap<AudioContext, AudioBuffer>();

function impulseResponse(ctx: AudioContext, seconds = 2.2, decay = 3.2): AudioBuffer {
  const cached = irCache.get(ctx);
  if (cached) return cached;
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // 지수 감쇠 노이즈 = 홀 울림 근사
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  irCache.set(ctx, buf);
  return buf;
}

/**
 * 입력 게인 하나로 끝나는 마스터 체인을 만들어 반환.
 * tone 출력 → input → [컴프레서 → dry/wet → destination]
 */
export function createMasterChain(ctx: AudioContext, wet = 0.38): GainNode {
  const input = ctx.createGain();

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;

  const dry = ctx.createGain();
  dry.gain.value = 1 - wet * 0.4;
  const send = ctx.createGain();
  send.gain.value = wet;

  const dampen = ctx.createBiquadFilter();
  dampen.type = 'lowpass';
  dampen.frequency.value = 5200;

  const convolver = ctx.createConvolver();
  convolver.buffer = impulseResponse(ctx);

  input.connect(comp);
  comp.connect(dry);
  dry.connect(ctx.destination);
  comp.connect(send);
  send.connect(dampen);
  dampen.connect(convolver);
  convolver.connect(ctx.destination);

  return input;
}
