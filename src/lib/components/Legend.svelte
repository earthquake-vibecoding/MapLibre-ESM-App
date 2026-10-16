<script lang="ts">
  let open = $state(true);

  const entries: { c: string; l: string; span?: boolean }[] = [
    { c: '#990099', l: '진도 7' },
    { c: '#A00000', l: '진도 6강' },
    { c: '#FF0000', l: '진도 6약' },
    { c: '#FF5500', l: '진도 5강' },
    { c: '#FF9900', l: '진도 5약' },
    { c: '#FFE600', l: '진도 4' },
    { c: '#00BFFF', l: '진도 3' },
    { c: '#0055FF', l: '진도 2' },
    { c: '#7F8C8D', l: '진도 1', span: true }
  ];
</script>

<div class="absolute bottom-4 right-4 z-20 hidden md:flex flex-col items-end gap-1.5 text-xs">
  {#if open}
    <div class="flex-col gap-1.5 p-3 rounded-xl backdrop-blur-md border border-white/10 bg-zinc-950/85 text-zinc-100 shadow-2xl animate-overlay-in">
      <div class="font-extrabold text-[11px] text-zinc-300 pb-1.5 border-b border-white/10 flex items-center justify-between gap-3">
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          진도 범례 (JMA)
        </span>
        <button onclick={() => (open = false)} title="범례 접기" class="text-zinc-500 hover:text-zinc-200 cursor-pointer px-1">−</button>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 font-bold pt-1">
        {#each entries as e (e.l)}
          <div class={'flex items-center gap-1.5 ' + (e.span ? 'col-span-2' : '')}>
            <span class="w-3.5 h-3.5 rounded-md border border-white/20 shadow-sm" style={'background:' + e.c}></span>
            <span>{e.l}</span>
          </div>
        {/each}
      </div>
      <div class="text-[10px] text-zinc-500 font-mono text-right pt-1 border-t border-white/10">P2PQuake</div>
    </div>
  {:else}
    <button
      onclick={() => (open = true)}
      title="진도 범례 펼치기"
      class="px-2.5 py-1.5 rounded-xl backdrop-blur-md border border-white/10 bg-zinc-950/85 text-zinc-300 font-bold shadow-lg hover:text-white cursor-pointer">
      범례
    </button>
  {/if}
</div>
