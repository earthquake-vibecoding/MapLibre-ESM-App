<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { EEWMessage } from '../models';
  import { isActiveEEW } from '../quake-utils';
  import { ui } from '../state.svelte';

  interface Props {
    currentGifUrl: string | null;
    acmapGifUrl: string | null;
    estshindoGifUrl: string | null;
    isGifExpanded: boolean;
    eew: EEWMessage | null;
    onToggleGifExpanded: () => void;
  }

  let { currentGifUrl, acmapGifUrl, estshindoGifUrl, isGifExpanded, eew, onToggleGifExpanded }: Props = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isGifExpanded) onToggleGifExpanded();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="absolute top-14 right-3 z-20 flex flex-col items-end gap-2 max-w-[360px] sm:max-w-[400px] max-h-[calc(100vh-5rem)]">
  {#if currentGifUrl}
    {#if isGifExpanded}
      <!-- 확대: 중앙 라이트박스 -->
      <div
        class="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
        transition:fade={{ duration: 150 }}
        onclick={(e) => { if (e.target === e.currentTarget) onToggleGifExpanded(); }} role="presentation">

        <button
          onclick={onToggleGifExpanded}
          title="닫기 (ESC)"
          aria-label="닫기"
          class="absolute top-4 right-4 z-10 w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-lg font-bold cursor-pointer transition-colors border border-zinc-700">
          ✕
        </button>

        <div
          class="w-[min(94vw,980px)] max-h-full overflow-y-auto custom-scrollbar border border-zinc-200 rounded-xl shadow-2xl bg-white dark:border-zinc-700 dark:bg-zinc-900 animate-modal-in"
          transition:scale={{ duration: 150, start: 0.96 }}
          role="dialog" aria-label="실시간 강진 모니터 확대" tabindex="-1">

          <div class="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
            <h3 class="font-bold text-sm text-zinc-800 dark:text-zinc-100">실시간 강진 모니터</h3>
            <span class="font-mono text-[11px] tabular-nums text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">{ui.latestTime}</span>
          </div>

          <div class="grid gap-4 p-4 md:grid-cols-2">
            <figure class="flex flex-col gap-1.5 min-w-0">
              <figcaption class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                진도 (Surface)
              </figcaption>
              <div class="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-slate-900">
                <img src={currentGifUrl} alt="Realtime Shindo Monitor" class="w-full h-auto block [image-rendering:pixelated]" referrerpolicy="no-referrer" />
                {#if estshindoGifUrl}
                  <img src={estshindoGifUrl} alt="EEW Overlay" class="absolute top-0 left-0 w-full h-auto pointer-events-none [image-rendering:pixelated]" referrerpolicy="no-referrer" />
                {/if}
              </div>
            </figure>

            {#if acmapGifUrl}
              <figure class="flex flex-col gap-1.5 min-w-0">
                <figcaption class="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  가속도 (PGA)
                </figcaption>
                <div class="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-slate-900">
                  <img src={acmapGifUrl} alt="PGA Monitor" class="w-full h-auto block [image-rendering:pixelated]" referrerpolicy="no-referrer" />
                </div>
              </figure>
            {/if}
          </div>

          <div class="px-4 pb-3 text-[10px] text-zinc-400 text-center">
            배경 클릭 또는 ESC로 닫기 · 출처: 강진모니터 (kmoni)
          </div>
        </div>
      </div>
    {:else}
      <!-- 축소: 우측 상단 미니 카드 -->
      <div class="border rounded-lg shadow-sm overflow-hidden flex flex-col transition-all duration-300 origin-top-right border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 w-48">
        <button
          type="button"
          class="px-2.5 py-1.5 text-xs font-bold flex justify-between items-center transition-colors cursor-pointer w-full bg-zinc-50 text-zinc-600 border-b border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
          onclick={onToggleGifExpanded}>
          <span>실시간 강진 모니터</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <button
          type="button"
          class="relative w-full block p-0 border-0 bg-slate-900 cursor-pointer"
          onclick={onToggleGifExpanded}
          aria-label="실시간 강진 모니터 확대">
          <img src={currentGifUrl} alt="Realtime Shindo Monitor" class="w-full h-auto block" referrerpolicy="no-referrer" />
          {#if estshindoGifUrl}
            <img src={estshindoGifUrl} alt="EEW Overlay" class="absolute top-0 left-0 w-full h-auto pointer-events-none" referrerpolicy="no-referrer" />
          {/if}
        </button>
      </div>
    {/if}
  {/if}

  <!-- EEW 활성 시 미니 카드 아래 표시 -->
  {#if eew && isActiveEEW(eew)}
    <div class={'w-full border rounded-lg shadow-sm p-3 flex flex-col gap-1.5 animate-overlay-in ' + (eew.isWarn ? 'bg-red-950 border-red-600 text-white' : 'bg-zinc-900 border-amber-500 text-zinc-100')}>
      <div class="flex items-center justify-between gap-2 border-b pb-1.5 border-zinc-700">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          <span class="font-extrabold text-xs sm:text-sm text-red-500">{eew.Title || '緊急地震速報'}</span>
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono font-bold">{eew.Issue?.Status || '속보'}</span>
      </div>
      <div class="font-bold text-amber-400 truncate text-xs">
        {eew.Hypocenter || '진원지 미상'} <span class="text-[11px] font-normal text-zinc-400">깊이 {eew.Depth}km</span>
      </div>
      <div class="flex items-center justify-between font-mono text-xs">
        <span>규모 <strong class="text-red-500 font-extrabold text-sm">M{eew.Magunitude}</strong></span>
        <span>최대진도 <strong class="text-orange-400 font-extrabold text-sm">{eew.MaxIntensity}</strong></span>
      </div>
    </div>
  {/if}
</div>
