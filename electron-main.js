const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const http = require("http");

let mainWindow;
let serverStarted = false;
const projectDir = app.isPackaged ? app.getAppPath() : __dirname;

// Load settings before starting server.js so packaged builds use the same PORT/DB settings.
require("dotenv").config({ path: path.join(projectDir, ".env") });
const configuredHost = process.env.HOST || "127.0.0.1";
const host = (configuredHost === "0.0.0.0" || configuredHost === "::") ? "127.0.0.1" : configuredHost;
const port = Number(process.env.PORT || 3006);

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const check = () => {
      const req = http.get(url, res => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else reject(new Error(`Local server returned HTTP ${res.statusCode}`));
      });
      req.on("error", () => {
        if (++count >= attempts) return reject(new Error(`Local server did not start at ${url}. Check .env/database settings and whether port ${port} is free.`));
        setTimeout(check, 1000);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    check();
  });
}

async function createWindow() {
  try {
    if (!serverStarted) {
      // Start Express inside Electron's Node runtime. Do not spawn the installed EXE as a child process.
      require(path.join(projectDir, "server.js"));
      serverStarted = true;
    }
    await waitForServer(`http://${host}:${port}`);
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1000,
      minHeight: 650,
      title: "Birla Diwali Prize",
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    await mainWindow.loadURL(`http://${host}:${port}`);
    mainWindow.on("closed", () => { mainWindow = null; });
  } catch (err) {
    dialog.showErrorBox("Birla Diwali Prize - Startup Error", String(err && err.stack ? err.stack : err));
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
