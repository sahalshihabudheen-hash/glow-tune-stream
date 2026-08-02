const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { ipcMain } = require('electron');

const DISCORD_CLIENT_ID = '1523703325701312552';

let mainWindow = null;
let rpcClient = null;
let rpcReady = false;

function initDiscordRpc() {
  try {
    // Optional dependency — the app must still run when it is unavailable.
    const DiscordRPC = require('discord-rpc');
    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });
    rpcClient.on('ready', () => {
      rpcReady = true;
      console.log('Discord Rich Presence connected');
    });
    rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch((error) => {
      console.warn('Discord RPC login failed:', error.message);
      rpcClient = null;
    });
  } catch (error) {
    console.warn('discord-rpc not installed, presence disabled');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#030303',
    autoHideMenuBar: true,
    title: 'NYRA',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('nyra:presence', (_event, payload) => {
  if (!rpcClient || !rpcReady) return;

  if (!payload || !payload.title) {
    rpcClient.clearActivity().catch(() => {});
    return;
  }

  const now = Date.now();
  const positionMs = Math.max(0, Math.floor((payload.position || 0) * 1000));
  const durationMs = Math.max(0, Math.floor((payload.duration || 0) * 1000));

  const activity = {
    details: String(payload.title).slice(0, 128),
    state: `by ${String(payload.artist || 'Unknown artist')}`.slice(0, 128),
    largeImageKey: payload.artwork || 'nyra_logo',
    largeImageText: 'NYRA Music',
    smallImageKey: payload.isPlaying ? 'play' : 'pause',
    smallImageText: payload.isPlaying ? 'Playing' : 'Paused',
    instance: false,
    buttons: [{ label: 'Listen on NYRA', url: 'https://nyra.app' }],
  };

  // A start/end pair renders Discord's native live progress bar.
  if (payload.isPlaying && durationMs > 0) {
    activity.startTimestamp = now - positionMs;
    activity.endTimestamp = now - positionMs + durationMs;
  }

  rpcClient.setActivity(activity).catch(() => {});
});

app.whenReady().then(() => {
  initDiscordRpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (rpcClient) rpcClient.destroy().catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});
