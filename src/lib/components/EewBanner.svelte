<script lang="ts">
  import type { EEWMessage } from '../models';

  interface Props {
    eew: EEWMessage | null;
    onDismiss: () => void;
    onFocusEew: () => void;
    onFocusGrid: () => void;
  }

  let { eew, onDismiss, onFocusEew, onFocusGrid }: Props = $props();
</script>

{#if eew}
  <div class="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[92%] max-w-md animate-overlay-in">
    <div class={'border-2 rounded-lg shadow-xl p-4 flex flex-col gap-2.5 relative ' + (eew.isWarn ? 'bg-red-950 border-red-500 text-white' : 'bg-zinc-900 border-amber-400 text-zinc-100')}>

      <button
        onclick={onDismiss}
        class="absolute top-3 right-3 p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        title="닫기">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="flex items-center justify-between gap-3 pr-7">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
          <span class="font-extrabold text-base sm:text-lg tracking-tight text-red-500">{eew.Title}</span>
        </div>
        <span class="text-[11px] px-2 py-0.5 rounded bg-zinc-800 font-bold border border-zinc-700 shrink-0">{eew.Issue?.Status}</span>
      </div>
      <div class="text-xs sm:text-sm flex flex-col gap-1">
        <p class="text-[11px] opacity-80">발생시각: <span class="font-mono font-semibold">{eew.OriginTime}</span></p>
        <p class="font-bold text-sm sm:text-base text-amber-400 truncate">{eew.Hypocenter} <span class="text-xs font-normal text-zinc-400">깊이 {eew.Depth}km</span></p>
        <div class="flex items-center justify-between gap-4 pt-2 border-t border-zinc-700">
          <div class="flex items-center gap-4">
            <p class="text-xs sm:text-sm">규모: <span class="font-black text-xl sm:text-2xl text-red-500">M{eew.Magunitude}</span></p>
            <p class="text-xs sm:text-sm">최대진도: <span class="font-black text-xl sm:text-2xl text-orange-500">{eew.MaxIntensity}</span></p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              onclick={onFocusEew}
              class="px-2.5 py-1 text-xs rounded-md font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer">
              EEW 진앙
            </button>
            <button
              onclick={onFocusGrid}
              class="px-2.5 py-1 text-xs rounded-md font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer">
              격자 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
