import colorMapData from '../../../KyoshinShindoColorMap.json';
import { t } from '../i18n/i18n';

/**
 * JMA 진도계급 단일 테이블 — 코드/라벨/색상/계측진도 임계값의 유일한 출처.
 * scale: P2PQuake·kmoni 진도 코드 (10=진도1 … 70=진도7, 45/50=5弱/5強 …) — P2P 공식 스펙 준수
 * threshold: 계측진도(jindo)가 이 값 이상이면 해당 계급 (jindoToScale)
 */
export interface JmaLevel {
  scale: number;
  threshold: number;
  label: string;
  short: string;
  color: string;
  snd: number; // 진도 알림음 샘플 인덱스 (chime/sound-samples)
}

export const JMA_LEVELS: JmaLevel[] = [
  { scale: 10, threshold: 0.5, label: '진도 1', short: '1',   color: '#A0E0FF', snd: 1 },
  { scale: 20, threshold: 1.5, label: '진도 2', short: '2',   color: '#A0D0FF', snd: 2 },
  { scale: 30, threshold: 2.5, label: '진도 3', short: '3',   color: '#B0C0FF', snd: 3 },
  { scale: 40, threshold: 3.5, label: '진도 4', short: '4',   color: '#70E080', snd: 4 },
  { scale: 45, threshold: 4.5, label: '진도 5弱', short: '5弱', color: '#80C000', snd: 5 },
  { scale: 50, threshold: 5.0, label: '진도 5強', short: '5強', color: '#F08000', snd: 5.5 },
  { scale: 55, threshold: 5.5, label: '진도 6弱', short: '6弱', color: '#D07000', snd: 6 },
  { scale: 60, threshold: 6.0, label: '진도 6強', short: '6強', color: '#E02020', snd: 6.5 },
  { scale: 70, threshold: 6.5, label: '진도 7', short: '7',   color: '#A00020', snd: 7 }
];

function levelByScale(scale: number): JmaLevel | null {
  return JMA_LEVELS.find(l => l.scale === scale) ?? null;
}

function levelByScaleAtLeast(scale: number): JmaLevel | null {
  for (let i = JMA_LEVELS.length - 1; i >= 0; i--) {
    if (scale >= JMA_LEVELS[i].scale) return JMA_LEVELS[i];
  }
  return null;
}

/** 계측진도 → 진도계급 코드 (0 = 불명/미감지) */
export function jindoToScale(maxJindo: number): number {
  for (let i = JMA_LEVELS.length - 1; i >= 0; i--) {
    if (maxJindo >= JMA_LEVELS[i].threshold) return JMA_LEVELS[i].scale;
  }
  return 0;
}

/** 진도 코드(또는 그 이상) → 짧은 JMA 표기 ('5弱' 등, 진도 미만이면 '0') */
export function jmaShortAtLeast(scale: number): string {
  return levelByScaleAtLeast(scale)?.short ?? '0';
}

/** 진도 코드 → 알림음 샘플 인덱스 (테이블 밖 코드는 null) */
export function scaleToSnd(scale: number): number | null {
  return levelByScale(scale)?.snd ?? null;
}

export interface JindoBadgeStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

// 배지 프레젠테이션 클래스 — JMA 공식 팔레트와 동일 색 (Tailwind 기본 팔레트에 없어 임의값 클래스)
// 밝은 계급(1~5弱)은 어두운 글자, 5強 이상은 흰 글자
const BADGE_CLASSES: Record<number, { bg: string; text: string; border: string }> = {
  10: { bg: 'bg-[#A0E0FF]', text: 'text-sky-950', border: 'border-[#A0E0FF]' },
  20: { bg: 'bg-[#A0D0FF]', text: 'text-sky-950', border: 'border-[#A0D0FF]' },
  30: { bg: 'bg-[#B0C0FF]', text: 'text-indigo-950', border: 'border-[#B0C0FF]' },
  40: { bg: 'bg-[#70E080]', text: 'text-emerald-950', border: 'border-[#70E080]' },
  45: { bg: 'bg-[#80C000]', text: 'text-zinc-950', border: 'border-[#80C000]' },
  50: { bg: 'bg-[#F08000]', text: 'text-white', border: 'border-[#F08000]' },
  55: { bg: 'bg-[#D07000]', text: 'text-white', border: 'border-[#D07000]' },
  60: { bg: 'bg-[#E02020]', text: 'text-white', border: 'border-[#E02020]' },
  70: { bg: 'bg-[#A00020]', text: 'text-white', border: 'border-[#A00020]' }
};

export function getJindoBadgeStyle(scale: number | undefined): JindoBadgeStyle {
  const unknown = { bg: 'bg-zinc-600', text: 'text-zinc-200', border: 'border-zinc-500', label: t('불명') };
  if (scale === undefined) return unknown;
  const cls = BADGE_CLASSES[scale];
  if (!cls) return unknown;
  return { ...cls, label: t(levelByScale(scale)?.label ?? '불명') };
}

export function getJindoString(scale: number | undefined): string {
  if (scale === undefined) return t('불명');
  const short = levelByScale(scale)?.short;
  return short ? t(short) : t('불명');
}

export function getIntensityColor(scale: number): string {
  return levelByScaleAtLeast(scale)?.color ?? 'transparent';
}

export function getTsunamiText(domesticTsunami: string | undefined): { text: string; colorClass: string } {
  if (domesticTsunami === 'None') return { text: t('해일 영향 없음'), colorClass: 'text-emerald-500' };
  if (domesticTsunami === 'Checking') return { text: t('해일 영향 조사 중'), colorClass: 'text-yellow-500 font-bold' };
  if (domesticTsunami === 'NonEffective') return { text: t('약한 해일 변동 (피해 없음)'), colorClass: 'text-blue-400' };
  if (domesticTsunami === 'Watch') return { text: t('해일 주의보 발령'), colorClass: 'text-amber-500 font-bold' };
  if (domesticTsunami === 'Warning') return { text: t('해일 경보 발령'), colorClass: 'text-red-500 font-bold animate-pulse' };
  return { text: t('해일 정보 없음'), colorClass: 'text-zinc-400' };
}

interface ColorMapItem {
  Intensity: number;
  R: number;
  G: number;
  B: number;
}

const colorMap = colorMapData as ColorMapItem[];

/** 최근접 팔레트 색 매칭. 거리가 maxDist를 넘으면 null (안티앨리어싱/혼색 픽셀 거름) */
export function getJindoFromColorStrict(r: number, g: number, b: number, maxDist = 48): number | null {
  if (r < 15 && g < 15 && b < 15) return -3;

  let minDistance = Infinity;
  let matchedJindo = -3;

  for (const item of colorMap) {
    const dr = r - item.R;
    const dg = g - item.G;
    const db = b - item.B;
    const dist = dr * dr + dg * dg + db * db;

    if (dist < minDistance) {
      minDistance = dist;
      matchedJindo = item.Intensity;
    }
  }

  return minDistance <= maxDist * maxDist ? matchedJindo : null;
}

export function getJindoFromColor(r: number, g: number, b: number): number {
  return getJindoFromColorStrict(r, g, b, Infinity) ?? -3;
}
