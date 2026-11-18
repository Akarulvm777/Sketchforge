// Desktop wrapper (Electron). Run with: npm start
const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#2b2b2b',
    title: 'Sketchforge',
    icon: path.join(__dirname, 'icon-512.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  // The page asks before unloading when there are unsaved changes; show a real dialog.
  win.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Leave without saving', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Leave without saving?'
    });
    if (choice === 0) event.preventDefault(); // ignore beforeunload and close
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  // Time-lapse "Whole screen" mode: getDisplayMedia records the app's own window.
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => callback({ video: request.frame }));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
