const graph = document.querySelector('#graph');
const edgeLayer = document.querySelector('#edges');
const hint = document.querySelector('#hint');
const nodeCountInput = document.querySelector('#node-count');
const createButton = document.querySelector('#create-network');
const clearButton = document.querySelector('#clear-edges');

let selectedNode = null;
let edges = new Set();

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
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
  hint.textContent = 'Alle Kanten gelöscht. Du kannst neue Kanten zeichnen.';
});

createNodes(Number(nodeCountInput.value));
