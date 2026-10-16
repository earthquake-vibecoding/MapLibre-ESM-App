<script lang="ts">
  import { soundService } from '../services/sound';
  import { notificationService } from '../services/notification.svelte';

  function testNotification() {
    if (notificationService.permission !== 'granted') {
      notificationService.requestPermission();
    } else {
      notificationService.sendNotification('🔔 [테스트] 브라우저 알림 테스트', {
        body: '흔들림 감지, 지진 정보 및 EEW(긴급지진속보) 수신 시 브라우저 알림이 정상적으로 전송됩니다.',
        tag: 'test-notification'
      });
    }
  }

  const shindoBtn = 'px-1.5 py-1 text-[11px] rounded-md font-bold transition-all cursor-pointer ';
</script>

<div class="border rounded-xl p-3 flex flex-col gap-2 w-[220px] border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
  <span class="text-xs font-bold flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    알림음 미리듣기
  </span>
  <button
    onclick={() => soundService.playShindoAudio()}
    class="w-full py-1.5 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
    신규 지진 알림음 듣기
  </button>
  <button
    onclick={testNotification}
    class="w-full py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all">
    🔔 브라우저 알림 테스트
  </button>
  <div class="grid grid-cols-3 gap-1">
    <button onclick={() => soundService.playDetectionSound(1)} class={shindoBtn + 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/30'}>진도 1</button>
    <button onclick={() => soundService.playDetectionSound(2)} class={shindoBtn + 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30'}>진도 2</button>
    <button onclick={() => soundService.playDetectionSound(3)} class={shindoBtn + 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/30'}>진도 3</button>
    <button onclick={() => soundService.playDetectionSound(4)} class={shindoBtn + 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30'}>진도 4</button>
    <button onclick={() => soundService.playDetectionSound('5-')} class={shindoBtn + 'bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30'}>진도 5-</button>
    <button onclick={() => soundService.playDetectionSound('5+')} class={shindoBtn + 'bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30'}>진도 5+</button>
    <button onclick={() => soundService.playDetectionSound('6-')} class={shindoBtn + 'bg-red-600/20 text-red-600 dark:text-red-400 hover:bg-red-600/30'}>진도 6-</button>
    <button onclick={() => soundService.playDetectionSound('6+')} class={shindoBtn + 'bg-red-700/20 text-red-700 dark:text-red-300 hover:bg-red-700/30'}>진도 6+</button>
    <button onclick={() => soundService.playDetectionSound(7)} class={shindoBtn + 'bg-purple-600/20 text-purple-600 dark:text-purple-400 hover:bg-purple-600/30'}>진도 7</button>
  </div>
</div>
