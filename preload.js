// preload.js
// This runs before the renderer. You can expose safe APIs here if needed.

const { contextBridge } = require("electron");

// Example: expose a version API to your renderer (optional)
contextBridge.exposeInMainWorld("appInfo", {
  name: "Algorithm Visualizer",
  version: "0.1.0"
});
