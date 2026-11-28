'use strict';

/**
 * 汐見環状線3D デスクトップ版（Electron）
 *
 * ゲーム本体は Web版（GitHub Pages版）と同じ index.html + assets をそのまま同梱し、
 * メインプロセス内で 127.0.0.1 の空きポートに静的HTTPサーバーを立てて読み込む。
 * file:// 直読みだと fetch / 音声のシーク / 相対パス解決が失敗するため、この方式にしている。
 */

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB_ROOT = path.join(__dirname, 'www');
const APP_TITLE = '汐見環状線3D';

// ゲームは効果音・発車メロディを多用するため、ユーザー操作前の自動再生を許可する
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 高DPI環境でのちらつき対策
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestPath(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  } catch (e) {
    return null;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^([/\\])+/, '');
  if (safe.startsWith('..')) return null;
  const full = path.join(root, safe);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

function startServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
      }

      const filePath = resolveRequestPath(root, req.url);
      if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }

        const headers = {
          'Content-Type': contentType(filePath),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache'
        };

        const range = req.headers.range;
        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          if (match) {
            let start = match[1] === '' ? null : parseInt(match[1], 10);
            let end = match[2] === '' ? null : parseInt(match[2], 10);
            if (start === null && end !== null) {
              // 末尾からの指定
              start = Math.max(0, stat.size - end);
              end = stat.size - 1;
            } else {
              start = start === null ? 0 : start;
              end = end === null ? stat.size - 1 : Math.min(end, stat.size - 1);
            }
            if (start > end || start >= stat.size) {
              res.writeHead(416, { 'Content-Range': 'bytes */'.concat(stat.size) });
              res.end();
              return;
            }
            headers['Content-Range'] = 'bytes '.concat(start, '-', end, '/', stat.size);
            headers['Content-Length'] = String(end - start + 1);
            res.writeHead(206, headers);
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
            return;
          }
        }

        headers['Content-Length'] = String(stat.size);
        res.writeHead(200, headers);
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      console.log('[shiomi3d] local server on http://127.0.0.1:' + port);
      resolve(server);
    });
  });
}

let mainWindow = null;
let staticServer = null;

function appIcon() {
  const candidates = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png', 'icon.icns'];
  for (const name of candidates) {
    const p = path.join(__dirname, 'build', name);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function buildMenu() {
  const template = [
    {
      label: '汐見環状線3D',
      submenu: [
        { role: 'about', label: APP_TITLE + ' について' },
        { type: 'separator' },
        { role: 'hide', label: '隠す' },
        { role: 'hideOthers', label: 'ほかを隠す' },
        { role: 'unhide', label: 'すべて表示' },
        { type: 'separator' },
        { role: 'quit', label: '終了' }
      ]
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: '再読み込み (Ctrl/Cmd+R)' },
        { role: 'forceReload', label: '強制再読み込み' },
        { type: 'separator' },
        { role: 'resetZoom', label: '拡大率を戻す' },
        { role: 'zoomIn', label: '拡大' },
        { role: 'zoomOut', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'フルスクリーン (F11)' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '開発者ツール (F12)' }
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'Web版を開く（ブラウザ）',
          click: () => shell.openExternal('https://riku06568.github.io/train-driver-3d/')
        },
        {
          label: 'アプリの保存場所を開く',
          click: () => shell.openPath(app.getPath('userData'))
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function attachNavigationHandlers(win, origin) {
  // 外部リンク（YouTube・X・ご意見箱など）は標準ブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin)) return { action: 'allow' };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(origin)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
}

async function createWindow() {
  staticServer = await startServer(WEB_ROOT);
  const { port } = staticServer.address();
  const origin = 'http://127.0.0.1:' + port;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b1322',
    title: APP_TITLE,
    show: false,
    autoHideMenuBar: false,
    icon: appIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
      webgl: true
    }
  });

  attachNavigationHandlers(mainWindow, origin);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(origin + '/index.html');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    try {
      await createWindow();
    } catch (err) {
      console.error(err);
      dialog.showErrorBox('起動できませんでした', String(err && err.message ? err.message : err));
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (staticServer) {
      try { staticServer.close(); } catch (e) { /* noop */ }
      staticServer = null;
    }
  });
}
