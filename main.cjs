const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('node:path');
const { readFileSync, writeFileSync } = require('node:fs');

// 감지 폴링/알람이 백그라운드(가려진 창)에서도 계속 돌게 — 스로틀링 전면 해제
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'IntensiveWakeUpThrottling');

let mainWindow = null;
let panelWindow = null;
let tray = null;
let startUrl = null;
let isQuitting = false;

async function resolveStartUrl() {
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) return devUrl;
  // prod: dist 정적 빌드 + /api 서버를 같이 띄움
  const { startServer } = await import('./server/index.mjs');
  await startServer(3000);
  return 'http://127.0.0.1:3000';
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(startUrl);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = (name) => nativeImage.createFromPath(path.join(__dirname, 'assets', name));
  tray = new Tray(icon('tray-idle.png'));
  tray.setToolTip('지진 모니터');
  const menu = Menu.buildFromTemplate([
    { label: '열기', click: showWindow },
    { type: 'separator' },
    { label: '종료', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.on('click', showWindow);
  tray.on('right-click', () => tray.popUpContextMenu(menu));
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: '실시간 지진 정보 & EEW 감지 시스템',
    webPreferences: {
      backgroundThrottling: false, // 백그라운드에서도 감지 폴링·소리 유지
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.loadURL(url);
  // 창 닫기 → 트레이로 숨김 상주. 완전 종료는 트레이 메뉴 '종료' 또는 Cmd+Q
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- 외부 관측소 패널(항상 위 미니 창) — 데이터는 메인 창 릴레이로만 공급 ---

const PANEL_DEFAULT = { width: 340, height: 500 };
let panelBounds = null; // 마지막 크기/위치 — 재사용 (userData/panel-bounds.json에 저장)

function panelBoundsPath() {
  return path.join(app.getPath('userData'), 'panel-bounds.json');
}

function loadPanelBounds() {
  try {
    const v = JSON.parse(readFileSync(panelBoundsPath(), 'utf-8'));
    if (v && [v.x, v.y, v.width, v.height].every((n) => typeof n === 'number')) panelBounds = v;
  } catch {
    panelBounds = null;
  }
}

function savePanelBounds() {
  if (!panelBounds) return;
  try {
    writeFileSync(panelBoundsPath(), JSON.stringify(panelBounds));
  } catch {
    // ignore
  }
}

function trackPanelBounds() {
  if (panelWindow && !panelWindow.isDestroyed() && !panelWindow.isMinimized()) {
    panelBounds = panelWindow.getBounds();
  }
}

function createPanel() {
  panelWindow = new BrowserWindow({
    ...(panelBounds ?? PANEL_DEFAULT),
    minWidth: 280,
    minHeight: 360,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      backgroundThrottling: false, // 가려져도 스파크라인 갱신 유지
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  panelWindow.setAlwaysOnTop(true, 'floating');
  const url = startUrl + (startUrl.includes('?') ? '&' : '?') + 'panel=station';
  panelWindow.loadURL(url);
  panelWindow.on('resize', trackPanelBounds);
  panelWindow.on('move', trackPanelBounds);
  panelWindow.on('close', savePanelBounds);
  panelWindow.on('closed', () => {
    panelWindow = null;
    broadcastPanelState(false);
  });
}

function broadcastPanelState(open) {
  for (const w of [mainWindow, panelWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send('panel:state', open);
  }
}

ipcMain.handle('panel:is-open', () => !!(panelWindow && !panelWindow.isDestroyed()));
ipcMain.on('panel:toggle', () => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
    return;
  }
  createPanel();
  broadcastPanelState(true);
});
ipcMain.on('panel:close', () => {
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.close();
});
// 메인 창 → 패널: 관측소 스냅샷 릴레이
ipcMain.on('panel:relay', (e, data) => {
  if (panelWindow && !panelWindow.isDestroyed() && e.sender !== panelWindow.webContents) {
    panelWindow.webContents.send('panel:data', data);
  }
});
// 선택 동기화: 보낸 창 반대편으로 전달 (메인 지도 클릭 ↔ 패널 검색)
ipcMain.on('panel:select', (e, code) => {
  for (const w of [mainWindow, panelWindow]) {
    if (w && !w.isDestroyed() && w.webContents !== e.sender) w.webContents.send('panel:select', code);
  }
});
// 패널에서 관측소 클릭 → 메인 창 깨워서 지도 이동
ipcMain.on('panel:fly', (_e, lonlat) => {
  showWindow();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('panel:fly', lonlat);
});

// renderer 상태 보고 → 트레이 아이콘/툴팁 갱신
ipcMain.on('alert-status', (_e, active) => {
  if (!tray) return;
  const icon = (name) => nativeImage.createFromPath(path.join(__dirname, 'assets', name));
  tray.setImage(icon(active ? 'tray-alert.png' : 'tray-idle.png'));
  tray.setToolTip(active ? '지진 모니터 — 흔들림 감지중!' : '지진 모니터');
});

app.whenReady().then(async () => {
  loadPanelBounds();
  startUrl = await resolveStartUrl();
  createWindow(startUrl);
  createTray();

  app.on('activate', () => showWindow());
});

app.on('before-quit', () => {
  isQuitting = true;
  savePanelBounds();
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱 — 창을 닫아도 감지는 계속. 종료는 트레이 메뉴로.
  if (process.platform !== 'darwin' && !tray) app.quit();
});
