// main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");

// Disable hardware acceleration to avoid GPU-related buffer issues in some environments
app.disableHardwareAcceleration();

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });

    win.loadFile(path.join(__dirname, "renderer", "index.html"));

    // Optional: open DevTools automatically during dev
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        // On macOS, recreate a window when the dock icon is clicked and no other windows are open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    // On macOS, apps usually stay active until Cmd+Q; on Windows/Linux, quit on close.
    if (process.platform !== "darwin") {
        app.quit();
    }
});
