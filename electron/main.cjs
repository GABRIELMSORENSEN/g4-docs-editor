const {app, BrowserWindow, shell} = require('electron');
const path = require('node:path');
app.disableHardwareAcceleration();
// Chromium AppContainer children need read/execute access to their own installation.
// Keep renderer sandboxing enabled; scope this ACL to shipped application files only.
if(process.platform==='win32'){
  const directory=path.dirname(process.execPath);
  const shipped=[process.execPath,'icudtl.dat','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','ffmpeg.dll','libEGL.dll','libGLESv2.dll','vk_swiftshader.dll','vk_swiftshader_icd.json','vulkan-1.dll','resources','resources/app.asar','resources/elevate.exe','locales','locales/*.pak'];
  // Do not grant access to user documents or settings beside an unpacked executable.
  for(const file of [directory,...shipped.map(value=>path.isAbsolute(value)?value:path.join(directory,value))]){
    try{require('node:child_process').execFileSync('icacls.exe',[file,'/grant','*S-1-15-2-1:RX','*S-1-15-2-2:RX','/C','/Q'],{windowsHide:true,stdio:'ignore',timeout:3000});}catch{}
  }
}


const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 480,
    minHeight: 680,
    title: 'G4 DOCS EDITOR',
    backgroundColor: '#0d0b0d',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.removeMenu();
  window.webContents.setWindowOpenHandler(({url}) => {
    try { if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) void shell.openExternal(url); } catch {}
    return {action: 'deny'};
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.g4.docs.editor');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
