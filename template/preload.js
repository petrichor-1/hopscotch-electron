const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ipc', {
  osUsername: () => ipcRenderer.invoke('osUsername')
})