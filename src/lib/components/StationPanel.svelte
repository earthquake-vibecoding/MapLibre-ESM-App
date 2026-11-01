<script lang="ts">
  import { ui } from '../state.svelte';
  import { app } from '../app-controller';
  import { getIntensityColor, getJindoString, jindoToScale } from '../jma-utils';
  import { loadFavorites, saveFavorites } from '../station-favorites';

  // 진도→gal 환산 (JMA 계측진도 I ↔ PGA 역관계): PGA[gal] ≈ 10^((I+0.9)/2.95) — 참고치
  const jindoToGal = (j: number): number => Math.round(Math.pow(10, (j + 0.9) / 2.95));

  interface HistPoint { t: number; j: number | null }

  let query = $state('');
  let snap = $state<{ jindo: number | null; deltaSum: number; event: any; hist: HistPoint[] } | null>(null);
  let favs = $state<string[]>(loadFavorites());

  function toggleFav(): void {
    if (!ui.stationPanelCode) return;
    favs = favs.includes(ui.stationPanelCode)
      ? favs.filter((c) => c !== ui.stationPanelCode)
      : [...favs, ui.stationPanelCode];
    saveFavorites(favs);
  }

  const stn = $derived(app.stationsState.get(ui.stationPanelCode ?? ''));
  const isFav = $derived(!!ui.stationPanelCode && favs.includes(ui.stationPanelCode));
  const scale = $derived(snap?.jindo != null ? jindoToScale(snap.jindo) : 0);
  const badgeColor = $derived(snap?.jindo != null && snap.jindo >= 0.5 ? getIntensityColor(scale) : '#71717a');
  const gal = $derived(snap?.jindo != null ? jindoToGal(snap.jindo) : null);

  // 검색: 이름/지역/코드 부분일치 (stationsState는 비반응성 Map — 열 때 1회 스냅)
  let allStations = $state<any[]>([]);
  $effect(() => {
    allStations = Array.from(app.stationsState.values());
  });
  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: any[] = [];
    for (const s of allStations) {
      if ((s.name || '').toLowerCase().includes(q) || (s.region || '').includes(q) || String(s.code || '').includes(q)) {
        out.push(s);
        if (out.length >= 20) break;
      }
    }
    return out;
  });
  const favStations = $derived(favs.map((c) => allStations.find((s) => s.code === c)).filter(Boolean));

  function tick(): void {
    snap = stn ? { jindo: stn.jindo, deltaSum: stn.deltaSum, event: stn.event, hist: [...stn.history] } : null;
  }
  $effect(() => {
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  });

  function pick(s: any): void {
    ui.stationPanelCode = s.code;
    query = '';
    app.mapCtl?.flyTo({ center: s.lonlat, zoom: 7, duration: 800 });
  }

  // 스파크라인: 세로 30px 영역, 진도 [-1, hi] 자동 스케일
  const sparkPoints = $derived.by(() => {
    const hist = snap?.hist ?? [];
    const pts = hist.filter((p) => p.j != null) as { t: number; j: number }[];
    if (pts.length < 2) return null;
    const hi = Math.max(1.5, ...pts.map((p) => p.j)) + 0.5;
    const lo = -1;
    const y = (v: number) => 32 - ((v - lo) / (hi - lo)) * 28;
    const x = (i: number) => (i / (pts.length - 1)) * 100;
    return {
      line: pts.map((p, i) => `${x(i).toFixed(1)},${y(p.j).toFixed(1)}`).join(' '),
      last: pts[pts.length - 1],
      lastX: x(pts.length - 1),
      lastY: y(pts[pts.length - 1].j),
      zeroY: y(0)
    };
  });
</script>

<div class="absolute bottom-14 right-3 z-30 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 flex flex-col animate-overlay-in">
  <!-- 헤더 -->
  <div class="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
    <span class="font-bold text-sm truncate flex-1">📍 {stn?.region || ''} {stn?.name || '관측소'}</span>
    <button
      type="button"
      onclick={toggleFav}
      aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      class="p-1 rounded-md cursor-pointer transition-colors {isFav ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-300 hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-400'}">
      {'★'}
    </button>
    <button
      type="button"
      onclick={() => (ui.stationPanelCode = null)}
      aria-label="관측소 패널 닫기"
      class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm font-bold w-6">✕</button>
  </div>

  <!-- 현재 상태 -->
  <div class="px-3 py-2.5 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700">
    <span class="rounded px-2 py-1 text-xs font-black text-white" style="background-color: {badgeColor}">
      진도 {snap?.jindo != null && snap.jindo >= 0.5 ? getJindoString(snap.jindo) : '0'}
    </span>
    {#if gal !== null}
      <span class="text-[11px] text-zinc-500 dark:text-zinc-400">≈ {gal} gal</span>
    {/if}
    <span class="ml-auto flex items-baseline gap-1">
      <span class="text-[10px] text-zinc-400">상승률(10s)</span>
      <strong class="font-mono text-sm {snap && snap.deltaSum > 1.2 ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-300'}">
        {snap ? (snap.deltaSum >= 0 ? '+' : '') + snap.deltaSum.toFixed(2) : '—'}
      </strong>
    </span>
  </div>

  {#if snap?.event}
    <div class="px-3 py-1.5 text-[11px] font-bold text-red-500 bg-red-50 dark:bg-red-950/40 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
      감지중 {Math.max(0, Math.floor((Date.now() - snap.event.startTime) / 1000))}s
    </div>
  {/if}

  <!-- 스파크라인 -->
  <div class="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
    <div class="text-[10px] font-bold text-zinc-400 mb-1">최근 60초 계측진도</div>
    {#if sparkPoints}
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" class="w-full h-20 block rounded bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800">
        <line x1="0" y1={sparkPoints.zeroY} x2="100" y2={sparkPoints.zeroY} stroke="currentColor" class="text-zinc-200 dark:text-zinc-700" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3" />
        <polyline points={sparkPoints.line} fill="none" stroke={badgeColor} stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        <circle cx={sparkPoints.lastX} cy={sparkPoints.lastY} r="2.5" fill={badgeColor} vector-effect="non-scaling-stroke" />
      </svg>
    {:else}
      <div class="h-20 flex items-center justify-center text-[11px] text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 rounded">
        {snap ? '데이터 수집 중…' : '관측소 데이터 없음'}
      </div>
    {/if}
  </div>

  <!-- 즐겨찾기 -->
  {#if favStations.length > 0}
    <div class="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 flex flex-wrap gap-1">
      {#each favStations as f (f.code)}
        <button
          type="button"
          onclick={() => pick(f)}
          class="px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors {f.code === ui.stationPanelCode
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}">
          {f.name}
        </button>
      {/each}
    </div>
  {/if}

  <!-- 검색 -->
  <div class="px-3 py-2">
    <input
      bind:value={query}
      placeholder="관측소 검색 (이름/지역)"
      class="w-full px-2.5 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-zinc-800 dark:text-zinc-100" />
    {#if query.trim()}
      <ul class="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar rounded-md border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
        {#each results as s (s.code)}
          <li>
            <button
              type="button"
              onclick={() => pick(s)}
              class="w-full text-left px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between gap-2">
              <span class="truncate font-bold">{s.name}</span>
              <span class="text-[10px] text-zinc-400 truncate">{s.region}</span>
            </button>
          </li>
        {:else}
          <li class="px-2.5 py-2 text-[11px] text-zinc-400">검색 결과 없음</li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
