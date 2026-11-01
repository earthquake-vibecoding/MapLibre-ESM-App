const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('node:path');

// 감지 폴링/알람이 백그라운드(가려진 창)에서도 계속 돌게 — 스로틀링 전면 해제
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'IntensiveWakeUpThrottling');

let mainWindow = null;
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

// renderer 상태 보고 → 트레이 아이콘/툴팁 갱신
ipcMain.on('alert-status', (_e, active) => {
  if (!tray) return;
  const icon = (name) => nativeImage.createFromPath(path.join(__dirname, 'assets', name));
  tray.setImage(icon(active ? 'tray-alert.png' : 'tray-idle.png'));
  tray.setToolTip(active ? '지진 모니터 — 흔들림 감지중!' : '지진 모니터');
});

app.whenReady().then(async () => {
  startUrl = await resolveStartUrl();
  createWindow(startUrl);
  createTray();

  app.on('activate', () => showWindow());
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱 — 창을 닫아도 감지는 계속. 종료는 트레이 메뉴로.
  if (process.platform !== 'darwin' && !tray) app.quit();
});
