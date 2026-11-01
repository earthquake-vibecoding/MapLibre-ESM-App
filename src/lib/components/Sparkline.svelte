<script lang="ts">
  /** 최근 60초 계측진도 스파크라인 — 세로 30px 영역, 진도 [-1, hi] 자동 스케일 */
  interface Props {
    hist: { t: number; j: number | null }[];
    color: string;
  }
  let { hist, color }: Props = $props();

  const sparkPoints = $derived.by(() => {
    const pts = hist.filter((p) => p.j != null) as { t: number; j: number }[];
    if (pts.length < 2) return null;
    const hi = Math.max(1.5, ...pts.map((p) => p.j)) + 0.5;
    const lo = -1;
    const y = (v: number) => 32 - ((v - lo) / (hi - lo)) * 28;
    const x = (i: number) => (i / (pts.length - 1)) * 100;
    return {
      line: pts.map((p, i) => `${x(i).toFixed(1)},${y(p.j).toFixed(1)}`).join(' '),
      lastX: x(pts.length - 1),
      lastY: y(pts[pts.length - 1].j),
      zeroY: y(0)
    };
  });
</script>

<svg viewBox="0 0 100 34" preserveAspectRatio="none" class="w-full h-20 block rounded bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800">
  <line x1="0" y1={sparkPoints?.zeroY} x2="100" y2={sparkPoints?.zeroY} stroke="currentColor" class="text-zinc-200 dark:text-zinc-700" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3" />
  <polyline points={sparkPoints?.line} fill="none" stroke={color} stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
  <circle cx={sparkPoints?.lastX} cy={sparkPoints?.lastY} r="2.5" fill={color} vector-effect="non-scaling-stroke" />
</svg>
