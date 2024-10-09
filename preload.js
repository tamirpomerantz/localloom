const { contextBridge, ipcRenderer } = require('electron');
const ffmpeg = require('ffmpeg-static-electron');
const fluentFfmpeg = require('fluent-ffmpeg');
const path = require('path');

// Expose APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  convertVideo: (inputPath, outputPath) => ipcRenderer.invoke('convert-video', inputPath, outputPath),
  getDesktopSources: (options) => ipcRenderer.invoke('get-sources', options),
  getMatchingScreen: () => ipcRenderer.invoke('get-matching-screen'),
  getFfmpegPath: () => ffmpeg.path // Expose FFmpeg binary path for use in renderer if needed
});