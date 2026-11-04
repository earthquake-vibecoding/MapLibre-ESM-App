<script lang="ts">
  import { usgsService, type OverseasQuake } from '../services/usgs.svelte';

  interface Props {
    onFocusQuake: (q: OverseasQuake) => void;
  }
  let { onFocusQuake }: Props = $props();

  function fmtTime(ms: number): string {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function magStyle(mag: number): string {
    if (mag >= 7) return 'bg-rose-600 text-white';
    if (mag >= 6) return 'bg-orange-500 text-white';
    if (mag >= 5) return 'bg-amber-400 text-zinc-900';
    return 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200';
  }
</script>

<div class="absolute bottom-4 left-4 z-20 w-[300px] max-h-[55vh] pointer-events-auto flex flex-col rounded-lg border border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95 animate-overlay-in">
  <div class="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 flex items-baseline justify-between shrink-0">
    <h2 class="text-xs font-extrabold text-zinc-700 dark:text-zinc-200">해외지진</h2>
    <span class="text-[10px] font-mono text-zinc-400">USGS M4.5+ 24h · {usgsService.quakes.length}건</span>
  </div>
  <div class="overflow-y-auto custom-scrollbar">
    {#each usgsService.quakes as q (q.id)}
      <button
        onclick={() => onFocusQuake(q)}
        title="진원지로 이동"
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0">
        <span class={'px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ' + magStyle(q.mag)}>M{q.mag.toFixed(1)}</span>
        <span class="flex-1 min-w-0">
          <span class="block text-[11px] font-bold text-zinc-800 dark:text-zinc-100 truncate">{q.place || '진원지 미상'}</span>
          <span class="block text-[10px] font-mono text-zinc-400">{fmtTime(q.time)} · 깊이 {Math.round(q.depth)}km</span>
        </span>
      </button>
    {:else}
      <div class="px-3 py-4 text-[11px] text-zinc-400">불러오는 중...</div>
    {/each}
  </div>
</div>
