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

  const tabDefs: { id: Tab; label: string; dot: string }[] = [
    { id: 'earthquake', label: '지진', dot: 'bg-rose-500' },
    { id: 'realtime', label: '실시간', dot: 'bg-indigo-500' },
    { id: 'overseas', label: '해외', dot: 'bg-sky-500' }
  ];

  const seg = 'px-3 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ';
  const segIdle = 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800';
  const segOn = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
  const sideBtn = 'p-2 rounded-md transition-colors cursor-pointer text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800';
</script>

<div class="absolute top-0 inset-x-0 z-30 h-12 px-3 flex items-center gap-3 bg-white border-b border-zinc-200 text-zinc-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
  <!-- 좌측: 수신 상태 + 최신 시각 -->
  <div class="flex items-center gap-2 min-w-0 shrink-0">
    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
    <span class="font-mono text-xs sm:text-sm tabular-nums text-zinc-500 dark:text-zinc-400 truncate hidden sm:inline">
      {latestTime || '시간 로딩 중...'}
    </span>
  </div>

  <!-- 중앙: 세그먼트 탭 -->
  <div class="flex-1 flex items-center justify-center min-w-0">
    <div class="flex items-stretch rounded-md border border-zinc-200 divide-x divide-zinc-200 overflow-hidden dark:border-zinc-700 dark:divide-zinc-700">
      {#each tabDefs as t (t.id)}
        <button
          onclick={() => onTabChange(t.id)}
          class={seg + (activeTab === t.id ? segOn : segIdle)}>
          <span class={'w-1.5 h-1.5 rounded-full shrink-0 ' + t.dot}></span>
          <span>{t.label}</span>
        </button>
      {/each}
      <button
        onclick={onToggleHistory}
        class={seg + (historyOpen ? segOn : segIdle)}>
        <span>이력 ({historyCount})</span>
      </button>
    </div>
  </div>

  <!-- 우측: 알림 + 테마 -->
  <div class="flex items-center gap-0.5 shrink-0">
    <button
      onclick={onToggleNotification}
      aria-label="브라우저 알림 설정"
      title={notificationPermission === 'granted'
        ? (notificationEnabled ? '브라우저 알림 ON (클릭 시 OFF)' : '브라우저 알림 OFF (클릭 시 ON)')
        : '브라우저 알림 권한 허용 요청'}
      class={sideBtn + (notificationPermission === 'granted' && notificationEnabled
        ? ' text-emerald-600 dark:text-emerald-400'
        : notificationPermission === 'denied'
          ? ' text-zinc-400 cursor-not-allowed'
          : ' text-amber-500 animate-pulse')}>
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
      aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
      class={sideBtn}>
      {#if isDarkMode}
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      {/if}
    </button>
  </div>
</div>
