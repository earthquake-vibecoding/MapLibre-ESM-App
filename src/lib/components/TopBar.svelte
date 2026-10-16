<script lang="ts">
  import type { Tab } from '../state.svelte';

  interface Props {
    activeTab: Tab;
    historyCount: number;
    historyOpen: boolean;
    latestTime: string;
    isDarkMode: boolean;
    notificationPermission: NotificationPermission;
    notificationEnabled: boolean;
    onTabChange: (tab: Tab) => void;
    onToggleHistory: () => void;
    onToggleNotification: () => void;
    onToggleDarkMode: () => void;
  }

  let { activeTab, historyCount, historyOpen, latestTime, isDarkMode, notificationPermission, notificationEnabled, onTabChange, onToggleHistory, onToggleNotification, onToggleDarkMode }: Props = $props();

  const tabDefs: { id: Tab; label: string; activeCls: string; experimental?: boolean }[] = [
    { id: 'earthquake', label: '지진', activeCls: 'bg-rose-600 text-white shadow-md shadow-rose-600/30' },
    { id: 'est_shindo_region', label: '예상진도', activeCls: 'bg-amber-600 text-white shadow-md shadow-amber-600/30', experimental: true },
    { id: 'realtime', label: '실시간', activeCls: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' }
  ];

  const idleTab = 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10';
  const sideBtn = 'p-2 rounded-lg transition-all cursor-pointer ';
</script>

<div class="absolute top-0 inset-x-0 z-30 h-12 px-2 sm:px-3 flex items-center gap-2 bg-zinc-950/80 backdrop-blur-md border-b border-white/10 text-zinc-100 shadow-lg">
  <!-- 좌측: 수신 상태 + 최신 시각 -->
  <div class="flex items-center gap-2 min-w-0 shrink-0">
    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0"></span>
    <span class="font-mono text-xs sm:text-sm text-zinc-300 truncate hidden sm:inline">
      {latestTime || '시간 로딩 중...'}
    </span>
  </div>

  <!-- 중앙: 탭 -->
  <div class="flex-1 flex items-center justify-center gap-1 min-w-0">
    {#each tabDefs as t (t.id)}
      <button
        onclick={() => onTabChange(t.id)}
        class={'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ' + (activeTab === t.id ? t.activeCls : idleTab)}>
        <span>{t.label}</span>
        {#if t.experimental}
          <span class="px-1 py-0.2 bg-amber-400/20 text-amber-300 text-[10px] rounded font-mono">실험</span>
        {/if}
      </button>
    {/each}
    <button
      onclick={onToggleHistory}
      class={'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ' + (historyOpen ? 'bg-zinc-100 text-zinc-900 shadow-md' : idleTab)}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      <span>이력 ({historyCount})</span>
    </button>
  </div>

  <!-- 우측: 알림 + 테마 -->
  <div class="flex items-center gap-1 shrink-0">
    <button
      onclick={onToggleNotification}
      title={notificationPermission === 'granted'
        ? (notificationEnabled ? '브라우저 알림 ON (클릭 시 OFF)' : '브라우저 알림 OFF (클릭 시 ON)')
        : '브라우저 알림 권한 허용 요청'}
      class={sideBtn + (notificationPermission === 'granted' && notificationEnabled
        ? 'text-emerald-400 hover:bg-white/10'
        : notificationPermission === 'denied'
          ? 'text-zinc-600 cursor-not-allowed'
          : 'text-amber-400 animate-pulse hover:bg-white/10')}>
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        {#if notificationPermission === 'granted' && notificationEnabled}
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        {:else}
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>
        {/if}
      </svg>
    </button>
    <button
      onclick={onToggleDarkMode}
      title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
      class={sideBtn + 'text-zinc-300 hover:bg-white/10'}>
      {#if isDarkMode}
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      {/if}
    </button>
  </div>
</div>
