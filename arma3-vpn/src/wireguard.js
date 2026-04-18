'use strict';
const { exec } = require('child_process');
const fs   = require('fs');
const https = require('https');
const http  = require('http');
const path  = require('path');
const os    = require('os');

const WG_INSTALLER_URL = 'https://download.wireguard.com/windows-client/wireguard-installer.exe';

const WG_PATHS = [
  'C:\\Program Files\\WireGuard\\wireguard.exe',
  'C:\\Program Files (x86)\\WireGuard\\wireguard.exe',
];
const WG_TOOL_PATHS = [
  'C:\\Program Files\\WireGuard\\wg.exe',
  'C:\\Program Files (x86)\\WireGuard\\wg.exe',
];

function getWGPath()     { return WG_PATHS.find(p => fs.existsSync(p)) || null; }
function getWGToolPath() { return WG_TOOL_PATHS.find(p => fs.existsSync(p)) || null; }
function isWireGuardInstalled() { return getWGPath() !== null; }

// ── Auto-install WireGuard ───────────────────────────────────────────────────
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(destPath);
    let downloaded = 0;
    let total = 0;

    const request = proto.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location, destPath, onProgress)
          .then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      total = parseInt(res.headers['content-length'] || '0', 10);
      res.on('data', chunk => {
        downloaded += chunk.length;
        if (onProgress && total > 0) onProgress(Math.round((downloaded / total) * 100));
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    request.on('error', (e) => { fs.unlink(destPath, () => {}); reject(e); });
    request.on('timeout', () => { request.destroy(); reject(new Error('Download timeout')); });
  });
}

function runInstaller(exePath) {
  return new Promise((resolve, reject) => {
    // /S = silent install (Inno Setup flag bundled in WireGuard installer)
    exec(`"${exePath}" /S`, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err && err.code !== 0) {
        reject(new Error('Installer failed: ' + (stderr || err.message)));
      } else {
        resolve();
      }
    });
  });
}

async function autoInstallWireGuard(onProgress) {
  const tmpExe = path.join(os.tmpdir(), 'wireguard-installer.exe');
  onProgress({ stage: 'download', pct: 0, msg: 'Downloading WireGuard installer…' });
  await downloadFile(WG_INSTALLER_URL, tmpExe, (pct) => {
    onProgress({ stage: 'download', pct, msg: `Downloading WireGuard… ${pct}%` });
  });
  onProgress({ stage: 'install', pct: 95, msg: 'Installing WireGuard (may take a moment)…' });
  await runInstaller(tmpExe);
  try { fs.unlinkSync(tmpExe); } catch (_) {}
  onProgress({ stage: 'done', pct: 100, msg: 'WireGuard installed successfully!' });
}

// ── Tunnel management ────────────────────────────────────────────────────────
function installTunnel(configPath) {
  return new Promise((resolve, reject) => {
    const wg = getWGPath();
    if (!wg) return reject(new Error('WireGuard is not installed'));
    exec(`"${wg}" /installtunnelservice "${configPath}"`, (err, _out, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
}

function uninstallTunnel(tunnelName) {
  return new Promise((resolve, reject) => {
    const wg = getWGPath();
    if (!wg) return reject(new Error('WireGuard is not installed'));
    exec(`"${wg}" /uninstalltunnelservice "${tunnelName}"`, (err, _out, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
}

function getTunnelStatus(tunnelName) {
  return new Promise((resolve) => {
    const tool = getWGToolPath();
    if (!tool) return resolve({ active: false, peers: [] });
    exec(`"${tool}" show "${tunnelName}"`, (err, stdout) => {
      if (err || !stdout.trim()) return resolve({ active: false, peers: [] });
      const peers = [];
      const blocks = stdout.split(/(?=^peer:)/m);
      for (const block of blocks) {
        if (!block.startsWith('peer:')) continue;
        const endpointMatch  = block.match(/endpoint:\s*([^\n]+)/);
        const hsMatch        = block.match(/latest handshake:\s*([^\n]+)/);
        const transferMatch  = block.match(/transfer:\s*([^\n]+)/);
        let connected = false;
        if (hsMatch) {
          const s = hsMatch[1];
          const sec  = (s.match(/(\d+)\s*second/)  || [])[1];
          const min  = (s.match(/(\d+)\s*minute/)  || [])[1];
          const ago  = sec ? +sec : (min ? +min * 60 : 9999);
          connected  = ago < 180;
        }
        peers.push({
          endpoint:  endpointMatch  ? endpointMatch[1].trim()  : '(none)',
          handshake: hsMatch        ? hsMatch[1].trim()        : 'never',
          transfer:  transferMatch  ? transferMatch[1].trim()  : '—',
          connected,
        });
      }
      resolve({ active: true, peers });
    });
  });
}

function getPublicIp() {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

module.exports = {
  isWireGuardInstalled,
  getWGPath,
  autoInstallWireGuard,
  installTunnel,
  uninstallTunnel,
  getTunnelStatus,
  getPublicIp,
};
