<script lang="ts">
  import SoundPreview from './SoundPreview.svelte';

  interface Props {
    hasDetectedGrids: boolean;
    onTriggerEewSimulation: () => void;
    onFocusDetectedGrid: () => void;
    onClose: () => void;
  }

  let { hasDetectedGrids, onTriggerEewSimulation, onFocusDetectedGrid, onClose }: Props = $props();

  let dialogEl: HTMLElement | undefined = $state();

  $effect(() => {
    dialogEl?.focus();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
  <div
    bind:this={dialogEl}
    class="w-full max-w-sm rounded-lg shadow-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 p-5 flex flex-col gap-4 animate-modal-in focus:outline-none"
    role="dialog" aria-label="도구" tabindex="-1">
    <div class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700">
      <h3 class="font-bold text-base">도구</h3>
      <button
        onclick={onClose}
        class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
        닫기
      </button>
    </div>

    <div class="flex flex-col gap-2">
      <button
        onclick={onTriggerEewSimulation}
        class="w-full px-3 py-2.5 rounded-md font-bold text-sm flex items-center justify-center cursor-pointer transition-colors bg-amber-100 border border-amber-400 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900">
        P/S파 모의 시뮬레이션
      </button>
      <button
        onclick={onFocusDetectedGrid}
        class={'w-full px-3 py-2.5 rounded-md font-bold text-sm flex items-center justify-center cursor-pointer transition-colors border ' + (hasDetectedGrids
          ? 'bg-emerald-600 border-emerald-600 text-white'
          : 'bg-zinc-100 border-zinc-300 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700')}>
        감지 격자로 이동
      </button>
    </div>

    <div class="pt-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-center">
      <SoundPreview />
    </div>
  </div>
</div>
