<script lang="ts">
  import { ui, type Locale } from '../state.svelte';
  import { KEYS } from '../config';

  // 라벨은 3언어를 모두 나열 — 어떤 언어에서도 자기 언어로 보이는 국제 표준 표기
  const LANGS: { id: Locale; label: string }[] = [
    { id: 'ko', label: '한국어' },
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' }
  ];

  function setLocale(l: Locale): void {
    ui.locale = l;
    try {
      localStorage.setItem(KEYS.locale, l);
    } catch {
      // ignore
    }
  }

  const seg = 'flex-1 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ';
</script>

<div class="flex flex-col gap-2">
  <span class="text-xs font-bold">언어 / Language / 言語</span>
  <div class="flex items-stretch rounded-md border border-zinc-200 divide-x divide-zinc-200 overflow-hidden dark:border-zinc-700">
    {#each LANGS as l (l.id)}
      <button
        onclick={() => setLocale(l.id)}
        aria-label={l.label}
        class={seg + (ui.locale === l.id
          ? 'bg-blue-600 text-white'
          : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800')}>
        {l.label}
      </button>
    {/each}
  </div>
</div>
