'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { generateKeyPair } = require('./src/keygen');
const { buildServerConfig, buildClientConfig, encodeJoinCode, decodeJoinCode } = require('./src/configgen');
const wg = require('./src/wireguard');

let mainWindow;
let serverState = null;
let clientState = null;
let CONFIG_DIR;

app.whenReady().then(() => {
  CONFIG_DIR = path.join(app.getPath('userData'), 'wg-configs');
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  mainWindow = new BrowserWindow({
    width: 660,
    height: 760,
    resizable: false,
    title: 'Arma 3 VPN',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
});

async function cleanupTunnels() {
  if (serverState && serverState.active) {
    try { await wg.uninstallTunnel('arma3vpn'); } catch (_) {}
  }
  if (clientState && clientState.active) {
    try { await wg.uninstallTunnel('arma3vpn-client'); } catch (_) {}
  }
}

app.on('window-all-closed', async () => {
  await cleanupTunnels();
  app.quit();
});

process.on('SIGINT', async () => { await cleanupTunnels(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanupTunnels(); process.exit(0); });

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('wg:check', () => ({
  installed: wg.isWireGuardInstalled(),
  path: wg.getWGPath(),
}));

ipcMain.handle('wg:getPublicIp', () => wg.getPublicIp());

ipcMain.handle('wg:openDownload', () => {
  shell.openExternal('https://www.wireguard.com/install/');
});

ipcMain.handle('server:start', async (_, { serverIp, port, numClients }) => {
  if (serverState && serverState.active) {
    try { await wg.uninstallTunnel('arma3vpn'); } catch (_) {}
  }

  const serverKeys = generateKeyPair();
  const clients = [];

  for (let i = 0; i < numClients; i++) {
    const clientKeys = generateKeyPair();
    const vpnIp = `10.8.0.${i + 2}`;
    const clientConfig = buildClientConfig(
      clientKeys.privateKey,
      serverKeys.publicKey,
      `${serverIp}:${port}`,
      vpnIp
    );
    clients.push({
      id: i + 1,
      publicKey: clientKeys.publicKey,
      vpnIp,
      joinCode: encodeJoinCode(clientConfig),
    });
  }

  const peers = clients.map(c => ({ publicKey: c.publicKey, vpnIp: c.vpnIp }));
  const serverConfig = buildServerConfig(serverKeys.privateKey, port, peers);
  const configPath = path.join(CONFIG_DIR, 'arma3vpn.conf');
  fs.writeFileSync(configPath, serverConfig, 'utf8');

  await wg.installTunnel(configPath);

  serverState = {
    active: true,
    tunnelName: 'arma3vpn',
    configPath,
    clients: clients.map(c => ({ id: c.id, vpnIp: c.vpnIp, joinCode: c.joinCode })),
  };

  return { success: true, clients: serverState.clients };
});

ipcMain.handle('server:stop', async () => {
  if (!serverState) return { success: true };
  await wg.uninstallTunnel('arma3vpn');
  serverState.active = false;
  return { success: true };
});

ipcMain.handle('client:parse', (_, { joinCode }) => {
  try {
    const config = decodeJoinCode(joinCode);
    const ipMatch = config.match(/Address\s*=\s*([\d.]+)/);
    const endpointMatch = config.match(/Endpoint\s*=\s*([^\r\n]+)/);
    return {
      success: true,
      vpnIp: ipMatch ? ipMatch[1] : 'Unknown',
      serverEndpoint: endpointMatch ? endpointMatch[1].trim() : 'Unknown',
    };
  } catch (_) {
    return { success: false, error: 'Invalid join code' };
  }
});

ipcMain.handle('client:connect', async (_, { joinCode }) => {
  if (clientState && clientState.active) {
    try { await wg.uninstallTunnel('arma3vpn-client'); } catch (_) {}
  }

  const config = decodeJoinCode(joinCode);
  const configPath = path.join(CONFIG_DIR, 'arma3vpn-client.conf');
  fs.writeFileSync(configPath, config, 'utf8');

  await wg.installTunnel(configPath);
  clientState = { active: true, tunnelName: 'arma3vpn-client', configPath };
  return { success: true };
});

ipcMain.handle('client:disconnect', async () => {
  if (!clientState) return { success: true };
  await wg.uninstallTunnel('arma3vpn-client');
  clientState.active = false;
  return { success: true };
});

ipcMain.handle('wg:status', async (_, { mode }) => {
  const tunnelName = mode === 'server' ? 'arma3vpn' : 'arma3vpn-client';
  return wg.getTunnelStatus(tunnelName);
});
