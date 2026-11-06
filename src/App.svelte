<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/app-controller';
  import { initApp, destroyApp } from './lib/app-init';
  import { ui } from './lib/state.svelte';
  import { p2pQuakeService } from './lib/services/p2p-quake.svelte';
  import { wolfxEewService } from './lib/services/wolfx-eew.svelte';
  import { notificationService } from './lib/services/notification.svelte';
  import { groupHistoryList } from './lib/quake/history-group';
  import { isActiveEEW } from './lib/quake/quake-utils';
  import { focusOverseasQuake } from './lib/focus';

  import TopBar from './lib/components/TopBar.svelte';
  import MapTools from './lib/components/MapTools.svelte';
  import ToolsModal from './lib/components/ToolsModal.svelte';
  import EewBanner from './lib/components/EewBanner.svelte';
  import QuakeDetailPanel from './lib/components/QuakeDetailPanel.svelte';
  import HistoryDrawer from './lib/components/HistoryDrawer.svelte';
  import OverseasPanel from './lib/components/OverseasPanel.svelte';
  import GifViewPanel from './lib/components/GifViewPanel.svelte';
  import Legend from './lib/components/Legend.svelte';
  import StationPanel from './lib/components/StationPanel.svelte';
  import { isPanelMode, initPanelMode, initPanelBridge, sendPanelSelect, togglePanelWindow, hasPanelBridge } from './lib/panel-mode';
  import { VIEW } from './lib/config';

  let mapEl: HTMLElement | undefined = $state();
  let showTools = $state(false);
  let panelOpen = $state(false);

  // 선택 관측소 → 패널 창 동기화 (지도 클릭/오버레이 닫기 모두, null 포함). 패널 창 자신은 이쪽으로 보내지 않음
  $effect(() => {
    if (!isPanelMode) sendPanelSelect(ui.stationPanelCode);
  });

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
    if (isPanelMode) {
      initPanelMode();
      return;
    }
    if (mapEl) initApp(mapEl);
    // 메인 창: 패널 창 개폐/플라이/선택 배선 (panel-mode.ts)
    initPanelBridge((open) => {
      panelOpen = open;
    });
    return () => destroyApp();
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if isPanelMode}
  <!-- 외부 미니 창: 패널만 렌더 -->
  <div class="w-screen h-screen overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 relative">
    <StationPanel mode="window" />
  </div>
{:else}
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
      stationPanelOpen={panelOpen}
      onToggleStationPanel={hasPanelBridge ? togglePanelWindow : undefined}
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
      onFlyToLog={(center) => app.mapCtl?.flyTo({ center, ...VIEW.stationFly })}
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

  {#if !ui.isCleanMode && ui.activeTab === 'overseas'}
    <OverseasPanel
      onFocusQuake={(q) => focusOverseasQuake(app.mapCtl, q)}
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
{/if}
