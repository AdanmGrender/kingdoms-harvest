'use strict';
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const WG_PATHS = [
  'C:\\Program Files\\WireGuard\\wireguard.exe',
  'C:\\Program Files (x86)\\WireGuard\\wireguard.exe',
];
const WG_TOOL_PATHS = [
  'C:\\Program Files\\WireGuard\\wg.exe',
  'C:\\Program Files (x86)\\WireGuard\\wg.exe',
];

function getWGPath() {
  return WG_PATHS.find(p => fs.existsSync(p)) || null;
}

function getWGToolPath() {
  return WG_TOOL_PATHS.find(p => fs.existsSync(p)) || null;
}

function isWireGuardInstalled() {
  return getWGPath() !== null;
}

function installTunnel(configPath) {
  return new Promise((resolve, reject) => {
    const wg = getWGPath();
    if (!wg) return reject(new Error('WireGuard not installed. Download from wireguard.com/install'));
    exec(`"${wg}" /installtunnelservice "${configPath}"`, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function uninstallTunnel(tunnelName) {
  return new Promise((resolve, reject) => {
    const wg = getWGPath();
    if (!wg) return reject(new Error('WireGuard not installed'));
    exec(`"${wg}" /uninstalltunnelservice "${tunnelName}"`, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
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
      const blocks = stdout.split(/\npeer:/);
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const endpointMatch = block.match(/endpoint:\s*([^\n]+)/);
        const hsMatch = block.match(/latest handshake:\s*([^\n]+)/);
        const transferMatch = block.match(/transfer:\s*([^\n]+)/);
        let connected = false;
        if (hsMatch) {
          const secsMatch = hsMatch[1].match(/(\d+)\s*second/);
          const minsMatch = hsMatch[1].match(/(\d+)\s*minute/);
          const secs = secsMatch ? parseInt(secsMatch[1]) : (minsMatch ? parseInt(minsMatch[1]) * 60 : 9999);
          connected = secs < 180;
        }
        peers.push({
          endpoint: endpointMatch ? endpointMatch[1].trim() : '(none)',
          handshake: hsMatch ? hsMatch[1].trim() : 'never',
          transfer: transferMatch ? transferMatch[1].trim() : '—',
          connected,
        });
      }
      resolve({ active: true, raw: stdout, peers });
    });
  });
}

function getPublicIp() {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

module.exports = {
  isWireGuardInstalled,
  getWGPath,
  installTunnel,
  uninstallTunnel,
  getTunnelStatus,
  getPublicIp,
};
