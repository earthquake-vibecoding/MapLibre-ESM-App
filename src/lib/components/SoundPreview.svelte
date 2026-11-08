<script lang="ts">
  import { soundService } from '../services/sound';
  import { notificationService } from '../services/notification.svelte';
  import { t } from '../i18n/i18n';

  function testNotification() {
    if (notificationService.permission !== 'granted') {
      notificationService.requestPermission();
    } else {
      notificationService.sendNotification(t('[테스트] 브라우저 알림 테스트'), {
        body: t('흔들림 감지, 지진 정보 및 EEW(긴급지진속보) 수신 시 브라우저 알림이 정상적으로 전송됩니다.'),
        tag: 'test-notification'
      });
    }
  }

  const shindoBtn = 'px-1.5 py-1 text-[11px] rounded-md font-bold transition-colors cursor-pointer border ';
</script>

<div class="border rounded-lg p-3 flex flex-col gap-2 w-[220px] border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
  <span class="text-xs font-bold text-zinc-600 dark:text-zinc-300">{t('알림음 미리듣기')}</span>
  <button
    onclick={() => soundService.playShindoAudio()}
    class="w-full py-1.5 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-xs cursor-pointer transition-colors">
    {t('신규 지진 알림음 듣기')}
  </button>
  <button
    onclick={testNotification}
    class="w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-[11px] cursor-pointer transition-colors">
    {t('브라우저 알림 테스트')}
  </button>
  <div class="grid grid-cols-3 gap-1">
    <button onclick={() => soundService.playDetectionSound(1)} class={shindoBtn + 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400'}>{t('진도 1')}</button>
    <button onclick={() => soundService.playDetectionSound(2)} class={shindoBtn + 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400'}>{t('진도 2')}</button>
    <button onclick={() => soundService.playDetectionSound(3)} class={shindoBtn + 'bg-cyan-50 border-cyan-300 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950 dark:border-cyan-800 dark:text-cyan-400'}>{t('진도 3')}</button>
    <button onclick={() => soundService.playDetectionSound(4)} class={shindoBtn + 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400'}>{t('진도 4')}</button>
    <button onclick={() => soundService.playDetectionSound('5-')} class={shindoBtn + 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400'}>{t('진도 5弱')}</button>
    <button onclick={() => soundService.playDetectionSound('5+')} class={shindoBtn + 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-400'}>{t('진도 5強')}</button>
    <button onclick={() => soundService.playDetectionSound('6-')} class={shindoBtn + 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:border-red-800 dark:text-red-400'}>{t('진도 6弱')}</button>
    <button onclick={() => soundService.playDetectionSound('6+')} class={shindoBtn + 'bg-red-100 border-red-400 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:border-red-700 dark:text-red-300'}>{t('진도 6強')}</button>
    <button onclick={() => soundService.playDetectionSound(7)} class={shindoBtn + 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400'}>{t('진도 7')}</button>
  </div>
</div>
