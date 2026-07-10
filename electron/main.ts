/* eslint-disable @typescript-eslint/no-require-imports */

import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import http from "http";
// require() is required in the main process — ESM import resolves to the npm stub under tsx
const electron = require("electron") as typeof import("electron");
const { app, BrowserWindow } = electron;

const PORT = 3847;
const devUrl = process.env.ELECTRON_DEV_URL;

function isDevMode(): boolean {
  return !app.isPackaged;
}

function getDataDir(): string {
  if (process.env.MARKET_RESEARCH_DATA_DIR) {
    const dir = process.env.MARKET_RESEARCH_DATA_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  const dir = path.join(app.getPath("userData"), "market-research-data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let nextProcess: ChildProcess | null = null;

function waitForServer(url: string, maxAttempts = 60): Promise<void> {
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

async function startNextServer(dataDir: string): Promise<string> {
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

function createWindow(url: string) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Northstar",
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
    let url: string;
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
