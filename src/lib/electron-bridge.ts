/** Electron preload 브릿지(preload.cjs) — 트레이 상태 보고. 브라우저에서는 noop */
declare global {
  interface Window {
    quakeBridge?: {
      setAlertStatus(active: boolean): void;
    };
  }
}

let lastAlert = false;

export function reportAlertStatus(active: boolean): void {
  if (typeof window === 'undefined' || active === lastAlert) return;
  lastAlert = active;
  window.quakeBridge?.setAlertStatus(active);
}
