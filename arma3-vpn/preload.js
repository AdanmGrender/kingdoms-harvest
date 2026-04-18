'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpnAPI', {
  checkWG:        ()     => ipcRenderer.invoke('wg:check'),
  getPublicIp:    ()     => ipcRenderer.invoke('wg:getPublicIp'),
  openWGDownload: ()     => ipcRenderer.invoke('wg:openDownload'),

  startServer:    (opts) => ipcRenderer.invoke('server:start', opts),
  stopServer:     ()     => ipcRenderer.invoke('server:stop'),

  parseJoinCode:  (opts) => ipcRenderer.invoke('client:parse', opts),
  connectClient:  (opts) => ipcRenderer.invoke('client:connect', opts),
  disconnectClient: ()   => ipcRenderer.invoke('client:disconnect'),

  getStatus:      (opts) => ipcRenderer.invoke('wg:status', opts),
});
