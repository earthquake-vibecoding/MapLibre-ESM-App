// macOS dev: Electron.app이 미서명이면 시스템 알림이 UNErrorDomain 1로 무단 차단됨.
// pnpm install이 Electron 바이너리를 다시 받아올 때마다 서명이 사라지므로 postinstall에서 ad-hoc 서명.
const { execSync } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'darwin') process.exit(0);

const app = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app');
try {
  execSync(`codesign -dv "${app}"`, { stdio: 'ignore' }); // 이미 서명됨
} catch {
  try {
    execSync(`codesign --force --deep --sign - "${app}"`, { stdio: 'ignore' });
    console.log('[postinstall] Electron.app ad-hoc 서명 완료 (macOS 알림 활성화)');
  } catch (e) {
    console.warn('[postinstall] Electron.app 서명 실패 — 시스템 알림이 안 뜰 수 있음:', e.message);
  }
}
