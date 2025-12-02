// renderer/renderer.js

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const algoSelect = document.getElementById("algo-select");
const nodeCountInput = document.getElementById("node-count");
const edgeWeightsCheckbox = document.getElementById("edge-weights");
const stackContainer = document.getElementById("stack-container");
const stackBody = document.getElementById("stack-body");

const btnGenerate = document.getElementById("btn-generate");
const btnStep = document.getElementById("btn-step");
const btnRun = document.getElementById("btn-run");
const btnReset = document.getElementById("btn-reset");

const ctx = canvas.getContext("2d");
const stackView = document.getElementById("stack-view");

// Central place to store algorithm-specific options and labels
const ALGORITHMS = {
    dfs: { id: "dfs", label: "Depth-First Search", edgeChance: 0.3, forceWeights: false },
    bfs: { id: "bfs", label: "Breadth-First Search", edgeChance: 0.35, forceWeights: false },
    dijkstra: { id: "dijkstra", label: "Dijkstra", edgeChance: 0.45, forceWeights: true },
    sort: { id: "sort", label: "Sorting", edgeChance: 0.25, forceWeights: false }
};

function getAlgorithmConfig(key) {
    return ALGORITHMS[key] || { id: key, label: "Custom", edgeChance: 0.3, forceWeights: false };
}

// Simple graph model + random generator for quick visualizations
class Graph {
    constructor(nodes, edges, options = {}) {
        this.nodes = nodes;
        this.edges = edges;
        this.nodeById = new Map(nodes.map((n) => [n.id, n]));
        this.showWeights = !!options.showWeights;
    }

    static random(nodeCount = 8, edgeChance = 0.35, withWeights = true) {
        const nodes = Array.from({ length: nodeCount }, (_, i) => ({
            id: i,
            label: String.fromCharCode(65 + i),
            pos: Graph.polarPosition(i, nodeCount)
        }));

        const edges = [];

        // Ensure connectivity with a random spanning tree
        for (let i = 1; i < nodeCount; i++) {
            const target = Graph.randomInt(0, i - 1);
            edges.push({ from: i, to: target, weight: Graph.randomWeight(withWeights) });
        }

        // Add some extra random edges for density
        for (let i = 0; i < nodeCount; i++) {
            for (let j = i + 1; j < nodeCount; j++) {
                if (Math.random() < edgeChance && !Graph.edgeExists(edges, i, j)) {
                    edges.push({ from: i, to: j, weight: Graph.randomWeight(withWeights) });
                }
            }
        }

        return new Graph(nodes, edges, { showWeights: withWeights });
    }

    static randomWeight(enabled = true) {
        return enabled ? Graph.randomInt(1, 9) : 1;
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static edgeExists(edges, a, b) {
        return edges.some(
            (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
        );
    }

    static polarPosition(index, total) {
        const angle = (Math.PI * 2 * index) / total;
        const radius = 0.38 + Math.random() * 0.08;
        const jitterX = (Math.random() - 0.5) * 0.05;
        const jitterY = (Math.random() - 0.5) * 0.05;
        const x = 0.5 + radius * Math.cos(angle) + jitterX;
        const y = 0.5 + radius * Math.sin(angle) + jitterY;
        return {
            x: Math.min(0.9, Math.max(0.1, x)),
            y: Math.min(0.9, Math.max(0.1, y))
        };
    }

    canvasPositions(width, height) {
        return this.nodes.map((node) => ({
            node,
            x: node.pos.x * width,
            y: node.pos.y * height
        }));
    }

    getNode(id) {
        return this.nodeById.get(id);
    }
}

let currentGraph = null;
let traversalState = null;

// Resize canvas to fill container
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    drawGraph();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawGraph(graph = currentGraph) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!graph) {
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "18px system-ui";
        ctx.fillText("Generate a graph to get started.", 24, 40);
        return;
    }

    const visited =
        traversalState && traversalState.graph === graph
            ? traversalState.visited
            : null;

    const positions = graph.canvasPositions(canvas.width, canvas.height);
    const posById = new Map(positions.map((p) => [p.node.id, p]));

    // Draw edges first
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#475569";
    for (const edge of graph.edges) {
        const from = posById.get(edge.from);
        const to = posById.get(edge.to);
        if (!from || !to) continue;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Edge weight label near the midpoint
        if (graph.showWeights) {
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            ctx.fillStyle = "#cbd5e1";
            ctx.font = "12px system-ui";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${edge.weight}`, midX, midY - 8);
        }
    }

    // Draw nodes
    for (const { node, x, y } of positions) {
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        const isVisited = visited ? visited.has(node.id) : false;
        ctx.fillStyle = isVisited ? "#334155" : "#1d4ed8";
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#e5e7eb";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, x, y);
    }
}

function logStatus(msg) {
    statusEl.textContent = msg;
}

function updateStackView(stack) {
    if (!stackBody) return;
    stackBody.innerHTML = "";
    const algo = getAlgorithmConfig(algoSelect.value);
    if (algo.id !== "dfs") {
        stackContainer.style.display = "none";
        return;
    }
    stackContainer.style.display = "block";

    if (!stack || stack.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `<td style="padding: 4px;">–</td><td style="padding: 4px;">Empty</td>`;
        stackBody.appendChild(row);
        return;
    }

    // Show top of stack first
    const labels = stack
        .map((id) => currentGraph?.getNode(id)?.label ?? id)
        .slice()
        .reverse();

    labels.forEach((label, idx) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td style="padding: 4px;">${idx + 1}</td><td style="padding: 4px;">${label}</td>`;
        stackBody.appendChild(row);
    });
}

function buildAdjacency(graph) {
    const adj = new Map();
    for (const node of graph.nodes) {
        adj.set(node.id, []);
    }
    for (const edge of graph.edges) {
        adj.get(edge.from).push(edge.to);
        adj.get(edge.to).push(edge.from);
    }
    for (const list of adj.values()) {
        list.sort((a, b) => a - b);
    }
    return adj;
}

function startTraversal(algo, graph) {
    if (algo.id !== "dfs") {
        traversalState = null;
        logStatus(`Step not implemented for ${algo.label} yet.`);
        updateStackView([]);
        drawGraph();
        return;
    }

    const startNode = graph.nodes[0]?.id ?? 0;
    traversalState = {
        type: "dfs",
        graph,
        stack: [startNode],
        stackSet: new Set([startNode]),
        visited: new Set(),
        adjacency: buildAdjacency(graph),
        finished: false
    };
    logStatus(`Starting DFS from ${graph.getNode(startNode)?.label ?? startNode}.`);
    updateStackView(traversalState.stack);
    drawGraph();
}

function stepTraversal() {
    if (!currentGraph) {
        logStatus("Generate a graph first.");
        return;
    }
    const algo = getAlgorithmConfig(algoSelect.value);
    if (!traversalState || traversalState.graph !== currentGraph) {
        startTraversal(algo, currentGraph);
        return;
    }

    if (traversalState.finished) {
        logStatus("Traversal already finished.");
        return;
    }

    if (traversalState.stack.length === 0) {
        traversalState.finished = true;
        logStatus("DFS complete.");
        updateStackView(traversalState.stack);
        drawGraph();
        return;
    }

    const nodeId = traversalState.stack.pop();
    traversalState.stackSet.delete(nodeId);
    if (traversalState.visited.has(nodeId)) {
        logStatus(`Skipping already visited ${currentGraph.getNode(nodeId)?.label ?? nodeId}.`);
        updateStackView(traversalState.stack);
        drawGraph();
        return;
    }

    traversalState.visited.add(nodeId);

    const neighbors = traversalState.adjacency.get(nodeId) ?? [];
    // Push neighbors in reverse so smaller ids are processed first
    for (let i = neighbors.length - 1; i >= 0; i--) {
        const n = neighbors[i];
        if (!traversalState.visited.has(n) && !traversalState.stackSet.has(n)) {
            traversalState.stack.push(n);
            traversalState.stackSet.add(n);
        }
    }

    logStatus(`Visited ${currentGraph.getNode(nodeId)?.label ?? nodeId}.`);
    updateStackView(traversalState.stack);
    drawGraph();
}

function createGraphForSelection() {
    const algoKey = algoSelect.value;
    const algo = getAlgorithmConfig(algoKey);
    const parsedNodes = parseInt(nodeCountInput.value, 10);
    const nodeCount = Number.isFinite(parsedNodes)
        ? Math.min(25, Math.max(2, parsedNodes))
        : 8;
    const edgeChance = algo.edgeChance;
    const withWeights = edgeWeightsCheckbox.checked || algo.forceWeights;
    return { graph: Graph.random(nodeCount, edgeChance, withWeights), algo };
}

function generateAndDraw() {
    const { graph, algo } = createGraphForSelection();
    currentGraph = graph;
    traversalState = null;
    updateStackView([]);
    drawGraph();
    const edgeCount = currentGraph.edges.length;
    logStatus(`Generated ${currentGraph.nodes.length} nodes and ${edgeCount} edges for ${algo.label}.`);
}

// Button handlers
btnGenerate.addEventListener("click", () => {
    generateAndDraw();
});

btnStep.addEventListener("click", () => {
    stepTraversal();
});

algoSelect.addEventListener("change", () => {
    // Hide stack when not DFS
    updateStackView(traversalState?.stack || []);
});

btnRun.addEventListener("click", () => {
    logStatus("Run algorithm animation (TODO: implement).");
});

btnReset.addEventListener("click", () => {
    currentGraph = null;
    traversalState = null;
    logStatus("Cleared graph; click Generate to create a new one.");
    updateStackView([]);
    drawGraph();
});

// Optional: show version from preload
if (window.appInfo) {
    const verEl = document.getElementById("app-version");
    verEl.textContent = `${window.appInfo.name} v${window.appInfo.version}`;
}

// Kick things off with an initial graph
generateAndDraw();
