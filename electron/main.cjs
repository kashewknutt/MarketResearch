/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const electron = require("electron");

if (!electron || typeof electron !== "object" || !electron.app) {
  throw new Error(
    "Electron APIs unavailable. Start the desktop app with `npm run electron:dev` so the Electron launcher can clear Node-only environment flags.",
  );
}

const { app, BrowserWindow } = electron;

const PORT = 3847;
const devUrl = process.env.ELECTRON_DEV_URL;

function isDevMode() {
  return !app.isPackaged;
}

function getDataDir() {
  if (process.env.MARKET_RESEARCH_DATA_DIR) {
    const dir = process.env.MARKET_RESEARCH_DATA_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  const dir = path.join(app.getPath("userData"), "market-research-data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let nextProcess = null;

function waitForServer(url, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        reject(new Error("Next.js server failed to start"));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

async function startNextServer(dataDir) {
  const env = {
    ...process.env,
    MARKET_RESEARCH_DATA_DIR: dataDir,
    PORT: String(PORT),
  };

  if (isDevMode()) {
    nextProcess = spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
      cwd: path.join(__dirname, ".."),
      env,
      shell: true,
      stdio: "inherit",
    });
  } else {
    const standaloneDir = path.join(
      process.resourcesPath,
      "app",
      ".next",
      "standalone",
    );
    const serverPath = path.join(standaloneDir, "server.js");
    nextProcess = spawn(process.execPath, [serverPath], {
      cwd: standaloneDir,
      env: { ...env, NODE_ENV: "production" },
      stdio: "inherit",
    });
  }

  const url = `http://127.0.0.1:${PORT}`;
  await waitForServer(url);
  return url;
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Market Research",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(url);
}

app.whenReady().then(async () => {
  process.env.MARKET_RESEARCH_DATA_DIR = getDataDir();
  const dataDir = process.env.MARKET_RESEARCH_DATA_DIR;

  try {
    let url;
    if (devUrl) {
      await waitForServer(devUrl);
      url = devUrl;
    } else {
      url = await startNextServer(dataDir);
    }
    createWindow(url);
  } catch (err) {
    console.error(err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
});
