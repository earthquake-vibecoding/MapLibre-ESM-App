<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/app-controller';
  import { initApp, destroyApp } from './lib/app-init';
  import { ui } from './lib/state.svelte';
  import { p2pQuakeService } from './lib/services/p2p-quake.svelte';
  import { wolfxEewService } from './lib/services/wolfx-eew.svelte';
  import { notificationService } from './lib/services/notification.svelte';
  import { groupHistoryList } from './lib/history-group';
  import { isActiveEEW } from './lib/quake-utils';

  import TopBar from './lib/components/TopBar.svelte';
  import MapTools from './lib/components/MapTools.svelte';
  import ToolsModal from './lib/components/ToolsModal.svelte';
  import EewBanner from './lib/components/EewBanner.svelte';
  import QuakeDetailPanel from './lib/components/QuakeDetailPanel.svelte';
  import HistoryDrawer from './lib/components/HistoryDrawer.svelte';
  import GifViewPanel from './lib/components/GifViewPanel.svelte';
  import Legend from './lib/components/Legend.svelte';
  import StationPanel from './lib/components/StationPanel.svelte';

  let mapEl: HTMLElement | undefined = $state();
  let showTools = $state(false);

  const processedHistoryList = $derived(groupHistoryList(p2pQuakeService.p2pHistoryList, ui.groupUnknown));
  const showLegend = $derived(ui.activeTab !== 'realtime');

  function onToggleGroup(key: string, event: Event) {
    event.stopPropagation();
    ui.expandedGroupKeys[key] = !ui.expandedGroupKeys[key];
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && ui.isCleanMode) app.exitCleanMode();
  }

  onMount(() => {
    if (mapEl) initApp(mapEl);
    return () => destroyApp();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="relative w-full h-screen overflow-hidden bg-slate-50 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-300">
  <div bind:this={mapEl} class="w-full h-full"></div>

  {#if !ui.isCleanMode}
    <TopBar
      activeTab={ui.activeTab}
      historyCount={p2pQuakeService.p2pHistoryList.length}
      historyOpen={ui.isHistoryOpen}
      latestTime={ui.latestTime}
      isDarkMode={ui.isDarkMode}
      notificationPermission={notificationService.permission}
      notificationEnabled={notificationService.isEnabled}
      onTabChange={(t) => app.setTab(t)}
      onToggleHistory={() => (ui.isHistoryOpen = !ui.isHistoryOpen)}
      onToggleNotification={() => notificationService.toggleEnabled()}
      onToggleDarkMode={() => app.toggleDarkMode()}
    />

    <MapTools
      activeTab={ui.activeTab}
      showWaveRings={ui.showWaveRings}
      intensityDisplayMode={ui.intensityDisplayMode}
      realtimeDataType={ui.realtimeDataType}
      onResetMapView={() => app.resetMapView()}
      onToggleWaveRings={() => app.toggleWaveRings()}
      onSetIntensityDisplayMode={(m) => app.setIntensityDisplayMode(m)}
      onSetRealtimeDataType={(t) => app.setRealtimeDataType(t)}
      onOpenTools={() => (showTools = true)}
    />

    {#if showLegend}
      <Legend />
    {/if}
  {/if}

  {#if showTools && !ui.isCleanMode}
    <ToolsModal
      hasDetectedGrids={ui.hasDetectedGrids}
      onTriggerEewSimulation={() => app.triggerEewSimulation()}
      onFocusDetectedGrid={() => app.focusOnDetectedGrid()}
      onClose={() => (showTools = false)}
    />
  {/if}

  <!-- EEW 배너는 클린 모드에서도 표시 (안전) -->
  {#if wolfxEewService.eewData && isActiveEEW(wolfxEewService.eewData) && !wolfxEewService.isEewDismissed}
    <EewBanner
      eew={wolfxEewService.eewData}
      onDismiss={() => (wolfxEewService.isEewDismissed = true)}
      onFocusEew={() => app.focusOnEew()}
      onFocusGrid={() => app.focusOnDetectedGrid()}
    />
  {/if}

  {#if !ui.isCleanMode && ui.activeTab === 'earthquake'}
    <QuakeDetailPanel
      quake={p2pQuakeService.selectedQuake}
      stationMap={ui.stationMap}
      onFocusEpicenter={(item) => app.focusEpicenter(item)}
      onFocusStation={(st) => app.onFocusStation(st)}
    />
  {/if}

  {#if !ui.isCleanMode && ui.isHistoryOpen}
    <HistoryDrawer
      historyList={p2pQuakeService.p2pHistoryList}
      processedList={processedHistoryList}
      selectedQuake={p2pQuakeService.selectedQuake}
      groupUnknown={ui.groupUnknown}
      expandedGroupKeys={ui.expandedGroupKeys}
      onSelectQuake={(item) => app.selectQuakeFromHistory(item)}
      onToggleGroupUnknown={() => (ui.groupUnknown = !ui.groupUnknown)}
      onToggleGroup={onToggleGroup}
      onCloseDrawer={() => (ui.isHistoryOpen = false)}
      onLoadMore={() => app.loadMoreHistory()}
    />
  {/if}

  {#if !ui.isCleanMode && ui.activeTab === 'realtime'}
    <GifViewPanel
      currentGifUrl={ui.currentGifUrl}
      acmapGifUrl={ui.acmapGifUrl}
      estshindoGifUrl={ui.estshindoGifUrl}
      isGifExpanded={ui.isGifExpanded}
      eew={wolfxEewService.eewData}
      onToggleGifExpanded={() => (ui.isGifExpanded = !ui.isGifExpanded)}
    />
  {/if}

  {#if !ui.isCleanMode && ui.stationPanelCode}
    <StationPanel />
  {/if}

  {#if ui.isCleanMode}
    <button
      onclick={() => app.exitCleanMode()}
      title="전체 지도 모드 종료"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs font-bold hover:text-white hover:bg-zinc-800 cursor-pointer animate-overlay-in">
      전체 지도 보기 중 — 클릭 또는 ESC로 복귀
    </button>
  {:else if ui.hasDetectedGrids}
    <button
      onclick={() => app.focusOnDetectedGrid()}
      title="감지된 흔들림 격자로 이동"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm cursor-pointer transition-colors bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 animate-pulse animate-overlay-in">
      흔들림 감지 — 격자로 이동
    </button>
  {/if}
</div>
