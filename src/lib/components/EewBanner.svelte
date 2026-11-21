<script lang="ts">
  import type { EEWMessage } from '../models';
  import { t } from '../i18n/i18n';

  interface Props {
    eew: EEWMessage | null;
    onDismiss: () => void;
    onFocusEew: () => void;
    onFocusGrid: () => void;
  }

  let { eew, onDismiss, onFocusEew, onFocusGrid }: Props = $props();
</script>

{#if eew}
  <!-- 모바일에선 MapTools 툴바 아래로 내림 (top-14면 툴바와 겹침) -->
  <div class="absolute top-26 sm:top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[92%] max-w-md animate-overlay-in">
    <div class={'border-2 rounded-lg shadow-xl p-3 flex flex-col gap-2 relative ' + (eew.isWarn ? 'bg-red-950 border-red-500 text-white' : 'bg-zinc-900 border-amber-400 text-zinc-100')}>

      <button
        onclick={onDismiss}
        class="absolute top-3 right-3 p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        title={t('닫기')}
        aria-label={t('닫기')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <!-- 1행: 라벨 + 경보 배지(警報만) -->
      <div class="flex items-center gap-2 pr-7">
        <span class="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
        <span class="font-extrabold text-base sm:text-lg tracking-tight text-red-500">{t('EEW')}</span>
        {#if eew.isWarn}
          <span class="text-[11px] px-2 py-0.5 rounded bg-red-600 font-bold text-white shrink-0">{t('경보')}</span>
        {/if}
      </div>

      <!-- 2행: 진원 · M · 진도 · 이동 버튼 -->
      <div class="flex items-center justify-between gap-3">
        <p class="font-bold text-sm sm:text-base text-amber-400 truncate">
          {eew.Hypocenter}
          <span class="text-xs font-normal text-zinc-400">{t('깊이 {d}km', { d: eew.Depth })}</span>
        </p>
        <div class="flex items-center gap-2 shrink-0">
          <span class="font-black text-lg sm:text-xl text-red-500">M{eew.Magunitude}</span>
          <span class="font-black text-lg sm:text-xl text-orange-500">{t('진도 {n}', { n: eew.MaxIntensity })}</span>
          <button
            onclick={onFocusEew}
            class="px-2.5 py-1 text-xs rounded-md font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer">
            {t('EEW 진앙')}
          </button>
          <button
            onclick={onFocusGrid}
            class="px-2.5 py-1 text-xs rounded-md font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer">
            {t('격자 이동')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
