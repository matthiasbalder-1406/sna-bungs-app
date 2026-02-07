const graph = document.querySelector('#graph');
const edgeLayer = document.querySelector('#edges');
const hint = document.querySelector('#hint');
const nodeCountInput = document.querySelector('#node-count');
const graphTypeSelect = document.querySelector('#graph-type');
const createButton = document.querySelector('#create-network');
const clearButton = document.querySelector('#clear-edges');
const workspace = document.querySelector('.workspace');
const toggleMetricsButton = document.querySelector('#toggle-metrics');
const globalMetricsList = document.querySelector('#global-metrics');
const nodeMetricsBody = document.querySelector('#node-metrics-body');
const inDegreeHeader = document.querySelector('#in-degree-header');
const outDegreeHeader = document.querySelector('#out-degree-header');

let selectedNode = null;
let edges = new Set();

function isDirectedMode() {
  return graphTypeSelect.value === 'directed';
}

function edgeKey(a, b) {
  if (isDirectedMode()) {
    return `${a}>${b}`;
  }
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function parseEdgeKey(key) {
  if (key.includes('>')) {
    const [from, to] = key.split('>').map(Number);
    return { from, to };
  }
  const [a, b] = key.split('-').map(Number);
  return { from: a, to: b };
}

function getNodeIds() {
  return Array.from(document.querySelectorAll('.node')).map((node) => Number(node.dataset.id));
}

function buildAdjacency(nodeIds) {
  const adjacency = new Map(nodeIds.map((id) => [id, new Set()]));

  edges.forEach((key) => {
    const { from, to } = parseEdgeKey(key);
    if (!adjacency.has(from) || !adjacency.has(to)) {
      return;
    }

    adjacency.get(from).add(to);
    if (!isDirectedMode()) {
      adjacency.get(to).add(from);
    }
  });

  return adjacency;
}

function buildUndirectedNeighborMap(nodeIds) {
  const neighborMap = new Map(nodeIds.map((id) => [id, new Set()]));

  edges.forEach((key) => {
    const { from, to } = parseEdgeKey(key);
    if (neighborMap.has(from) && neighborMap.has(to)) {
      neighborMap.get(from).add(to);
      neighborMap.get(to).add(from);
    }
  });

  return neighborMap;
}

function computeInOutDegrees(nodeIds) {
  const inDegree = new Map(nodeIds.map((id) => [id, 0]));
  const outDegree = new Map(nodeIds.map((id) => [id, 0]));

  edges.forEach((key) => {
    const { from, to } = parseEdgeKey(key);
    if (!inDegree.has(from) || !inDegree.has(to)) {
      return;
    }

    if (isDirectedMode()) {
      outDegree.set(from, outDegree.get(from) + 1);
      inDegree.set(to, inDegree.get(to) + 1);
    } else {
      outDegree.set(from, outDegree.get(from) + 1);
      outDegree.set(to, outDegree.get(to) + 1);
      inDegree.set(from, inDegree.get(from) + 1);
      inDegree.set(to, inDegree.get(to) + 1);
    }
  });

  return { inDegree, outDegree };
}

function computeLocalClusteringCoefficient(nodeId, undirectedNeighbors) {
  const neighbors = Array.from(undirectedNeighbors.get(nodeId));
  const k = neighbors.length;

  if (k < 2) {
    return 0;
  }

  let linkedNeighbors = 0;
  for (let i = 0; i < neighbors.length; i += 1) {
    for (let j = i + 1; j < neighbors.length; j += 1) {
      if (undirectedNeighbors.get(neighbors[i]).has(neighbors[j])) {
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

function formatFraction(numerator, denominator) {
  if (denominator === 0) {
    return '0/1';
  }
  return `${numerator}/${denominator}`;
}

function computeBetweennessCentrality(nodeIds, adjacency) {
  const betweennessRaw = new Map(nodeIds.map((id) => [id, 0]));

  nodeIds.forEach((source) => {
    const stack = [];
    const predecessors = new Map(nodeIds.map((id) => [id, []]));
    const sigma = new Map(nodeIds.map((id) => [id, 0]));
    const distance = new Map(nodeIds.map((id) => [id, -1]));

    sigma.set(source, 1);
    distance.set(source, 0);

    const queue = [source];
    while (queue.length > 0) {
      const vertex = queue.shift();
      stack.push(vertex);

      adjacency.get(vertex).forEach((neighbor) => {
        if (distance.get(neighbor) < 0) {
          queue.push(neighbor);
          distance.set(neighbor, distance.get(vertex) + 1);
        }

        if (distance.get(neighbor) === distance.get(vertex) + 1) {
          sigma.set(neighbor, sigma.get(neighbor) + sigma.get(vertex));
          predecessors.get(neighbor).push(vertex);
        }
      });
    }

    const dependency = new Map(nodeIds.map((id) => [id, 0]));
    while (stack.length > 0) {
      const vertex = stack.pop();
      predecessors.get(vertex).forEach((pred) => {
        if (sigma.get(vertex) !== 0) {
          const update = (sigma.get(pred) / sigma.get(vertex)) * (1 + dependency.get(vertex));
          dependency.set(pred, dependency.get(pred) + update);
        }
      });

      if (vertex !== source) {
        betweennessRaw.set(vertex, betweennessRaw.get(vertex) + dependency.get(vertex));
      }
    }
  });

  if (!isDirectedMode()) {
    nodeIds.forEach((id) => {
      betweennessRaw.set(id, betweennessRaw.get(id) / 2);
    });
  }

  const n = nodeIds.length;
  let normalizationFactor = 0;
  if (isDirectedMode()) {
    normalizationFactor = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0;
  } else {
    normalizationFactor = n > 2 ? 2 / ((n - 1) * (n - 2)) : 0;
  }

  const betweennessNormalized = new Map(nodeIds.map((id) => [id, betweennessRaw.get(id) * normalizationFactor]));
  return { betweennessRaw, betweennessNormalized };
}

function renderMetrics() {
  const nodeIds = getNodeIds();
  const adjacency = buildAdjacency(nodeIds);
  const undirectedNeighbors = buildUndirectedNeighborMap(nodeIds);
  const { inDegree, outDegree } = computeInOutDegrees(nodeIds);
  const { betweennessRaw, betweennessNormalized } = computeBetweennessCentrality(nodeIds, adjacency);

  const directed = isDirectedMode();
  inDegreeHeader.classList.toggle('hidden', !directed);
  outDegreeHeader.classList.toggle('hidden', !directed);

  nodeMetricsBody.innerHTML = '';

  let clusteringSum = 0;
  const closenessRawFractionMap = new Map();
  const closenessNormalizedFractionMap = new Map();

  let distanceSum = 0;
  let reachablePairCount = 0;
  let diameter = 0;

  nodeIds.forEach((startId) => {
    const distances = bfsDistances(startId, adjacency);
    let closenessDistanceSum = 0;
    let closenessReachable = 0;

    nodeIds.forEach((targetId) => {
      if (targetId === startId) {
        return;
      }

      if (distances.has(targetId)) {
        const distance = distances.get(targetId);
        closenessDistanceSum += distance;
        closenessReachable += 1;

        if (directed || startId < targetId) {
          distanceSum += distance;
          reachablePairCount += 1;
          diameter = Math.max(diameter, distance);
        }
      }
    });

    if (closenessDistanceSum > 0) {
      const nMinusOne = Math.max(nodeIds.length - 1, 1);
      closenessRawFractionMap.set(startId, { numerator: 1, denominator: closenessDistanceSum });
      closenessNormalizedFractionMap.set(startId, {
        numerator: closenessReachable,
        denominator: nMinusOne * closenessDistanceSum,
      });
    } else {
      closenessRawFractionMap.set(startId, { numerator: 0, denominator: 1 });
      closenessNormalizedFractionMap.set(startId, { numerator: 0, denominator: 1 });
    }
  });

  nodeIds.forEach((nodeId) => {
    const degree = undirectedNeighbors.get(nodeId).size;
    const localClustering = computeLocalClusteringCoefficient(nodeId, undirectedNeighbors);
    const closenessRaw = closenessRawFractionMap.get(nodeId);
    const closenessNormalized = closenessNormalizedFractionMap.get(nodeId);
    clusteringSum += localClustering;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${nodeId}</td>
      <td>${degree}</td>
      ${directed ? `<td>${inDegree.get(nodeId)}</td>` : ''}
      ${directed ? `<td>${outDegree.get(nodeId)}</td>` : ''}
      <td>${localClustering.toFixed(3)}</td>
      <td>${formatFraction(closenessRaw.numerator, closenessRaw.denominator)}</td>
      <td>${formatFraction(closenessNormalized.numerator, closenessNormalized.denominator)}</td>
      <td>${betweennessRaw.get(nodeId).toFixed(3)}</td>
      <td>${betweennessNormalized.get(nodeId).toFixed(3)}</td>
    `;
    nodeMetricsBody.appendChild(row);
  });

  const averagePathLength = reachablePairCount > 0 ? distanceSum / reachablePairCount : 0;
  const averageClustering = nodeIds.length > 0 ? clusteringSum / nodeIds.length : 0;
  const allPairs = directed
    ? nodeIds.length * Math.max(nodeIds.length - 1, 0)
    : (nodeIds.length * Math.max(nodeIds.length - 1, 0)) / 2;
  const disconnected = reachablePairCount < allPairs;

  globalMetricsList.innerHTML = `
    <li><strong>Graph-Typ:</strong> ${directed ? 'Gerichtet' : 'Ungerichtet'}</li>
    <li><strong>Average path length:</strong> ${averagePathLength.toFixed(3)}${
    disconnected ? ' (nur erreichbare Paare)' : ''
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
  edgeLayer.querySelectorAll('.edge').forEach((edge) => edge.remove());
  const nodes = Array.from(document.querySelectorAll('.node'));

  edges.forEach((key) => {
    const { from, to } = parseEdgeKey(key);
    const nodeA = nodes.find((node) => Number(node.dataset.id) === from);
    const nodeB = nodes.find((node) => Number(node.dataset.id) === to);

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

    if (isDirectedMode()) {
      line.setAttribute('marker-end', 'url(#arrowhead)');
    }

    edgeLayer.appendChild(line);
  });
}

function handleNodeClick(event) {
  const node = event.currentTarget;

  if (!selectedNode) {
    selectedNode = node;
    node.classList.add('selected');
    hint.textContent = isDirectedMode()
      ? `Startknoten ${node.dataset.id} gewählt. Jetzt Zielknoten anklicken.`
      : `Knoten ${node.dataset.id} gewählt. Jetzt zweiten Knoten anklicken.`;
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
    hint.textContent = isDirectedMode()
      ? `Gerichtete Kante ${a} → ${b} gezeichnet.`
      : `Kante zwischen ${a} und ${b} gezeichnet.`;
  } else {
    hint.textContent = isDirectedMode()
      ? `Gerichtete Kante ${a} → ${b} existiert bereits.`
      : `Kante zwischen ${a} und ${b} existiert bereits.`;
  }

  clearSelection();
  drawEdges();
  renderMetrics();
}

function createNodes(totalNodes) {
  document.querySelectorAll('.node').forEach((node) => node.remove());
  edges = new Set();
  edgeLayer.querySelectorAll('.edge').forEach((edge) => edge.remove());
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

  hint.textContent = `Netzwerk mit ${totalNodes} Knoten erstellt (${isDirectedMode() ? 'gerichtet' : 'ungerichtet'}).`;
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

graphTypeSelect.addEventListener('change', () => {
  const totalNodes = getNodeIds().length || Number(nodeCountInput.value);
  createNodes(totalNodes);
});

toggleMetricsButton.addEventListener('click', () => {
  const isOpen = workspace.classList.contains('sidebar-open');
  workspace.classList.toggle('sidebar-open', !isOpen);
  workspace.classList.toggle('sidebar-closed', isOpen);
  toggleMetricsButton.textContent = isOpen ? 'Metriken ausklappen' : 'Metriken einklappen';
  toggleMetricsButton.setAttribute('aria-expanded', String(!isOpen));
});

createNodes(Number(nodeCountInput.value));
