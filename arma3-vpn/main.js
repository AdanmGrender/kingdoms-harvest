'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

const { generateKeyPair }                                            = require('./src/keygen');
const { buildServerConfig, buildClientConfig, encodeJoinCode, decodeJoinCode } = require('./src/configgen');
const wg = require('./src/wireguard');

let mainWindow;
let serverState = null;
let clientState = null;
let CONFIG_DIR;

app.whenReady().then(() => {
  CONFIG_DIR = path.join(app.getPath('userData'), 'wg-configs');
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  createWindow();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 680,
    height: 780,
    minWidth: 640,
    minHeight: 700,
    title: 'Arma 3 VPN',
    backgroundColor: '#0d1117',
    frame: false,         // custom titlebar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile('index.html');
}

async function cleanupTunnels() {
  if (serverState && serverState.active) try { await wg.uninstallTunnel('arma3vpn');        } catch (_) {}
  if (clientState && clientState.active) try { await wg.uninstallTunnel('arma3vpn-client'); } catch (_) {}
}

app.on('window-all-closed', async () => { await cleanupTunnels(); app.quit(); });
process.on('SIGINT',  async () => { await cleanupTunnels(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanupTunnels(); process.exit(0); });

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => mainWindow.minimize());
ipcMain.on('win:close',    async () => { await cleanupTunnels(); app.quit(); });

// ── WireGuard checks ──────────────────────────────────────────────────────────
ipcMain.handle('wg:check', () => ({ installed: wg.isWireGuardInstalled() }));
ipcMain.handle('wg:getPublicIp', () => wg.getPublicIp());
ipcMain.handle('wg:openDownload', () => shell.openExternal('https://www.wireguard.com/install/'));

// ── Auto-install WireGuard ────────────────────────────────────────────────────
ipcMain.handle('wg:autoInstall', async () => {
  await wg.autoInstallWireGuard((progress) => {
    mainWindow.webContents.send('wg:installProgress', progress);
  });
  return { installed: wg.isWireGuardInstalled() };
});

// ── Server ────────────────────────────────────────────────────────────────────
ipcMain.handle('server:start', async (_, { serverIp, port, numClients }) => {
  if (serverState && serverState.active) {
    try { await wg.uninstallTunnel('arma3vpn'); } catch (_) {}
  }

  const serverKeys = generateKeyPair();
  const clients = [];
  for (let i = 0; i < numClients; i++) {
    const ck     = generateKeyPair();
    const vpnIp  = `10.8.0.${i + 2}`;
    const cfg    = buildClientConfig(ck.privateKey, serverKeys.publicKey, `${serverIp}:${port}`, vpnIp);
    clients.push({ id: i + 1, publicKey: ck.publicKey, vpnIp, joinCode: encodeJoinCode(cfg) });
  }

  const serverCfg    = buildServerConfig(serverKeys.privateKey, port, clients.map(c => ({ publicKey: c.publicKey, vpnIp: c.vpnIp })));
  const configPath   = path.join(CONFIG_DIR, 'arma3vpn.conf');
  fs.writeFileSync(configPath, serverCfg, 'utf8');
  await wg.installTunnel(configPath);

  serverState = { active: true, clients: clients.map(c => ({ id: c.id, vpnIp: c.vpnIp, joinCode: c.joinCode })) };
  return { success: true, clients: serverState.clients };
});

ipcMain.handle('server:stop', async () => {
  if (!serverState) return { success: true };
  await wg.uninstallTunnel('arma3vpn');
  serverState.active = false;
  return { success: true };
});

// ── Client ────────────────────────────────────────────────────────────────────
ipcMain.handle('client:parse', (_, { joinCode }) => {
  try {
    const cfg          = decodeJoinCode(joinCode);
    const ipMatch      = cfg.match(/Address\s*=\s*([\d.]+)/);
    const epMatch      = cfg.match(/Endpoint\s*=\s*([^\r\n]+)/);
    return { success: true, vpnIp: ipMatch?.[1] ?? '?', serverEndpoint: epMatch?.[1]?.trim() ?? '?' };
  } catch (_) {
    return { success: false };
  }
});

ipcMain.handle('client:connect', async (_, { joinCode }) => {
  if (clientState && clientState.active) try { await wg.uninstallTunnel('arma3vpn-client'); } catch (_) {}
  const cfg        = decodeJoinCode(joinCode);
  const cfgPath    = path.join(CONFIG_DIR, 'arma3vpn-client.conf');
  fs.writeFileSync(cfgPath, cfg, 'utf8');
  await wg.installTunnel(cfgPath);
  clientState = { active: true };
  return { success: true };
});

ipcMain.handle('client:disconnect', async () => {
  if (!clientState) return { success: true };
  await wg.uninstallTunnel('arma3vpn-client');
  clientState.active = false;
  return { success: true };
});

// ── Status ────────────────────────────────────────────────────────────────────
ipcMain.handle('wg:status', async (_, { mode }) => {
  return wg.getTunnelStatus(mode === 'server' ? 'arma3vpn' : 'arma3vpn-client');
});
