// renderer → main 단방향 브릿지 (contextIsolation 유지)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quakeBridge', {
  /** 감지/EEW 활성 상태 보고 → 트레이 아이콘 갱신 */
  setAlertStatus: (active) => ipcRenderer.send('alert-status', !!active),
});
