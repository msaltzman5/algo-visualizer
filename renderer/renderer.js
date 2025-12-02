// renderer/renderer.js

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const algoSelect = document.getElementById("algo-select");

const btnGenerate = document.getElementById("btn-generate");
const btnStep = document.getElementById("btn-step");
const btnRun = document.getElementById("btn-run");
const btnReset = document.getElementById("btn-reset");

const ctx = canvas.getContext("2d");

// Resize canvas to fill container
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    drawInitial();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Simple placeholder drawing for now
function drawInitial() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "20px system-ui";
    ctx.fillText("Algorithm visualization will go here.", 24, 40);

    // Example nodes in a line (you can replace with real DFS/BFS later)
    const nodes = 6;
    const margin = 80;
    const y = canvas.height / 2;
    const spacing = (canvas.width - 2 * margin) / (nodes - 1);

    for (let i = 0; i < nodes; i++) {
        const x = margin + i * spacing;

        // Node
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fillStyle = "#1d4ed8";
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.stroke();

        // Label
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "14px system-ui";
        const label = String.fromCharCode(65 + i); // A, B, C...
        ctx.fillText(label, x - 5, y + 5);

        // Edge
        if (i < nodes - 1) {
            const nextX = margin + (i + 1) * spacing;
            ctx.beginPath();
            ctx.moveTo(x + 20, y);
            ctx.lineTo(nextX - 20, y);
            ctx.strokeStyle = "#64748b";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

function logStatus(msg) {
    statusEl.textContent = msg;
}

// Button handlers
btnGenerate.addEventListener("click", () => {
    logStatus(`Generated new ${algoSelect.value.toUpperCase()} graph (placeholder).`);
    drawInitial();
});

btnStep.addEventListener("click", () => {
    logStatus("Step through algorithm (TODO: implement).");
});

btnRun.addEventListener("click", () => {
    logStatus("Run algorithm animation (TODO: implement).");
});

btnReset.addEventListener("click", () => {
    logStatus("Reset visualization.");
    drawInitial();
});

// Optional: show version from preload
if (window.appInfo) {
    const verEl = document.getElementById("app-version");
    verEl.textContent = `${window.appInfo.name} v${window.appInfo.version}`;
}
