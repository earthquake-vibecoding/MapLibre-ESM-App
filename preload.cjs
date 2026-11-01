// renderer → main 단방향 브릿지 (contextIsolation 유지)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quakeBridge', {
  /** 감지/EEW 활성 상태 보고 → 트레이 아이콘 갱신 */
  setAlertStatus: (active) => ipcRenderer.send('alert-status', !!active),
  /** 외부 관측소 패널(미니 창) 제어 + 메인↔패널 릴레이 */
  panel: {
    isOpen: () => ipcRenderer.invoke('panel:is-open'),
    toggle: () => ipcRenderer.send('panel:toggle'),
    close: () => ipcRenderer.send('panel:close'),
    /** 선택 관측소 코드 동기화 (양방향) */
    select: (code) => ipcRenderer.send('panel:select', code),
    /** 패널 → 메인: 지도 이동 요청 */
    flyTo: (lonlat) => ipcRenderer.send('panel:fly', lonlat),
    /** 메인 → 패널: 관측소 스냅샷 릴레이 전송 */
    relay: (data) => ipcRenderer.send('panel:relay', data),
    onState: (cb) => ipcRenderer.on('panel:state', (_e, open) => cb(open)),
    onData: (cb) => ipcRenderer.on('panel:data', (_e, d) => cb(d)),
    onSelect: (cb) => ipcRenderer.on('panel:select', (_e, code) => cb(code)),
    onFlyTo: (cb) => ipcRenderer.on('panel:fly', (_e, lonlat) => cb(lonlat)),
  },
});
