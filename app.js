const graph = document.querySelector('#graph');
const edgeLayer = document.querySelector('#edges');
const hint = document.querySelector('#hint');
const nodeCountInput = document.querySelector('#node-count');
const createButton = document.querySelector('#create-network');
const clearButton = document.querySelector('#clear-edges');
const workspace = document.querySelector('.workspace');
const toggleMetricsButton = document.querySelector('#toggle-metrics');
const globalMetricsList = document.querySelector('#global-metrics');
const nodeMetricsBody = document.querySelector('#node-metrics-body');

let selectedNode = null;
let edges = new Set();

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getNodeIds() {
  return Array.from(document.querySelectorAll('.node')).map((node) => Number(node.dataset.id));
}

function buildAdjacency(nodeIds) {
  const adjacency = new Map(nodeIds.map((id) => [id, new Set()]));

  edges.forEach((key) => {
    const [a, b] = key.split('-').map(Number);
    if (adjacency.has(a) && adjacency.has(b)) {
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    }
  });

  return adjacency;
}

function computeLocalClusteringCoefficient(nodeId, adjacency) {
  const neighbors = Array.from(adjacency.get(nodeId));
  const k = neighbors.length;

  if (k < 2) {
    return 0;
  }

  let linkedNeighbors = 0;
  for (let i = 0; i < neighbors.length; i += 1) {
    for (let j = i + 1; j < neighbors.length; j += 1) {
      if (adjacency.get(neighbors[i]).has(neighbors[j])) {
        linkedNeighbors += 1;
      }
    }
  }

  const possibleNeighborLinks = (k * (k - 1)) / 2;
  return linkedNeighbors / possibleNeighborLinks;
}

function bfsDistances(startId, adjacency) {
  const visited = new Set([startId]);
  const queue = [{ id: startId, dist: 0 }];
  const distances = new Map([[startId, 0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    adjacency.get(current.id).forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const distance = current.dist + 1;
        distances.set(neighbor, distance);
        queue.push({ id: neighbor, dist: distance });
      }
    });
  }

  return distances;
}

function renderMetrics() {
  const nodeIds = getNodeIds();
  const adjacency = buildAdjacency(nodeIds);

  nodeMetricsBody.innerHTML = '';

  let clusteringSum = 0;
  nodeIds.forEach((nodeId) => {
    const degree = adjacency.get(nodeId).size;
    const localClustering = computeLocalClusteringCoefficient(nodeId, adjacency);
    clusteringSum += localClustering;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${nodeId}</td>
      <td>${degree}</td>
      <td>${localClustering.toFixed(3)}</td>
    `;
    nodeMetricsBody.appendChild(row);
  });

  let distanceSum = 0;
  let reachablePairCount = 0;
  let diameter = 0;

  nodeIds.forEach((startId, index) => {
    const distances = bfsDistances(startId, adjacency);
    for (let i = index + 1; i < nodeIds.length; i += 1) {
      const targetId = nodeIds[i];
      if (distances.has(targetId)) {
        const distance = distances.get(targetId);
        distanceSum += distance;
        reachablePairCount += 1;
        diameter = Math.max(diameter, distance);
      }
    }
  });

  const averagePathLength = reachablePairCount > 0 ? distanceSum / reachablePairCount : 0;
  const averageClustering = nodeIds.length > 0 ? clusteringSum / nodeIds.length : 0;
  const allPairs = (nodeIds.length * (nodeIds.length - 1)) / 2;
  const disconnected = reachablePairCount < allPairs;

  globalMetricsList.innerHTML = `
    <li><strong>Average path length:</strong> ${averagePathLength.toFixed(3)}${
    disconnected ? ' (nur verbundene Paare)' : ''
  }</li>
    <li><strong>Average clustering coefficient:</strong> ${averageClustering.toFixed(3)}</li>
    <li><strong>Network diameter:</strong> ${diameter}</li>
  `;
}

function clearSelection() {
  document.querySelectorAll('.node.selected').forEach((node) => {
    node.classList.remove('selected');
  });
  selectedNode = null;
}

function drawEdges() {
  edgeLayer.innerHTML = '';
  const nodes = Array.from(document.querySelectorAll('.node'));

  edges.forEach((key) => {
    const [a, b] = key.split('-');
    const nodeA = nodes.find((node) => node.dataset.id === a);
    const nodeB = nodes.find((node) => node.dataset.id === b);

    if (!nodeA || !nodeB) {
      return;
    }

    const x1 = Number(nodeA.style.left.replace('%', ''));
    const y1 = Number(nodeA.style.top.replace('%', ''));
    const x2 = Number(nodeB.style.left.replace('%', ''));
    const y2 = Number(nodeB.style.top.replace('%', ''));

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('edge');
    line.setAttribute('x1', `${x1}%`);
    line.setAttribute('y1', `${y1}%`);
    line.setAttribute('x2', `${x2}%`);
    line.setAttribute('y2', `${y2}%`);
    edgeLayer.appendChild(line);
  });
}

function handleNodeClick(event) {
  const node = event.currentTarget;

  if (!selectedNode) {
    selectedNode = node;
    node.classList.add('selected');
    hint.textContent = `Knoten ${node.dataset.id} gewählt. Jetzt zweiten Knoten anklicken.`;
    return;
  }

  if (selectedNode === node) {
    clearSelection();
    hint.textContent = 'Auswahl aufgehoben. Wähle wieder Knoten A und Knoten B.';
    return;
  }

  const a = Number(selectedNode.dataset.id);
  const b = Number(node.dataset.id);
  const key = edgeKey(a, b);

  if (!edges.has(key)) {
    edges.add(key);
    hint.textContent = `Kante zwischen ${a} und ${b} gezeichnet.`;
  } else {
    hint.textContent = `Kante zwischen ${a} und ${b} existiert bereits.`;
  }

  clearSelection();
  drawEdges();
  renderMetrics();
}

function createNodes(totalNodes) {
  document.querySelectorAll('.node').forEach((node) => node.remove());
  edges = new Set();
  edgeLayer.innerHTML = '';
  clearSelection();

  const radius = 36;
  const centerX = 50;
  const centerY = 50;

  for (let index = 0; index < totalNodes; index += 1) {
    const angle = (2 * Math.PI * index) / totalNodes;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    const node = document.createElement('button');
    node.className = 'node';
    node.type = 'button';
    node.textContent = index + 1;
    node.dataset.id = String(index + 1);
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.addEventListener('click', handleNodeClick);
    graph.appendChild(node);
  }

  hint.textContent = `Netzwerk mit ${totalNodes} Knoten erstellt. Klicke auf zwei Knoten, um eine Kante zu zeichnen.`;
  renderMetrics();
}

createButton.addEventListener('click', () => {
  const requestedNodes = Number(nodeCountInput.value);
  if (Number.isNaN(requestedNodes) || requestedNodes < 2 || requestedNodes > 20) {
    hint.textContent = 'Bitte gib eine Anzahl zwischen 2 und 20 Knoten ein.';
    return;
  }

  createNodes(requestedNodes);
});

clearButton.addEventListener('click', () => {
  edges = new Set();
  drawEdges();
  clearSelection();
  renderMetrics();
  hint.textContent = 'Alle Kanten gelöscht. Du kannst neue Kanten zeichnen.';
});

toggleMetricsButton.addEventListener('click', () => {
  const isOpen = workspace.classList.contains('sidebar-open');
  workspace.classList.toggle('sidebar-open', !isOpen);
  workspace.classList.toggle('sidebar-closed', isOpen);
  toggleMetricsButton.textContent = isOpen ? 'Metriken ausklappen' : 'Metriken einklappen';
  toggleMetricsButton.setAttribute('aria-expanded', String(!isOpen));
});

createNodes(Number(nodeCountInput.value));
