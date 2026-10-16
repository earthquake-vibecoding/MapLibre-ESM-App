const { app, BrowserWindow } = require('electron');

let mainWindow = null;

async function resolveStartUrl() {
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) return devUrl;
  // prod: dist 정적 빌드 + /api 서버를 같이 띄움
  const { startServer } = await import('./server/index.mjs');
  await startServer(3000);
  return 'http://127.0.0.1:3000';
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: '실시간 지진 정보 & EEW 감지 시스템',
  });
  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const url = await resolveStartUrl();
  createWindow(url);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
