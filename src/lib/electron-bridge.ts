/** 메인 창 → 패널 창으로 릴레이되는 관측소 스냅샷 */
export interface PanelSnapshot {
  code: string;
  jindo: number | null;
  deltaSum: number;
  event: any;
  expireTime: number | null;
  history: { t: number; j: number | null }[];
}

/** Electron preload 브릿지(preload.cjs) — 트레이 상태 보고 + 외부 패널 릴레이. 브라우저에서는 noop */
declare global {
  interface Window {
    quakeBridge?: {
      setAlertStatus(active: boolean): void;
      panel?: {
        isOpen(): Promise<boolean>;
        toggle(): void;
        close(): void;
        select(code: string | null): void;
        flyTo(lonlat: [number, number]): void;
        relay(data: PanelSnapshot): void;
        onState(cb: (open: boolean) => void): void;
        onData(cb: (d: PanelSnapshot) => void): void;
        onSelect(cb: (code: string | null) => void): void;
        onFlyTo(cb: (lonlat: [number, number]) => void): void;
      };
    };
  }
}

let lastAlert = false;

export function reportAlertStatus(active: boolean): void {
  if (typeof window === 'undefined' || active === lastAlert) return;
  lastAlert = active;
  window.quakeBridge?.setAlertStatus(active);
}
