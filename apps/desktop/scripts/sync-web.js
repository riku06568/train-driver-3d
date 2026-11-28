'use strict';

/**
 * Web版（リポジトリ直下の index.html / manifest.json / assets）を
 * デスクトップアプリ同梱用に apps/desktop/www へコピーする。
 *
 * Web版をそのまま使うので、ゲームを更新してこのワークフローを回すだけで
 * アプリ側も最新版になる。
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.resolve(__dirname, '..', 'www');

const COPIES = [
  { from: 'index.html', to: 'index.html', transform: stripServiceWorker },
  { from: 'manifest.json', to: 'manifest.json' },
  { from: 'assets', to: 'assets', recursive: true }
];

const SKIP = new Set([
  path.join('icons', 'icon-1024.png')
]);

function stripServiceWorker(text) {
  // アプリ内では Service Worker は不要（HTTPキャッシュの二重管理を避ける）
  return text.replace(/<script>\s*\/\* PWA: Service Worker[\s\S]*?<\/script>\s*/g, '');
}

function copyFile(from, to, transform) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (transform) {
    fs.writeFileSync(to, transform(fs.readFileSync(from, 'utf8')));
  } else {
    fs.copyFileSync(from, to);
  }
}

function copyDir(from, to, relBase) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const rel = path.join(relBase, entry.name);
    if (SKIP.has(rel)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst, rel);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dst);
    }
  }
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let count = 0;
  for (const item of COPIES) {
    const src = path.join(REPO_ROOT, item.from);
    const dst = path.join(OUT_DIR, item.to);
    if (!fs.existsSync(src)) {
      throw new Error('Web版のファイルが見つかりません: ' + src);
    }
    if (item.recursive) {
      copyDir(src, dst, item.to);
      count += 1;
    } else {
      copyFile(src, dst, item.transform);
      count += 1;
    }
  }

  const bytes = dirSize(OUT_DIR);
  console.log('[sync-web] ' + count + ' items copied (' + (bytes / 1024 / 1024).toFixed(1) + ' MB) -> ' + OUT_DIR);
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

main();
