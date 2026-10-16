<script lang="ts">
  import type { EEWMessage } from '../models';
  import { isActiveEEW } from '../quake-utils';

  interface Props {
    currentGifUrl: string | null;
    acmapGifUrl: string | null;
    estshindoGifUrl: string | null;
    isGifExpanded: boolean;
    eew: EEWMessage | null;
    onToggleGifExpanded: () => void;
  }

  let { currentGifUrl, acmapGifUrl, estshindoGifUrl, isGifExpanded, eew, onToggleGifExpanded }: Props = $props();

  const headCls = 'px-2.5 py-1 text-xs font-semibold border-b flex justify-between items-center transition-colors cursor-pointer bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:border-white/10 dark:hover:bg-white/10';
</script>

<div class="absolute top-14 right-3 z-20 flex flex-col items-end gap-2 max-w-[360px] sm:max-w-[400px] max-h-[calc(100vh-5rem)]">
  {#if currentGifUrl}
    <div
      class={'border rounded-xl shadow-xl overflow-y-auto transition-all duration-300 origin-top-right flex flex-col custom-scrollbar border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900 ' + (isGifExpanded ? ' w-[360px] sm:w-[400px]' : ' w-48')}
    >
      <div class={headCls} onclick={onToggleGifExpanded}>
        <span>실시간 강진 모니터 (진도)</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {#if isGifExpanded}
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
          {:else}
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
          {/if}
        </svg>
      </div>

      <div class="relative w-full">
        <img src={currentGifUrl} alt="Realtime Earthquake Monitor GIF" class="w-full h-auto bg-slate-900 cursor-pointer" onclick={onToggleGifExpanded} referrerpolicy="no-referrer" />
        {#if estshindoGifUrl}
          <img src={estshindoGifUrl} alt="EEW Overlay" class="absolute top-0 left-0 w-full h-auto pointer-events-none" referrerpolicy="no-referrer" />
        {/if}
      </div>

      {#if acmapGifUrl}
        <div class={headCls} onclick={onToggleGifExpanded}>
          <span>실시간 강진 모니터 (가속도)</span>
        </div>
        <img src={acmapGifUrl} alt="PGA Monitor GIF" class="w-full h-auto bg-slate-900 cursor-pointer" onclick={onToggleGifExpanded} referrerpolicy="no-referrer" />
      {/if}
    </div>
  {/if}

  <!-- EEW 활성 시 GIF 아래 미니 카드 -->
  {#if eew && isActiveEEW(eew)}
    <div class={'w-full border rounded-xl shadow-lg p-2.5 sm:p-3 transition-all flex flex-col gap-1.5 animate-overlay-in ' + (eew.isWarn ? 'bg-red-950/90 border-red-500 text-white animate-pulse' : 'bg-zinc-950/90 border-amber-500/80 text-zinc-100 dark:bg-zinc-900/95')}>
      <div class="flex items-center justify-between gap-2 border-b pb-1 border-white/10">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          <span class="font-extrabold text-xs sm:text-sm text-red-500">{eew.Title || '緊急地震速報'}</span>
        </div>
        <span class="text-[10px] px-1.5 py-0.2 rounded bg-black/30 text-zinc-200 font-mono font-bold">{eew.Issue?.Status || '속보'}</span>
      </div>
      <div class="flex flex-col text-xs gap-0.5">
        <div class="font-bold text-amber-400 truncate">
          📍 {eew.Hypocenter || '진원지 미상'} <span class="text-[11px] font-normal text-zinc-300">(깊이: {eew.Depth}km)</span>
        </div>
        <div class="flex items-center justify-between mt-1 pt-1 border-t border-white/10 font-mono">
          <span>규모: <strong class="text-red-500 font-extrabold text-sm">M{eew.Magunitude}</strong></span>
          <span>최대진도: <strong class="text-orange-400 font-extrabold text-sm">{eew.MaxIntensity}</strong></span>
        </div>
      </div>
    </div>
  {/if}
</div>
