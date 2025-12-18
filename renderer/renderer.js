// renderer/renderer.js

const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const algoSelect = document.getElementById("algo-select");
const nodeCountInput = document.getElementById("node-count");
const edgeWeightsCheckbox = document.getElementById("edge-weights");
const stackContainer = document.getElementById("stack-container");
const worklistBody = document.getElementById("worklist-body");
const worklistTitle = document.getElementById("worklist-title");
const col1 = document.getElementById("col-1");
const col2 = document.getElementById("col-2");
const col3 = document.getElementById("col-3");

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
    dijkstra: { id: "dijkstra", label: "Dijkstra", edgeChance: 0.45, forceWeights: false },
    prim: { id: "prim", label: "Prim (MST)", edgeChance: 0.4, forceWeights: true },
    kruskal: { id: "kruskal", label: "Kruskal (MST)", edgeChance: 0.4, forceWeights: true }
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
let autoRunInterval = null;

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
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const msg =
            (statusEl && statusEl.textContent?.trim()) ||
            "Generate a graph to get started.";
        const words = msg.split(" ");
        const maxWidth = Math.max(200, canvas.width - 48);
        const lineHeight = 22;
        let line = "";
        let y = 40;
        for (let i = 0; i < words.length; i++) {
            const testLine = line ? `${line} ${words[i]}` : words[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line) {
                ctx.fillText(line, 24, y);
                line = words[i];
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        if (line) {
            ctx.fillText(line, 24, y);
        }
        return;
    }

    const visited =
        traversalState && traversalState.graph === graph
            ? traversalState.visited
            : null;
    const isDijkstra =
        traversalState &&
        traversalState.graph === graph &&
        traversalState.type === "dijkstra";
    const currentNode = isDijkstra ? traversalState.currentNode : null;
    const distances = isDijkstra ? traversalState.distances : null;
    const traversedEdges =
        traversalState && traversalState.graph === graph
            ? traversalState.edgesTraversed
            : null;
    const mstEdges =
        traversalState && traversalState.graph === graph
            ? traversalState.edgesMST
            : null;

    const positions = graph.canvasPositions(canvas.width, canvas.height);
    const posById = new Map(positions.map((p) => [p.node.id, p]));

    // Draw edges first
    for (const edge of graph.edges) {
        const from = posById.get(edge.from);
        const to = posById.get(edge.to);
        if (!from || !to) continue;

        const edgeKey = canonicalEdgeKey(edge.from, edge.to);
        const isMST = mstEdges && mstEdges.has(edgeKey);
        const isTraversed = traversedEdges && traversedEdges.has(edgeKey);

        if (isMST) {
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#22c55e";
        } else if (isTraversed) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#f59e0b";
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#475569";
        }
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
        const isCurrent = currentNode === node.id;
        ctx.fillStyle = isCurrent ? "#f59e0b" : isVisited ? "#334155" : "#1d4ed8";
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#e5e7eb";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, x, y);

        if (distances) {
            const distText = Number.isFinite(distances.get(node.id))
                ? distances.get(node.id)
                : "∞";
            ctx.fillStyle = "#fcd34d";
            ctx.font = "12px system-ui";
            ctx.fillText(distText, x, y + 32);
        }
    }
}

function logStatus(msg) {
    statusEl.textContent = msg;
}

function updateWorklist() {
    if (!worklistBody || !traversalState) {
        stackContainer.style.display = "none";
        return;
    }

    worklistBody.innerHTML = "";
    const algo = getAlgorithmConfig(traversalState.type);

    if (algo.id === "dfs") {
        stackContainer.style.display = "block";
        worklistTitle.textContent = "Stack (DFS)";
        col1.textContent = "Position (Top → Bottom)";
        col2.textContent = "Node";
        col3.textContent = "Edge Weight";
        col3.style.display = "";
        worklistBody.innerHTML = "";

        const stack = traversalState.stack;
        if (!stack || stack.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">–</td><td style="padding: 4px;">Empty</td><td style="padding: 4px;">–</td>`;
            worklistBody.appendChild(row);
            return;
        }

        const labels = stack
            .map((id) => currentGraph?.getNode(id)?.label ?? id)
            .slice()
            .reverse();

        labels.forEach((label, idx) => {
            const nodeId = stack[stack.length - 1 - idx];
            const parent = traversalState.parents.get(nodeId);
            const weight =
                parent !== undefined
                    ? edgeWeightBetween(currentGraph, parent, nodeId)
                    : null;
            const weightText = weight != null ? weight : "–";
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">${idx + 1}</td><td style="padding: 4px;">${label}</td><td style="padding: 4px;">${weightText}</td>`;
            worklistBody.appendChild(row);
        });
        return;
    }

    if (algo.id === "bfs") {
        stackContainer.style.display = "block";
        worklistTitle.textContent = "Queue (BFS)";
        col1.textContent = "Position (Front → Back)";
        col2.textContent = "Node";
        col3.textContent = "Edge Weight";
        col3.style.display = "";
        const queue = traversalState.queue || [];
        if (!queue.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">–</td><td style="padding: 4px;">Empty</td><td style="padding: 4px;">–</td>`;
            worklistBody.appendChild(row);
            return;
        }
        queue.forEach((id, idx) => {
            const label = currentGraph?.getNode(id)?.label ?? id;
            const parent = traversalState.parents.get(id);
            const weight = parent !== undefined ? edgeWeightBetween(currentGraph, parent, id) : null;
            const weightText = weight != null ? weight : "–";
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">${idx + 1}</td><td style="padding: 4px;">${label}</td><td style="padding: 4px;">${weightText}</td>`;
            worklistBody.appendChild(row);
        });
        return;
    }

    if (algo.id === "prim") {
        stackContainer.style.display = "block";
        worklistTitle.textContent = "Priority Queue (Prim)";
        col1.textContent = "Order (Next → Later)";
        col2.textContent = "Edge";
        col3.textContent = "Weight";
        col3.style.display = "";

        const queue = traversalState.queue || [];
        if (!queue.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">–</td><td style="padding: 4px;">Empty</td><td style="padding: 4px;">–</td>`;
            worklistBody.appendChild(row);
            return;
        }

        queue.forEach((entry, idx) => {
            const fromLabel = currentGraph?.getNode(entry.from)?.label ?? entry.from;
            const toLabel = currentGraph?.getNode(entry.to)?.label ?? entry.to;
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">${idx + 1}</td><td style="padding: 4px;">${fromLabel} → ${toLabel}</td><td style="padding: 4px;">${entry.weight}</td>`;
            worklistBody.appendChild(row);
        });
        return;
    }

    if (algo.id === "kruskal") {
        stackContainer.style.display = "block";
        worklistTitle.textContent = "Edges (Kruskal order)";
        col1.textContent = "Order (Next → Later)";
        col2.textContent = "Edge";
        col3.textContent = "Weight";
        col3.style.display = "";

        const remaining = traversalState.remainingEdges || [];
        if (!remaining.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">–</td><td style="padding: 4px;">Empty</td><td style="padding: 4px;">–</td>`;
            worklistBody.appendChild(row);
            return;
        }

        remaining.forEach((entry, idx) => {
            const fromLabel = currentGraph?.getNode(entry.from)?.label ?? entry.from;
            const toLabel = currentGraph?.getNode(entry.to)?.label ?? entry.to;
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">${idx + 1}</td><td style="padding: 4px;">${fromLabel} – ${toLabel}</td><td style="padding: 4px;">${entry.weight}</td>`;
            worklistBody.appendChild(row);
        });
        return;
    }

    if (algo.id === "dijkstra") {
        stackContainer.style.display = "block";
        worklistTitle.textContent = "Priority Queue (Dijkstra)";
        col1.textContent = "Order (Next → Later)";
        col2.textContent = "Node";
        col3.textContent = "Distance";
        col3.style.display = "";
        const queue = traversalState.queue || [];
        if (!queue.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">–</td><td style="padding: 4px;">Empty</td><td style="padding: 4px;">–</td>`;
            worklistBody.appendChild(row);
            return;
        }
        queue.forEach((entry, idx) => {
            const label = currentGraph?.getNode(entry.id)?.label ?? entry.id;
            const distText = Number.isFinite(entry.dist) ? entry.dist : "∞";
            const row = document.createElement("tr");
            row.innerHTML = `<td style="padding: 4px;">${idx + 1}</td><td style="padding: 4px;">${label}</td><td style="padding: 4px;">${distText}</td>`;
            worklistBody.appendChild(row);
        });
        return;
    }

    stackContainer.style.display = "none";
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

function buildWeightedAdjacency(graph) {
    const adj = new Map();
    for (const node of graph.nodes) {
        adj.set(node.id, []);
    }
    for (const edge of graph.edges) {
        adj.get(edge.from).push({ to: edge.to, weight: edge.weight });
        adj.get(edge.to).push({ to: edge.from, weight: edge.weight });
    }
    for (const list of adj.values()) {
        list.sort((a, b) => a.to - b.to);
    }
    return adj;
}

function canonicalEdgeKey(a, b) {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return `${low}-${high}`;
}

function edgeWeightBetween(graph, a, b) {
    for (const edge of graph.edges) {
        if (
            (edge.from === a && edge.to === b) ||
            (edge.from === b && edge.to === a)
        ) {
            return edge.weight;
        }
    }
    return null;
}

function enqueueByDistance(queue, item) {
    const idx = queue.findIndex((entry) => item.dist < entry.dist);
    if (idx === -1) {
        queue.push(item);
    } else {
        queue.splice(idx, 0, item);
    }
}

function enqueueEdgeByWeight(queue, edge) {
    const idx = queue.findIndex((entry) => edge.weight < entry.weight);
    if (idx === -1) {
        queue.push(edge);
    } else {
        queue.splice(idx, 0, edge);
    }
}

function startDFSTraversal(graph) {
    const startNode = graph.nodes[0]?.id ?? 0;
    traversalState = {
        type: "dfs",
        graph,
        stack: [startNode],
        stackSet: new Set([startNode]),
        visited: new Set(),
        adjacency: buildAdjacency(graph),
        parents: new Map(),
        edgesTraversed: new Set(),
        finished: false
    };
    logStatus(`Starting DFS from ${graph.getNode(startNode)?.label ?? startNode}.`);
    updateWorklist();
    drawGraph();
}

function stepDFS() {
    if (traversalState.stack.length === 0) {
        traversalState.finished = true;
        logStatus("DFS complete.");
        updateWorklist();
        drawGraph();
        return;
    }

    const nodeId = traversalState.stack.pop();
    traversalState.stackSet.delete(nodeId);
    if (traversalState.visited.has(nodeId)) {
        logStatus(`Skipping already visited ${currentGraph.getNode(nodeId)?.label ?? nodeId}.`);
        updateWorklist();
        drawGraph();
        return;
    }

    traversalState.visited.add(nodeId);
    const parent = traversalState.parents.get(nodeId);
    if (parent !== undefined) {
        traversalState.edgesTraversed.add(canonicalEdgeKey(parent, nodeId));
    }

    const neighbors = traversalState.adjacency.get(nodeId) ?? [];
    // Push neighbors in reverse so smaller ids are processed first
    for (let i = neighbors.length - 1; i >= 0; i--) {
        const n = neighbors[i];
        if (!traversalState.visited.has(n) && !traversalState.stackSet.has(n)) {
            traversalState.stack.push(n);
            traversalState.stackSet.add(n);
            if (!traversalState.parents.has(n)) {
                traversalState.parents.set(n, nodeId);
            }
        }
    }

    logStatus(`Visited ${currentGraph.getNode(nodeId)?.label ?? nodeId}.`);
    updateWorklist();
    drawGraph();
}

function startBFSTraversal(graph) {
    const startNode = graph.nodes[0]?.id ?? 0;
    traversalState = {
        type: "bfs",
        graph,
        queue: [startNode],
        queueSet: new Set([startNode]),
        visited: new Set(),
        adjacency: buildAdjacency(graph),
        parents: new Map(),
        edgesTraversed: new Set(),
        edgesMST: new Set(),
        finished: false
    };
    logStatus(`Starting BFS from ${graph.getNode(startNode)?.label ?? startNode}.`);
    updateWorklist();
    drawGraph();
}

function stepBFS() {
    if (traversalState.queue.length === 0) {
        traversalState.finished = true;
        logStatus("BFS complete.");
        updateWorklist();
        drawGraph();
        return;
    }

    const nodeId = traversalState.queue.shift();
    traversalState.queueSet.delete(nodeId);
    if (traversalState.visited.has(nodeId)) {
        logStatus(`Skipping already visited ${currentGraph.getNode(nodeId)?.label ?? nodeId}.`);
        updateWorklist();
        drawGraph();
        return;
    }

    traversalState.visited.add(nodeId);
    const parent = traversalState.parents.get(nodeId);
    if (parent !== undefined) {
        traversalState.edgesTraversed.add(canonicalEdgeKey(parent, nodeId));
    }

    const neighbors = traversalState.adjacency.get(nodeId) ?? [];
    for (const n of neighbors) {
        if (!traversalState.visited.has(n) && !traversalState.queueSet.has(n)) {
            traversalState.queue.push(n);
            traversalState.queueSet.add(n);
            if (!traversalState.parents.has(n)) {
                traversalState.parents.set(n, nodeId);
            }
        }
    }

    logStatus(`Visited ${currentGraph.getNode(nodeId)?.label ?? nodeId}.`);
    updateWorklist();
    drawGraph();
}

function startDijkstraTraversal(graph) {
    const startNode = graph.nodes[0]?.id ?? 0;
    const distances = new Map(graph.nodes.map((n) => [n.id, Infinity]));
    distances.set(startNode, 0);
    traversalState = {
        type: "dijkstra",
        graph,
        visited: new Set(),
        distances,
        previous: new Map(),
        queue: [{ id: startNode, dist: 0 }],
        adjacency: buildWeightedAdjacency(graph),
        currentNode: null,
        edgesTraversed: new Set(),
        edgesMST: new Set(),
        finished: false
    };
    logStatus(`Starting Dijkstra from ${graph.getNode(startNode)?.label ?? startNode}.`);
    updateWorklist();
    drawGraph();
}

function startPrimTraversal(graph) {
    const startNode = graph.nodes[0]?.id ?? 0;
    const visited = new Set([startNode]);
    const adjacency = buildWeightedAdjacency(graph);
    const queue = [];
    for (const edge of adjacency.get(startNode) || []) {
        enqueueEdgeByWeight(queue, { from: startNode, to: edge.to, weight: edge.weight });
    }
    traversalState = {
        type: "prim",
        graph,
        visited,
        adjacency,
        queue,
        edgesTraversed: new Set(),
        edgesMST: new Set(),
        finished: false
    };
    logStatus(`Starting Prim from ${graph.getNode(startNode)?.label ?? startNode}.`);
    updateWorklist();
    drawGraph();
}

function startKruskalTraversal(graph) {
    const edges = graph.edges
        .map((e) => ({ ...e }))
        .sort((a, b) => a.weight - b.weight);
    const parent = new Map(graph.nodes.map((n) => [n.id, n.id]));
    const rank = new Map(graph.nodes.map((n) => [n.id, 0]));

    traversalState = {
        type: "kruskal",
        graph,
        remainingEdges: edges,
        parent,
        rank,
        edgesMST: new Set(),
        edgesTraversed: new Set(),
        finished: false
    };
    logStatus("Starting Kruskal; edges sorted by weight.");
    updateWorklist();
    drawGraph();
}

function stepDijkstra() {
    while (traversalState.queue.length > 0) {
        const node = traversalState.queue.shift();
        if (traversalState.visited.has(node.id)) continue;

        traversalState.currentNode = node.id;
        traversalState.visited.add(node.id);

        const neighbors = traversalState.adjacency.get(node.id) ?? [];
        const updates = [];
        for (const neighbor of neighbors) {
            if (traversalState.visited.has(neighbor.to)) continue;
            const currentDist = traversalState.distances.get(node.id);
            const candidate = currentDist + neighbor.weight;
            if (candidate < traversalState.distances.get(neighbor.to)) {
                traversalState.distances.set(neighbor.to, candidate);
                traversalState.previous.set(neighbor.to, node.id);
                enqueueByDistance(traversalState.queue, { id: neighbor.to, dist: candidate });
                traversalState.edgesTraversed.add(canonicalEdgeKey(node.id, neighbor.to));
                updates.push(`${currentGraph.getNode(neighbor.to)?.label ?? neighbor.to}=${candidate}`);
            }
        }

        const nodeLabel = currentGraph.getNode(node.id)?.label ?? node.id;
        if (updates.length > 0) {
            logStatus(`Processed ${nodeLabel}; updated ${updates.join(", ")}.`);
        } else {
            logStatus(`Processed ${nodeLabel}; no updates.`);
        }
        updateWorklist();
        drawGraph();
        return;
    }

    traversalState.finished = true;
    traversalState.currentNode = null;
    logStatus("Dijkstra complete. Shortest paths computed.");
    updateWorklist();
    drawGraph();
}

function stepPrim() {
    if (traversalState.queue.length === 0) {
        traversalState.finished = true;
        logStatus("Prim complete. MST built.");
        updateWorklist();
        drawGraph();
        return;
    }

    const edge = traversalState.queue.shift();
    if (traversalState.visited.has(edge.to)) {
        updateWorklist();
        drawGraph();
        return;
    }

    traversalState.visited.add(edge.to);
    traversalState.edgesMST.add(canonicalEdgeKey(edge.from, edge.to));

    const neighbors = traversalState.adjacency.get(edge.to) || [];
    for (const n of neighbors) {
        if (!traversalState.visited.has(n.to)) {
            enqueueEdgeByWeight(traversalState.queue, { from: edge.to, to: n.to, weight: n.weight });
        }
    }

    const fromLabel = currentGraph.getNode(edge.from)?.label ?? edge.from;
    const toLabel = currentGraph.getNode(edge.to)?.label ?? edge.to;
    logStatus(`Added edge ${fromLabel}–${toLabel} (w=${edge.weight}) to MST.`);
    updateWorklist();
    drawGraph();
}

function findRoot(nodeId, parent) {
    if (parent.get(nodeId) !== nodeId) {
        parent.set(nodeId, findRoot(parent.get(nodeId), parent));
    }
    return parent.get(nodeId);
}

function unionSets(a, b, parent, rank) {
    const rootA = findRoot(a, parent);
    const rootB = findRoot(b, parent);
    if (rootA === rootB) return false;

    const rankA = rank.get(rootA);
    const rankB = rank.get(rootB);
    if (rankA < rankB) {
        parent.set(rootA, rootB);
    } else if (rankA > rankB) {
        parent.set(rootB, rootA);
    } else {
        parent.set(rootB, rootA);
        rank.set(rootA, rankA + 1);
    }
    return true;
}

function stepKruskal() {
    if (traversalState.remainingEdges.length === 0 || traversalState.edgesMST.size >= currentGraph.nodes.length - 1) {
        traversalState.finished = true;
        logStatus("Kruskal complete. MST built or no more edges.");
        updateWorklist();
        drawGraph();
        return;
    }

    const edge = traversalState.remainingEdges.shift();
    const added = unionSets(edge.from, edge.to, traversalState.parent, traversalState.rank);
    if (added) {
        traversalState.edgesMST.add(canonicalEdgeKey(edge.from, edge.to));
        traversalState.edgesTraversed.add(canonicalEdgeKey(edge.from, edge.to));
        const fromLabel = currentGraph.getNode(edge.from)?.label ?? edge.from;
        const toLabel = currentGraph.getNode(edge.to)?.label ?? edge.to;
        logStatus(`Added edge ${fromLabel}–${toLabel} (w=${edge.weight}) to MST.`);
    } else {
        traversalState.edgesTraversed.add(canonicalEdgeKey(edge.from, edge.to));
        const fromLabel = currentGraph.getNode(edge.from)?.label ?? edge.from;
        const toLabel = currentGraph.getNode(edge.to)?.label ?? edge.to;
        logStatus(`Skipped edge ${fromLabel}–${toLabel} (w=${edge.weight}) to avoid cycle.`);
    }

    updateWorklist();
    drawGraph();
}

function startTraversal(algo, graph) {
    if (algo.id === "dfs") {
        startDFSTraversal(graph);
        return;
    }

    if (algo.id === "bfs") {
        startBFSTraversal(graph);
        return;
    }

    if (algo.id === "dijkstra") {
        startDijkstraTraversal(graph);
        return;
    }

    if (algo.id === "prim") {
        startPrimTraversal(graph);
        return;
    }

    if (algo.id === "kruskal") {
        startKruskalTraversal(graph);
        return;
    }

    traversalState = null;
    logStatus(`Step not implemented for ${algo.label} yet.`);
    updateWorklist();
    drawGraph();
}

function stepTraversal() {
    if (!currentGraph) {
        logStatus("Generate a graph first.");
        return;
    }
    const algo = getAlgorithmConfig(algoSelect.value);
    if (!traversalState || traversalState.graph !== currentGraph || traversalState.type !== algo.id) {
        startTraversal(algo, currentGraph);
        if (!traversalState || traversalState.type !== algo.id) return;
    }

    if (traversalState.finished) {
        return;
    }

    if (traversalState.type === "dfs") {
        stepDFS();
        return;
    }

    if (traversalState.type === "bfs") {
        stepBFS();
        return;
    }

    if (traversalState.type === "dijkstra") {
        stepDijkstra();
        return;
    }

    if (traversalState.type === "prim") {
        stepPrim();
        return;
    }

    if (traversalState.type === "kruskal") {
        stepKruskal();
        return;
    }

    logStatus(`Step not implemented for ${algo.label} yet.`);
}

function stopAutoRun() {
    if (autoRunInterval) {
        clearInterval(autoRunInterval);
        autoRunInterval = null;
    }
}

function runTraversal() {
    if (!currentGraph) {
        logStatus("Generate a graph first.");
        return;
    }
    stopAutoRun();

    const algo = getAlgorithmConfig(algoSelect.value);
    if (!traversalState || traversalState.graph !== currentGraph || traversalState.type !== algo.id) {
        startTraversal(algo, currentGraph);
        if (!traversalState || traversalState.type !== algo.id) return;
    }

    autoRunInterval = setInterval(() => {
        if (!traversalState || traversalState.finished) {
            stopAutoRun();
            return;
        }
        stepTraversal();
        if (traversalState?.finished) {
            stopAutoRun();
        }
    }, 250);
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
    stopAutoRun();
    const { graph, algo } = createGraphForSelection();
    currentGraph = graph;
    traversalState = null;
    updateWorklist();
    drawGraph();
    const edgeCount = currentGraph.edges.length;
    logStatus(`Generated ${currentGraph.nodes.length} nodes and ${edgeCount} edges for ${algo.label}.`);
}

// Button handlers
btnGenerate.addEventListener("click", () => {
    generateAndDraw();
});

btnStep.addEventListener("click", () => {
    stopAutoRun();
    stepTraversal();
});

algoSelect.addEventListener("change", () => {
    stopAutoRun();
    // Hide stack when not DFS
    updateWorklist();
});

edgeWeightsCheckbox.addEventListener("change", () => {
    const algo = getAlgorithmConfig(algoSelect.value);
    const showWeights = edgeWeightsCheckbox.checked || algo.forceWeights;
    if (currentGraph) {
        currentGraph.showWeights = showWeights;
        traversalState = null;
        logStatus("Edge weight display updated; regenerate to change weights on edges.");
        drawGraph();
    }
});

btnRun.addEventListener("click", () => {
    runTraversal();
});

btnReset.addEventListener("click", () => {
    stopAutoRun();
    currentGraph = null;
    traversalState = null;
    logStatus("Cleared graph; click Generate to create a new one.");
    updateWorklist();
    drawGraph();
});

// Optional: show version from preload
if (window.appInfo) {
    const verEl = document.getElementById("app-version");
    verEl.textContent = `${window.appInfo.name} v${window.appInfo.version}`;
}

// Kick things off with an initial graph
generateAndDraw();
