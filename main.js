const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const ffmpegPath = require('ffmpeg-static-electron');
const fluentFfmpeg = require('fluent-ffmpeg');
const fs = require('fs');


let mainWindow;

function createWindow() {
   mainWindow = new BrowserWindow({
    width: 320,
    height: 400,
    frame: false,              
    transparent: true,    
    alwaysOnTop: true,          // This keeps the window always on top
    resizable: true,          
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,    
      contextIsolation: true   
    }
  });
  mainWindow.loadFile('index.html');
}
ipcMain.handle('convert-video', (event, buffer) => {
  return new Promise((resolve, reject) => {
    const tempPath = app.getPath('temp'); // Electron's temp path
    const inputFilePath = path.join(tempPath, 'temp_recording.webm');  // Write temp WebM file
    const outputFilePath = path.join(app.getPath('desktop'), 'converted_recording.mp4');  // Output to desktop

    // Write the buffer to a temporary file
    fs.writeFileSync(inputFilePath, Buffer.from(buffer));

    // Use fluent-ffmpeg to convert the file and apply scaling
    fluentFfmpeg(inputFilePath)
      .setFfmpegPath(ffmpegPath.path)  // Ensure FFmpeg binary path is set
      .output(outputFilePath)
      .videoCodec('libx264')  // Convert video to H.264
      .audioCodec('aac')      // Convert audio to AAC
      .videoFilters('scale=trunc(iw/2)*2:trunc(ih/2)*2') // Scale width and height to be divisible by 2
      .on('end', () => {
        resolve(outputFilePath);  // Return the output file path
      })
      .on('error', (err) => {
        reject(err);  // Handle errors
      })
      .run();
  });
});

// Handle IPC event from renderer to get desktop sources
ipcMain.handle('get-sources', async (event, options) => {
  const sources = await desktopCapturer.getSources(options);
  return sources;
});

// Handle the request to get window bounds and matching screen
ipcMain.handle('get-matching-screen', () => {
  const windowBounds = mainWindow.getBounds();
  
  const allDisplays = screen.getAllDisplays();

  // Find the display that contains the Electron window
  const matchingDisplay = allDisplays.find(display => {
    const { x, y, width, height } = display.bounds;
    return (
      windowBounds.x >= x &&
      windowBounds.x + windowBounds.width <= x + width &&
      windowBounds.y >= y &&
      windowBounds.y + windowBounds.height <= y + height
    );
  });

  // Return the matching display (or the first one as a fallback)
  return matchingDisplay || allDisplays[0];
});

app.whenReady().then(createWindow);