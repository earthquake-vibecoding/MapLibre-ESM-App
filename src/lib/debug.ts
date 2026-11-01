/** 디버그 링버퍼 — DevTools에서 window.__quakeLog로 최근 로그 확인. URL에 ?debug=1 있으면 console에도 출력 */

const MAX = 200;

export function dbg(msg: string): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (!w.__quakeLog) w.__quakeLog = [];
  const t = new Date().toTimeString().slice(0, 8);
  w.__quakeLog.push(`${t} ${msg}`);
  if (w.__quakeLog.length > MAX) w.__quakeLog.shift();
  if (w.__quakeDebug) console.debug('[quake]', msg);
}
