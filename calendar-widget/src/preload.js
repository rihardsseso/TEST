'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  getState: () => ipcRenderer.invoke('state:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  setClient: (cfg) => ipcRenderer.invoke('client:set', cfg),
  importClient: () => ipcRenderer.invoke('client:import'),
  resetClient: () => ipcRenderer.invoke('client:reset'),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  getAgenda: () => ipcRenderer.invoke('agenda:get'),
  openLink: (url) => ipcRenderer.send('open:link', url),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  resize: (size) => ipcRenderer.send('win:resize', size),
});
