<script lang="ts">
  import { t } from '../i18n/i18n';
  import { JMA_LEVELS } from '../quake/jma-utils';

  let open = $state(true);

  // 색은 JMA_LEVELS 단일 출처에서 파생 — 팔레트 변경 시 범례가 같이 따라감
  const entries: { c: string; l: string }[] = [...JMA_LEVELS].reverse().map(lv => ({ c: lv.color, l: lv.short }));
</script>

<div class="absolute bottom-4 right-4 z-20 hidden md:flex text-xs">
  {#if open}
    <div class="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 animate-overlay-in">
      <span class="font-extrabold text-[11px] text-zinc-500 dark:text-zinc-400">{t('진도')}</span>
      {#each entries as e (e.l)}
        <span class="flex items-center gap-1 font-bold text-zinc-700 dark:text-zinc-200">
          <span class="w-3 h-3 rounded-sm border border-zinc-300 dark:border-zinc-600" style={'background:' + e.c}></span>
          {t(e.l)}
        </span>
      {/each}
      <span class="w-px self-stretch bg-zinc-200 dark:bg-zinc-700"></span>
      <span class="flex items-center gap-1 font-bold text-zinc-700 dark:text-zinc-200">
        <span class="w-4 h-0 border-t-2 border-dashed border-orange-500"></span>
        {t('판경계')}
      </span>
      <span class="flex items-center gap-1 font-bold text-zinc-700 dark:text-zinc-200">
        <span class="w-4 h-0 border-t-2 border-red-500"></span>
        {t('활단층')}
      </span>
      <!-- 역사지진 행 — 마커 숨김 중이라 같이 숨김 (map-boot.ts에서 addHistoricalQuakes 주석 해제 시 같이 복구)
      <span class="flex items-center gap-1 font-bold text-zinc-700 dark:text-zinc-200">
        <span class="flex -space-x-0.5">
          <span class="w-1.5 h-1.5 rounded-full" style="background:#FF5500"></span>
          <span class="w-1.5 h-1.5 rounded-full" style="background:#FF0000"></span>
          <span class="w-1.5 h-1.5 rounded-full" style="background:#A00000"></span>
          <span class="w-1.5 h-1.5 rounded-full" style="background:#990099"></span>
        </span>
        역사지진
      </span>
      -->
      <button onclick={() => (open = false)} title={t('범례 접기')} class="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer px-0.5">−</button>
    </div>
  {:else}
    <button
      onclick={() => (open = true)}
      title={t('진도 범례 펼치기')}
      class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">
      {t('진도 범례')}
    </button>
  {/if}
</div>
