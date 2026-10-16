<script lang="ts">
  import SoundPreview from './SoundPreview.svelte';

  interface Props {
    hasDetectedGrids: boolean;
    onTriggerEewSimulation: () => void;
    onFocusDetectedGrid: () => void;
    onClose: () => void;
  }

  let { hasDetectedGrids, onTriggerEewSimulation, onFocusDetectedGrid, onClose }: Props = $props();
</script>

<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onclick={onClose} role="presentation">
  <div
    class="w-full max-w-sm rounded-2xl shadow-2xl border border-zinc-200 bg-white text-zinc-800 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 p-5 flex flex-col gap-4 animate-modal-in"
    onclick={(e) => e.stopPropagation()} role="dialog" aria-label="도구" tabindex="-1">
    <div class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
      <div class="flex items-center gap-2">
        <span class="text-xl">🛠️</span>
        <h3 class="font-bold text-base">도구</h3>
      </div>
      <button
        onclick={onClose}
        class="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer">
        ✕
      </button>
    </div>

    <div class="flex flex-col gap-2">
      <button
        onclick={onTriggerEewSimulation}
        class="w-full px-3 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer transition-all bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/></svg>
        P/S파 모의 시뮬레이션
      </button>
      <button
        onclick={onFocusDetectedGrid}
        class={'w-full px-3 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer transition-all border ' + (hasDetectedGrids
          ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-900/30 animate-pulse'
          : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="7"/></svg>
        감지 격자로 이동
      </button>
    </div>

    <div class="pt-3 border-t border-zinc-200 dark:border-white/10 flex justify-center">
      <SoundPreview />
    </div>
  </div>
</div>
