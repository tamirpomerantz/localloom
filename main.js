const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
   mainWindow = new BrowserWindow({
    width: 320,
    height: 400,
    frame: false,              
    transparent: true,         
    resizable: true,          
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,    
      contextIsolation: true   
    }
  });
  mainWindow.loadFile('index.html');
}

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