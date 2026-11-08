<script lang="ts">
  import { ui } from '../state.svelte';
  import { JMA_LEVELS } from '../quake/jma-utils';
  import { loadFavorites } from '../quake/station-favorites';
  import { KEYS } from '../config';
  import { t } from '../i18n/i18n';

  const RADII = [30, 50, 100, 200, 300];

  let favCount = $state(loadFavorites().length);

  function set(patch: Partial<typeof ui.areaFilter>): void {
    ui.areaFilter = { ...ui.areaFilter, ...patch };
    try {
      localStorage.setItem(KEYS.alertFilter, JSON.stringify(ui.areaFilter));
    } catch {
      // ignore
    }
    favCount = loadFavorites().length;
  }
</script>

<div class="flex flex-col gap-2">
  <label class="flex items-center gap-2 cursor-pointer text-sm">
    <input
      type="checkbox"
      checked={ui.areaFilter.enabled}
      onchange={(e) => set({ enabled: e.currentTarget.checked })}
      class="w-4 h-4 accent-blue-600 cursor-pointer" />
    <span class="font-bold">{t('관심 지역만 알림')}</span>
  </label>

  {#if ui.areaFilter.enabled}
    <div class="flex gap-2">
      <select
        value={ui.areaFilter.minScale}
        onchange={(e) => set({ minScale: Number(e.currentTarget.value) })}
        aria-label={t('최소 진도')}
        class="flex-1 px-2 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {#each JMA_LEVELS as lv (lv.scale)}
          <option value={lv.scale}>{t('{v} 이상', { v: t(lv.label) })}</option>
        {/each}
      </select>
      <select
        value={ui.areaFilter.radiusKm}
        onchange={(e) => set({ radiusKm: Number(e.currentTarget.value) })}
        aria-label={t('반경')}
        class="flex-1 px-2 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {#each RADII as r (r)}
          <option value={r}>{t('반경 {r}km', { r })}</option>
        {/each}
      </select>
    </div>
    <p class="text-[11px] leading-snug {favCount === 0 ? 'text-amber-500' : 'text-zinc-400'}">
      {#if favCount === 0}
        {t('★ 즐겨찾은 관측소가 없으면 필터 없이 전역 알림. 지도의 관측소를 클릭해 ★을 추가해라.')}
      {:else}
        {t('즐겨찾은 관측소 {n}곳 반경 내 진도 충족 시에만 소리·알림. EEW는 항상 통과.', { n: favCount })}
      {/if}
    </p>
  {/if}
</div>
