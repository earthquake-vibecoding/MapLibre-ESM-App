import { ui } from '../state.svelte';
import { app } from '../app-controller';
import { TIMING } from '../config';

let timer: ReturnType<typeof setInterval> | null = null;

/** 외부 패널 창 개폐에 맞춰 선택 관측소 스냅샷 릴레이 시작/중단 (메인 창에서만 호출) */
export function setPanelRelay(open: boolean): void {
  if (open && !timer) {
    relayTick();
    timer = setInterval(relayTick, TIMING.relayMs);
  } else if (!open && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function relayTick(): void {
  const code = ui.stationPanelCode;
  if (!code) return;
  const s = app.stationsState.get(code);
  if (!s) return;
  window.quakeBridge?.panel?.relay({
    code,
    jindo: s.jindo,
    deltaSum: s.deltaSum,
    event: s.event,
    expireTime: s.expireTime,
    history: s.history,
  });
}
