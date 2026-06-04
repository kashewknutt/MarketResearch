#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn } = require("child_process");
const electronPath = require("electron");

const env = { ...process.env };

// Some parent shells/tools set this for Node-style Electron commands. If it
// reaches the Electron binary, the app boots as plain Node and the main-process
// Electron APIs are never registered.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, process.argv.slice(2), {
  env,
  stdio: "inherit",
  windowsHide: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
