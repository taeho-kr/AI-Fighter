import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any IPC methods here if needed in the future
  // Example: saveGame, loadGame, etc.
  platform: process.platform,

  // Future game save/load functionality
  // saveGame: (data: string) => ipcRenderer.invoke('save-game', data),
  // loadGame: () => ipcRenderer.invoke('load-game'),
});

// Type declaration for the exposed API
declare global {
  interface Window {
    electronAPI: {
      platform: string;
    };
  }
}
