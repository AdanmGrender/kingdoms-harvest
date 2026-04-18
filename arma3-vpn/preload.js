'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpnAPI', {
  // window
  minimize: ()     => ipcRenderer.send('win:minimize'),
  close:    ()     => ipcRenderer.send('win:close'),

  // wireguard
  checkWG:        ()     => ipcRenderer.invoke('wg:check'),
  autoInstallWG:  ()     => ipcRenderer.invoke('wg:autoInstall'),
  getPublicIp:    ()     => ipcRenderer.invoke('wg:getPublicIp'),
  openWGDownload: ()     => ipcRenderer.invoke('wg:openDownload'),
  getStatus:      (opts) => ipcRenderer.invoke('wg:status', opts),
  onInstallProgress: (cb) => ipcRenderer.on('wg:installProgress', (_e, data) => cb(data)),

  // server
  startServer: (opts) => ipcRenderer.invoke('server:start', opts),
  stopServer:  ()     => ipcRenderer.invoke('server:stop'),

  // client
  parseJoinCode:   (opts) => ipcRenderer.invoke('client:parse', opts),
  connectClient:   (opts) => ipcRenderer.invoke('client:connect', opts),
  disconnectClient: ()    => ipcRenderer.invoke('client:disconnect'),
});
