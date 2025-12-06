import { app, BrowserWindow, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Steam 앱 ID (steam_appid.txt에서도 설정 필요)
const STEAM_APP_ID = 480; // 개발용 Spacewar ID, 실제 출시 시 변경

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// Steam 초기화
let steamInitialized = false;
try {
  // steamworks.js가 설치되어 있으면 초기화
  const steamworks = require('steamworks.js');
  if (steamworks) {
    const client = steamworks.init(STEAM_APP_ID);
    if (client) {
      steamInitialized = true;
      console.log('Steam initialized successfully');
      console.log(`Player: ${client.localplayer.getName()}`);
    }
  }
} catch (error) {
  console.log('Steam not available:', error);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'AI Fighter',
    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,      // Steam SDK 사용을 위해 필요
      contextIsolation: false,    // Steam SDK 사용을 위해 필요
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
    fullscreenable: true,
    backgroundColor: '#1a1a2e',
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 풀스크린 토글 (F11)
function toggleFullscreen() {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
}

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // 글로벌 단축키 해제
  globalShortcut.unregisterAll();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  // Steam 종료 처리
  if (steamInitialized) {
    try {
      const steamworks = require('steamworks.js');
      steamworks.shutdown?.();
      console.log('Steam shutdown complete');
    } catch (error) {
      // 무시
    }
  }
});

app.whenReady().then(() => {
  createWindow();

  // F11 풀스크린 토글
  globalShortcut.register('F11', toggleFullscreen);

  // Alt+Enter 풀스크린 토글
  globalShortcut.register('Alt+Return', toggleFullscreen);
});
