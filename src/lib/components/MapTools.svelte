<script lang="ts">
  import type { Tab, IntensityDisplayMode, RealtimeDataType } from '../state.svelte';

  interface Props {
    activeTab: Tab;
    showWaveRings: boolean;
    intensityDisplayMode: IntensityDisplayMode;
    realtimeDataType: RealtimeDataType;
    onResetMapView: () => void;
    onToggleWaveRings: () => void;
    onSetIntensityDisplayMode: (mode: IntensityDisplayMode) => void;
    onSetRealtimeDataType: (type: RealtimeDataType) => void;
    onOpenTools: () => void;
  }

  let { activeTab, showWaveRings, intensityDisplayMode, realtimeDataType, onResetMapView, onToggleWaveRings, onSetIntensityDisplayMode, onSetRealtimeDataType, onOpenTools }: Props = $props();

  const iconBtn = 'w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 ';
  const opt = (active: boolean) =>
    'px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ' + (active
      ? 'bg-blue-600 text-white'
      : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800');
  const divider = 'w-px self-stretch bg-zinc-200 dark:bg-zinc-700 mx-0.5';
</script>

<div class="absolute top-14 left-3 z-20 flex items-stretch gap-0.5 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
  <button onclick={onResetMapView} title="전체 보기" class={iconBtn}>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
  </button>

  <button
    onclick={onToggleWaveRings}
    title={showWaveRings ? 'P/S파 숨기기' : 'P/S파 표시'}
    class={iconBtn + (showWaveRings ? 'bg-blue-600 text-white hover:bg-blue-600' : '')}>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" stroke-dasharray="2 2"/><circle cx="12" cy="12" r="4"/></svg>
  </button>

  <button onclick={onOpenTools} title="도구 (시뮬레이션 / 알림음 테스트)" class={iconBtn}>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  </button>

  {#if activeTab === 'realtime'}
    <div class={divider}></div>
    <button onclick={() => onSetRealtimeDataType('jma_s')} title="지표면 센서 (jma_s.gif)" class={opt(realtimeDataType === 'jma_s') + ' self-center'}>지표</button>
    <button onclick={() => onSetRealtimeDataType('jma_b')} title="지중/지하 센서 (jma_b.gif)" class={opt(realtimeDataType === 'jma_b') + ' self-center'}>지중</button>
  {:else if activeTab === 'earthquake'}
    <div class={divider}></div>
    <button onclick={() => onSetIntensityDisplayMode('areas')} title="지역별 면적 색상만" class={opt(intensityDisplayMode === 'areas') + ' self-center'}>지역</button>
    <button onclick={() => onSetIntensityDisplayMode('stations')} title="관측소 점 진도만" class={opt(intensityDisplayMode === 'stations') + ' self-center'}>관측소</button>
    <button onclick={() => onSetIntensityDisplayMode('both')} title="둘 다 표시" class={opt(intensityDisplayMode === 'both') + ' self-center'}>둘다</button>
  {/if}
</div>
