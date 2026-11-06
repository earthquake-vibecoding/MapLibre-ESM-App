<script lang="ts">
  import type { P2PQuakeItem } from '../models';
  import { getJindoBadgeStyle, getTsunamiText, getJindoString } from '../quake/jma-utils';
  import type { StationLocation } from '../map/map-marker';

  interface Props {
    quake: P2PQuakeItem | null;
    stationMap: Map<string, any>;
    onFocusEpicenter: (item: P2PQuakeItem) => void;
    onFocusStation: (st: StationLocation) => void;
  }

  let { quake, stationMap, onFocusEpicenter, onFocusStation }: Props = $props();

  let showDetail = $state(false);
  let viewMode = $state<'stations' | 'areas'>('stations');
  function getStationInfo(pt: any) {
    if (!pt) return null;
    if (!stationMap || stationMap.size === 0) return null;
    const key = (pt.pref || '') + pt.addr;
    return stationMap.get(key) || stationMap.get(pt.addr) || null;
  }

  const getRawData = (item: P2PQuakeItem) => JSON.stringify(item, null, 2);
  const chip = 'bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700';
</script>

{#snippet shindoBadge(scale?: number)}
  {@const s = getJindoBadgeStyle(scale)}
  <div class={'flex flex-col items-center justify-center p-3 rounded-lg border-2 min-w-[76px] shrink-0 text-center ' + s.bg + ' ' + s.text + ' ' + s.border}>
    <span class="text-[10px] font-bold opacity-90 tracking-wider">최대진도</span>
    <span class="text-2xl font-black tracking-tight leading-none my-0.5">{s.label.replace('진도 ', '')}</span>
    <span class="text-[9px] opacity-75 font-medium">{s.label}</span>
  </div>
{/snippet}

{#if quake}
  {@const item = quake}
  <div class="absolute bottom-4 left-4 z-20 w-[calc(100%-2rem)] max-w-md pointer-events-auto">
    <div class="border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-lg shadow-lg p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden">

      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1.5 flex-1 min-w-0">
          <div class="text-xs font-mono tabular-nums text-zinc-400">{item.earthquake?.time || item.time}</div>

          <h3 class="font-bold text-lg sm:text-xl truncate text-zinc-900 dark:text-zinc-100">
            {item.earthquake?.hypocenter?.name || '진원지 정보 없음'}
          </h3>

          <div class="flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            <span class={chip}>
              규모 <strong class="text-rose-600 dark:text-rose-400 font-bold text-sm">M{item.earthquake?.hypocenter?.magnitude === -1 ? '불명' : item.earthquake?.hypocenter?.magnitude}</strong>
            </span>
            <span class={chip}>
              깊이 <strong class="text-zinc-800 dark:text-zinc-200 font-bold">{item.earthquake?.hypocenter?.depth === -1 ? '불명' : (item.earthquake?.hypocenter?.depth === 0 ? '매우 얕음' : item.earthquake?.hypocenter?.depth + 'km')}</strong>
            </span>
          </div>

          <div class="text-xs font-semibold">
            <span class={getTsunamiText(item.earthquake?.domesticTsunami).colorClass}>
              {getTsunamiText(item.earthquake?.domesticTsunami).text}
            </span>
          </div>
        </div>

        {@render shindoBadge(item.earthquake?.maxScale)}
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 text-xs gap-2 flex-wrap">
        <span class="text-zinc-400 text-[11px]">출처: JMA / P2PQuake</span>
        <div class="flex items-center gap-2">
          <button
            onclick={() => (showDetail = !showDetail)}
            class="px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer border border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            {showDetail ? '접기' : '자세히'}
          </button>
          <button
            onclick={() => onFocusEpicenter(item)}
            class="px-3 py-1.5 rounded-md font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer">
            진앙지 이동
          </button>
        </div>
      </div>

      {#if showDetail}
        <div class="p-3 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 max-h-[42vh] overflow-y-auto custom-scrollbar flex flex-col gap-3">

          <div class="flex items-center p-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-xs font-bold gap-0.5">
            <button
              onclick={() => (viewMode = 'stations')}
              class={'flex-1 py-1.5 px-2.5 rounded transition-colors cursor-pointer ' + (viewMode === 'stations' ? 'bg-white text-blue-600 dark:bg-zinc-700 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200')}>
              관측소별 ({item.points?.length || 0})
            </button>
            <button
              onclick={() => (viewMode = 'areas')}
              class={'flex-1 py-1.5 px-2.5 rounded transition-colors cursor-pointer ' + (viewMode === 'areas' ? 'bg-white text-blue-600 dark:bg-zinc-700 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200')}>
              지역별 ({item.areas?.length || 0})
            </button>
          </div>

          {#if viewMode === 'stations'}
            {#if item.points && item.points.length > 0}
              <div class="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {#each item.points as pt, i ((pt.pref || '') + pt.addr + i)}
                  {@const st = getStationInfo(pt)}
                  <div class="flex flex-col gap-1 py-2">
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        <span class="text-xs font-bold text-zinc-400 shrink-0">{pt.pref}</span>
                        <span class="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{pt.addr}</span>
                        {#if pt.isArea}
                          <span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 shrink-0">구역</span>
                        {/if}
                      </div>
                      <div class={'px-2 py-0.5 rounded text-xs font-bold shrink-0 ' + getJindoBadgeStyle(pt.scale).bg + ' ' + getJindoBadgeStyle(pt.scale).text}>
                        {getJindoString(pt.scale)}
                      </div>
                    </div>

                    {#if st}
                      <div class="flex items-center justify-between text-[11px] text-zinc-400 gap-2">
                        <span class="font-mono text-[10px] truncate">{st.affi || '기상청'} · {st.lat?.toFixed(2)}°, {st.lon?.toFixed(2)}°</span>
                        <button
                          onclick={() => onFocusStation({ lat: st.lat, lon: st.lon, name: pt.addr || '', pref: pt.pref, scale: pt.scale })}
                          class="px-2 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 text-[10px] font-bold cursor-pointer transition-colors shrink-0">
                          위치 보기
                        </button>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center py-6 text-xs text-zinc-400 font-semibold">
                관측소 지점(points) 정보가 없습니다.
              </div>
            {/if}
          {/if}

          {#if viewMode === 'areas'}
            {#if item.areas && item.areas.length > 0}
              <div class="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {#each item.areas as area, i ((area.name ?? '') + i)}
                  <div class="flex items-center justify-between py-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-xs font-bold text-zinc-400 shrink-0">{area.prefName}</span>
                      <span class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{area.name}</span>
                    </div>
                    <div class={'px-2 py-1 rounded text-xs font-bold shrink-0 ' + getJindoBadgeStyle(area.scale || area.scaleFrom).bg + ' ' + getJindoBadgeStyle(area.scale || area.scaleFrom).text}>
                      {getJindoString(area.scale || area.scaleFrom)}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-center py-6 text-xs text-zinc-400 font-semibold">
                지역별(areas) 진도 정보가 없습니다.
              </div>
            {/if}
          {/if}

          <details>
            <summary class="text-[11px] font-bold cursor-pointer text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 outline-none focus-visible:outline-2 focus-visible:outline-blue-600 rounded">원본 JSON</summary>
            <div class="mt-2 text-[10px] sm:text-xs font-mono overflow-x-auto p-2 bg-zinc-100 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
              <pre><code>{getRawData(item)}</code></pre>
            </div>
          </details>

        </div>
      {/if}

    </div>
  </div>
{/if}
