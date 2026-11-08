<script lang="ts">
  // import SoundPreview from './SoundPreview.svelte'; // 미리듣기 숨김
  import AlertFilterSettings from './AlertFilterSettings.svelte';
  import LanguageSettings from './LanguageSettings.svelte';
  import { getDetectionLog, clearDetectionLog } from '../detect/detection-log';
  import { getIntensityColor, getJindoString, jindoToScale } from '../quake/jma-utils';
  import { t } from '../i18n/i18n';

  interface Props {
    hasDetectedGrids: boolean;
    onTriggerEewSimulation: () => void;
    onFocusDetectedGrid: () => void;
    onFlyToLog: (center: [number, number]) => void;
    onClose: () => void;
  }

  let { hasDetectedGrids, onTriggerEewSimulation, onFocusDetectedGrid, onFlyToLog, onClose }: Props = $props();

  // 모달을 열 때마다 새로 읽음 — 기록은 localStorage 최신순
  let log = $state(getDetectionLog());

  function fmtTime(ts: number): string {
    return new Date(ts).toTimeString().slice(0, 8);
  }

  let dialogEl: HTMLElement | undefined = $state();

  $effect(() => {
    dialogEl?.focus();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
  <div
    bind:this={dialogEl}
    class="w-full max-w-sm rounded-lg shadow-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 p-5 flex flex-col gap-4 animate-modal-in focus:outline-none"
    role="dialog" aria-label={t('도구')} tabindex="-1">
    <div class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-700">
      <h3 class="font-bold text-base">{t('도구')}</h3>
      <button
        onclick={onClose}
        class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
        {t('닫기')}
      </button>
    </div>

    <div class="flex flex-col gap-2">
      <!-- P/S 모의 시뮬 숨김
      <button
        onclick={onTriggerEewSimulation}
        class="w-full px-3 py-2.5 rounded-md font-bold text-sm flex items-center justify-center cursor-pointer transition-colors bg-amber-100 border border-amber-400 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900">
        {t('P/S파 모의 시뮬레이션')}
      </button>
      -->
      <button
        onclick={onFocusDetectedGrid}
        class={'w-full px-3 py-2.5 rounded-md font-bold text-sm flex items-center justify-center cursor-pointer transition-colors border ' + (hasDetectedGrids
          ? 'bg-emerald-600 border-emerald-600 text-white'
          : 'bg-zinc-100 border-zinc-300 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700')}>
        {t('감지 격자로 이동')}
      </button>
    </div>

    <div class="pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <LanguageSettings />
    </div>

    <div class="pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs font-bold">{t('감지 기록')}</span>
        {#if log.length > 0}
          <button
            onclick={() => { clearDetectionLog(); log = []; }}
            class="text-[10px] text-zinc-400 hover:text-red-500 cursor-pointer">{t('지우기')}</button>
        {/if}
      </div>
      {#if log.length === 0}
        <p class="text-[11px] text-zinc-400">{t('아직 기록된 감지가 없습니다')}</p>
      {:else}
        <ul class="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1">
          {#each log as e (e.id)}
            <li>
              <button
                type="button"
                onclick={() => onFlyToLog(e.center)}
                title={t('감지 중심으로 지도 이동')}
                class="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-2">
                <span class="font-mono text-zinc-500 dark:text-zinc-400">{fmtTime(e.start)}</span>
                <span class="font-bold" style="color: {getIntensityColor(jindoToScale(e.maxJindo))}">
                  {getJindoString(jindoToScale(e.maxJindo))}
                </span>
                <span class="ml-auto text-[10px] text-zinc-400">{t('{n}개소', { n: e.count })} · {Math.max(1, Math.round((e.end - e.start) / 1000))}s</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <AlertFilterSettings />
    </div>

    <!-- 미리듣기 숨김
    <div class="pt-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-center">
      <SoundPreview />
    </div>
    -->
  </div>
</div>
