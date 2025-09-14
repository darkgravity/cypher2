// =================== UI COMPONENTS & VIEWER (STANDARDIZED TOKENS) ===================

// ---------- Ghost frame & helpers ----------
const VIEWBOX_W = 500, VIEWBOX_H = 500;

function getGhostRect() {
  const baseW = 300, baseH = 300;
  const gw = baseW * viewerScaleW;
  const gh = baseH * viewerScaleH;
  const gx = (VIEWBOX_W - gw) / 2;
  const gy = (VIEWBOX_H - gh) / 2;
  return { x: gx, y: gy, w: gw, h: gh };
}

function drawGhostFrameAndCross(svg, x, y, w, h, stroke = '#2a3441') {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute('x', x); rect.setAttribute('y', y);
  rect.setAttribute('width', w); rect.setAttribute('height', h);
  rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-dasharray', '6 6'); rect.setAttribute('stroke-width', '1.25');
  rect.setAttribute('data-ghost', '1');
  svg.appendChild(rect);

  const cx = x + w / 2, cy = y + h / 2;

  const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hLine.setAttribute('x1', x); hLine.setAttribute('y1', cy);
  hLine.setAttribute('x2', x + w); hLine.setAttribute('y2', cy);
  hLine.setAttribute('stroke', stroke); hLine.setAttribute('stroke-dasharray', '6 6'); hLine.setAttribute('stroke-width', '1.25');
  hLine.setAttribute('data-ghost', '1');
  svg.appendChild(hLine);

  const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  vLine.setAttribute('x1', cx); vLine.setAttribute('y1', y);
  vLine.setAttribute('x2', cx); vLine.setAttribute('y2', y + h);
  vLine.setAttribute('stroke', stroke); vLine.setAttribute('stroke-dasharray', '6 6'); vLine.setAttribute('stroke-width', '1.25');
  vLine.setAttribute('data-ghost', '1');
  svg.appendChild(vLine);
}

function drawGhostFrameIcon(svg) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  g.setAttribute('x', 10); g.setAttribute('y', 10);
  g.setAttribute('width', 80); g.setAttribute('height', 80);
  g.setAttribute('fill', 'none'); g.setAttribute('stroke', '#1f2733');
  g.setAttribute('stroke-dasharray', '6 6'); g.setAttribute('stroke-width', '1.25');
  svg.appendChild(g);
}

function strokeInsetForBox(w, h, sw) {
  const inset = Math.max(0, Math.ceil(sw * 2));
  const cap = Math.floor(Math.min(w, h) * 0.12);
  return Math.min(inset, cap);
}

// ---------- Icons & grids ----------
function createShapePreview(shapeKey) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.background = "#0f1216";

  drawGhostFrameIcon(svg);

  try {
    const paths = getPaths(shapeKey);
    for (const pathArr of paths) {
      const xs = pathArr.map(p => p[0]), ys = pathArr.map(p => p[1]);
      const mx = remapVals(xs, 0, 100, 10, 90), my = remapVals(ys, 0, 100, 10, 90);
      const ctrl = mx.map((vx, i) => [vx, my[i]]);
      const segs = cubicSegments(ctrl);
      for (const { d } of segs) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
        el.setAttribute("d", d);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", "#e6eef4");
        el.setAttribute("stroke-width", "2");
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");
        svg.appendChild(el);
      }
    }
  } catch (e) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("x", "15"); el.setAttribute("y", "15");
    el.setAttribute("width", "70"); el.setAttribute("height", "70");
    el.setAttribute("fill", "none"); el.setAttribute("stroke", "#666");
    svg.appendChild(el);
  }
  return svg;
}

function createTileTypePreview(tileType) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.background = "#0f1216";

  drawGhostFrameAndCross(svg, 10, 10, 80, 80, '#1f2733');

  const BBMin = { x: 10, y: 10, z: 0 };
  const BBMax = { x: 90, y: 90, z: 0 };

  // Get the background configuration for this tile type
  const bgConfig = getBgConfigForType(tileType);
  
  // Handle both old format (array) and new format (setBounds object)
  const bgList = bgConfig.tokens || bgConfig;
  
  // Parse all tokens and build the structure (similar to importDefinition)
  const parsed = bgList.map(parseStandardToken);
  const folderDefs = parsed.filter(p => p.kind === 'folderCode');
  const tileDefs = parsed.filter(p => p.kind === 'tileCode');
  
  // Create folders
  const folderObjects = {};
  folderDefs.forEach(f => {
    const fo = {
      kind: 'folder',
      id: f.ownId,
      config: {
        type: f.type || '01',
        L: f.L || 0,
        R: f.R || 0,
        T: f.T || 0,
        B: f.B || 0
      },
      children: []
    };
    folderObjects[f.ownId] = fo;
  });
  
  // Build root items array
  const rootItems = [];
  
  // Add folders to root
  Object.values(folderObjects).forEach(folder => {
    rootItems.push(folder);
  });
  
  // Add tiles to appropriate locations
  tileDefs.forEach(t => {
    const tileObj = {
      kind: 'tile',
      code9: t.raw
    };
    
    if (t.folderId === 0) {
      // Root level tile
      rootItems.push(tileObj);
    } else if (folderObjects[t.folderId]) {
      // Tile belongs to a folder
      folderObjects[t.folderId].children.push(tileObj);
    } else {
      // Folder doesn't exist, put at root
      rootItems.push(tileObj);
    }
  });
  
  // Now draw all items using the same logic as the main viewer
  rootItems.forEach(item => {
    if (item.kind === 'tile') {
      drawItemInBoxWithCorrectBBox(svg, item, BBMin, BBMax, "#ffffff", 1.3, null);
    } else if (item.kind === 'folder') {
      // Draw folder children
      (item.children || []).forEach(child => {
        if (child.kind === 'tile') {
          drawItemInBoxWithCorrectBBox(svg, child, BBMin, BBMax, "#ffffff", 1.3, item);
        }
      });
    }
  });

  return svg;
}

function currentTileSize() {
  const slider = document.getElementById('tileSizeRange');
  const value = parseFloat(slider.value || '0');  // 0..1
  return 50 + (value * 50); // 50..100
}

function calculateOptimalColumns(buttonSize) {
  const availableWidth = 598, gap = 10;
  const maxColumns = Math.floor((availableWidth + gap) / (buttonSize + gap));
  return Math.max(3, Math.min(12, maxColumns));
}

function setupShapeGrid() {
  const grid = document.getElementById('shapeGrid');
  grid.innerHTML = '';
  const tSize = currentTileSize();
  const columns = calculateOptimalColumns(tSize);
  grid.style.gridTemplateColumns = `repeat(${columns}, ${tSize}px)`;
  const shapes = Object.keys(tileShapesData);
  shapes.forEach(shape => {
    const btn = document.createElement('button'); 
    btn.className = 'tile-btn';
    btn.style.width = `${tSize}px`; 
    btn.style.height = `${tSize}px`;
    btn.onclick = () => { 
      selectShape(shape); 
      updateSelectedTileOrFolder(); 
    };
    const svg = createShapePreview(shape);
    const label = document.createElement('div'); 
    label.className = 'label'; 
    label.textContent = shape;
    btn.appendChild(svg); 
    btn.appendChild(label);
    grid.appendChild(btn);
  });
  updateShapeSelection();
}

function setupTypeGrid() {
  const grid = document.getElementById('typeGrid');
  grid.innerHTML = '';
  const tSize = currentTileSize();
  const columns = calculateOptimalColumns(tSize);
  grid.style.gridTemplateColumns = `repeat(${columns}, ${tSize}px)`;
  tileTypes.forEach(type => {
    const wrap = document.createElement('div'); 
    wrap.className = 'tile-btn-wrap';
    wrap.style.width = `${tSize}px`; 
    wrap.style.height = `${tSize}px`;
    const btn = document.createElement('button'); 
    btn.className = 'tile-btn'; 
    btn.setAttribute('data-type', type);
    const innerSize = Math.max(30, tSize - 10); 
    btn.style.width = `${innerSize}px`; 
    btn.style.height = `${innerSize}px`;
    btn.onclick = () => { 
      selectType(type);
      
      // DON'T reset slider values when just selecting a type
      // The values should persist, especially when switching between same modes
      // Only updateSelectedTileOrFolder if there's a selected tile
      const sel = getSelectedRef();
      if (sel) {
        updateSelectedTileOrFolder();
      }
    };
    const iconOverlay = document.createElement('div'); 
    iconOverlay.className = 'icon-overlay';
    const previewSvg = createTileTypePreview(type); 
    iconOverlay.appendChild(previewSvg);
    btn.appendChild(iconOverlay); 
    wrap.appendChild(btn); 
    grid.appendChild(wrap);
  });
  updateTypeSelection();
}

function refreshIconGrids() {
  setupShapeGrid();
  setupTypeGrid();
  updateShapeSelection();
  updateTypeSelection();
}

function updateShapeSelection() {
  const shapes = Object.keys(tileShapesData);
  document.querySelectorAll('#shapeGrid .tile-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', shapes[i] === selectedShape);
  });
}

function updateTypeSelection() {
  document.querySelectorAll('#typeGrid .tile-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.getAttribute('data-type') === selectedType);
  });
}

function selectShape(shape) { 
  selectedShape = shape; 
  updateShapeSelection(); 
}

function selectType(type) { 
  selectedType = type; 
  updateTypeSelection();
  
  // Update slider visibility based on the selected type's bounds configuration
  const bgConfig = getBgConfigForType(type);
  if (bgConfig && bgConfig.mode) {
    updateSliderVisibility(bgConfig.mode);
    
    // Update the bottom label for RAD mode
    const B = document.getElementById('bottomRange');
    if (bgConfig.mode === "RAD") {
      document.getElementById('labelBottom').textContent = 'R:' + B.value;
    } else {
      document.getElementById('labelBottom').textContent = 'B:' + B.value;
    }
  } else {
    // Default to all visible if no configuration
    updateSliderVisibility("LTRB");
  }
}

// ---------- Overlay controls / selection sync - FIXED for immediate updates ----------
function setupOverlayControls() {
  const map = [
    ['leftRange', 'labelLeft'],
    ['rightRange', 'labelRight'],
    ['topRange', 'labelTop'],
    ['bottomRange', 'labelBottom']
  ];
  
  map.forEach(([rid, lid]) => {
    const r = document.getElementById(rid);
    
    // Use 'input' event for real-time updates while sliding
    r.addEventListener('input', () => {
      const prefix = rid === 'leftRange' ? 'L:' : rid === 'rightRange' ? 'R:' : rid === 'topRange' ? 'T:' : 'B:';
      document.getElementById(lid).textContent = prefix + r.value;
      
      // Immediately update the selected tile/folder
      if (typeof updateSelectedTileOrFolder === 'function') {
        updateSelectedTileOrFolder();
      }
    });
    
    // Also handle 'change' event for when user releases the slider
    r.addEventListener('change', () => {
      if (typeof updateSelectedTileOrFolder === 'function') {
        updateSelectedTileOrFolder();
      }
    });
  });
}

function updateOverlayFromSelection() {
  const L = document.getElementById('leftRange');
  const R = document.getElementById('rightRange');
  const T = document.getElementById('topRange');
  const B = document.getElementById('bottomRange');
  const sel = getSelectedRef();
  
  // Reset visibility to defaults
  document.querySelector('.overlay-left').style.display = 'flex';
  document.querySelector('.overlay-right').style.display = 'flex';
  document.querySelector('.overlay-top').style.display = 'flex';
  document.querySelector('.overlay-bottom').style.display = 'flex';
  document.getElementById('labelBottom').textContent = 'B:' + B.value;
  
  if (sel) {
    if (sel.kind === 'tile') {
      const code9 = sel.code9 || 'O101000000';
      const parsed = parseStandardToken(code9);
      if (parsed.kind === 'tileCode') {
        selectedShape = parsed.shape;
        selectedType = parsed.type;
        
        // Always use the tile's stored values
        L.value = parsed.L;
        R.value = parsed.R;
        T.value = parsed.T;
        B.value = parsed.B;
        
        // Get the bounds configuration for this tile type
        const bgConfig = getBgConfigForType(selectedType);
        if (bgConfig && bgConfig.mode) {
          // Apply slider visibility based on mode
          updateSliderVisibility(bgConfig.mode);
        }
      }
    } else if (sel.kind === 'folder' && selected.kind === 'folder') {
      selectedShape = 'O1';
      selectedType = sel.config.type || '01';
      L.value = sel.config.L || 0; 
      R.value = sel.config.R || 0; 
      T.value = sel.config.T || 0; 
      B.value = sel.config.B || 0;
      
      // Get the bounds configuration for this tile type
      const bgConfig = getBgConfigForType(selectedType);
      if (bgConfig && bgConfig.mode) {
        // Apply slider visibility based on mode
        updateSliderVisibility(bgConfig.mode);
      }
    }
  } else { 
    // No selection - keep current slider values to preserve user edits
    // Just update the visibility based on selected type
    const bgConfig = getBgConfigForType(selectedType);
    if (bgConfig && bgConfig.mode) {
      updateSliderVisibility(bgConfig.mode);
    }
  }
  
  document.getElementById('labelLeft').textContent = 'L:' + L.value;
  document.getElementById('labelRight').textContent = 'R:' + R.value;
  document.getElementById('labelTop').textContent = 'T:' + T.value;
  
  // Update bottom label based on mode
  const bgConfig = getBgConfigForType(selectedType);
  if (bgConfig && bgConfig.mode === "RAD") {
    document.getElementById('labelBottom').textContent = 'R:' + B.value;
  } else {
    document.getElementById('labelBottom').textContent = 'B:' + B.value;
  }
  
  updateShapeSelection(); 
  updateTypeSelection();
  toggleShapeGridVisibility();
}

// New function to update slider visibility based on mode
function updateSliderVisibility(mode) {
  const leftOverlay = document.querySelector('.overlay-left');
  const rightOverlay = document.querySelector('.overlay-right');
  const topOverlay = document.querySelector('.overlay-top');
  const bottomOverlay = document.querySelector('.overlay-bottom');
  const bottomLabel = document.getElementById('labelBottom');
  
  if (mode === "LTRB") {
    // All sliders visible
    leftOverlay.style.display = 'flex';
    rightOverlay.style.display = 'flex';
    topOverlay.style.display = 'flex';
    bottomOverlay.style.display = 'flex';
    bottomLabel.textContent = bottomLabel.textContent.replace('R:', 'B:');
  } else if (mode === "LR") {
    // Only left and right
    leftOverlay.style.display = 'flex';
    rightOverlay.style.display = 'flex';
    topOverlay.style.display = 'none';
    bottomOverlay.style.display = 'none';
  } else if (mode === "TB") {
    // Only top and bottom
    leftOverlay.style.display = 'none';
    rightOverlay.style.display = 'none';
    topOverlay.style.display = 'flex';
    bottomOverlay.style.display = 'flex';
    bottomLabel.textContent = bottomLabel.textContent.replace('R:', 'B:');
  } else if (mode === "RAD") {
    // Only bottom as radius, hide others
    leftOverlay.style.display = 'none';
    rightOverlay.style.display = 'none';
    topOverlay.style.display = 'none';
    bottomOverlay.style.display = 'flex';
    // Change label to R: for radius
    bottomLabel.textContent = bottomLabel.textContent.replace('B:', 'R:');
  }
}

function toggleShapeGridVisibility() {
  const holder = document.getElementById('shapeGrid').parentElement;
  const sel = getSelectedRef();
  holder.style.display = (sel && sel.kind === 'folder' && selected.kind === 'folder') ? 'none' : '';
}

// ---------- FIXED: Viewer with proper BBMinFinal, BBMaxFinal calculation ----------
function updateViewer() {
  const svg = document.getElementById('viewerSvg');
  svg.innerHTML = '';

  const gr = getGhostRect();
  drawGhostFrameAndCross(svg, gr.x, gr.y, gr.w, gr.h, '#2a3441');

  const BBMin = { x: gr.x, y: gr.y, z: 0 };
  const BBMax = { x: gr.x + gr.w, y: gr.y + gr.h, z: 0 };

  const items = getRootTiles();
  drawItemsWithCorrectBBox(svg, items, BBMin, BBMax);

  svg.addEventListener('click', (e) => { 
    if (e.target === svg) { 
      setSelected(null, -1, null); 
      refreshUI(); 
    } 
  }, { once: true });
}

// FIXED: Draw items with correct bounding box calculations
function drawItemsWithCorrectBBox(svg, items, BBMin, BBMax) {
  items.forEach((item, index) => {
    if (item.kind === 'tile') {
      drawTileWithCorrectBBox(svg, item, BBMin, BBMax, null, index);
    } else if (item.kind === 'folder') {
      // Draw folder children with folder transformations
      (item.children || []).forEach((child, childIndex) => {
        if (child.kind === 'tile') {
          drawTileWithCorrectBBox(svg, child, BBMin, BBMax, item, childIndex);
        }
      });

      // Draw folder selection indicator
      if (selected.parent === null && selected.index === index && selected.kind === 'folder') {
        const folderConfig = item.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
        const [fMin, fMax] = tileBoxPython(folderConfig.type || '01', folderConfig.L || 0, folderConfig.R || 0, folderConfig.T || 0, folderConfig.B || 0, BBMin, BBMax);
        
        const folderRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        folderRect.setAttribute('x', Math.min(fMin[0], fMax[0])); 
        folderRect.setAttribute('y', Math.min(fMin[1], fMax[1]));
        folderRect.setAttribute('width', Math.abs(fMax[0] - fMin[0])); 
        folderRect.setAttribute('height', Math.abs(fMax[1] - fMin[1]));
        folderRect.setAttribute('fill', 'none'); 
        folderRect.setAttribute('stroke', '#ff6b6b');
        folderRect.setAttribute('stroke-dasharray', '3 3'); 
        folderRect.setAttribute('stroke-width', '1');
        folderRect.setAttribute('pointer-events', 'none');
        svg.appendChild(folderRect);
      }
    }
  });
}

function drawTileWithCorrectBBox(svg, tile, BBMin, BBMax, parent, index) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.style.cursor = 'pointer';
  g.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    setSelected(parent, index, 'tile'); 
    refreshUI(); 
  });
  svg.appendChild(g);

  const isSel = (selected.parent === parent && selected.index === index && selected.kind === 'tile');
  
  const code9 = tile.code9 || 'O101000000';
  const parsed = parseStandardToken(code9);
  if (parsed.kind !== 'tileCode') return;
  
  // START with original BBMin, BBMax
  let actualBBMin = BBMin;
  let actualBBMax = BBMax;
  
  // If tile has a folder parent, transform the bounding box FIRST
  if (parsed.folderId > 0) {
    let folder = parent;
    if (!folder || folder.kind !== 'folder') {
      folder = findFolderById(parsed.folderId, getRootTiles());
    }
    
    if (folder && folder.kind === 'folder') {
      const cfg = folder.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
      // Apply folder's tile type to get the constrained bounds
      const [folderMin, folderMax] = tileBoxPython(
        cfg.type,
        cfg.L || 0,
        cfg.R || 0,
        cfg.T || 0,
        cfg.B || 0,
        BBMin,
        BBMax
      );
      // UPDATE the bounds to the folder's transformed space
      actualBBMin = { x: Math.min(folderMin[0], folderMax[0]), y: Math.min(folderMin[1], folderMax[1]), z: 0 };
      actualBBMax = { x: Math.max(folderMin[0], folderMax[0]), y: Math.max(folderMin[1], folderMax[1]), z: 0 };
    }
  }
  
  // NOW apply the tile's own transformation using the (possibly updated) bounds
  const [pMin, pMax] = tileBoxPython(parsed.type, parsed.L, parsed.R, parsed.T, parsed.B, actualBBMin, actualBBMax);
  if (pMin[0] !== pMax[0] || pMin[1] !== pMax[1]) {
    const minX = Math.min(pMin[0], pMax[0]);
    const minY = Math.min(pMin[1], pMax[1]);
    const maxX = Math.max(pMin[0], pMax[0]);
    const maxY = Math.max(pMin[1], pMax[1]);
    const w = Math.abs(maxX - minX);
    const h = Math.abs(maxY - minY);
    const x = minX;
    const y = minY;
    
    drawBezierTilePaths(g, [x, y], [x + w, y + h], parsed.shape, strokeWeight, isSel ? "#ff6b6b" : "#e6eef4");
  }
}

// ---------- FIXED: Previews with correct bounding box calculations ----------
function drawItemInBoxWithCorrectBBox(svgGroupOrSvg, item, BBMin, BBMax, strokeColor, strokeW, parentFolder = null) {
  if (item.kind === 'tile') {
    const code9 = item.code9 || 'O101000000';
    const parsed = parseStandardToken(code9);
    if (parsed.kind !== 'tileCode') return;
    
    // START with original BBMin, BBMax
    let actualBBMin = BBMin;
    let actualBBMax = BBMax;
    
    // If tile has a folder parent, transform the bounding box FIRST
    if (parsed.folderId > 0) {
      let folder = parentFolder;
      if (!folder || folder.kind !== 'folder') {
        folder = findFolderById(parsed.folderId, getRootTiles());
      }
      
      if (folder && folder.kind === 'folder') {
        const cfg = folder.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
        // Apply folder's tile type to get the constrained bounds
        const [folderMin, folderMax] = tileBoxPython(
          cfg.type,
          cfg.L || 0,
          cfg.R || 0,
          cfg.T || 0,
          cfg.B || 0,
          BBMin,
          BBMax
        );
        // UPDATE the bounds to the folder's transformed space
        actualBBMin = { x: Math.min(folderMin[0], folderMax[0]), y: Math.min(folderMin[1], folderMax[1]), z: 0 };
        actualBBMax = { x: Math.max(folderMin[0], folderMax[0]), y: Math.max(folderMin[1], folderMax[1]), z: 0 };
      }
    }
    
    // NOW apply the tile's own transformation using the (possibly updated) bounds
    const [pMin, pMax] = tileBoxPython(parsed.type, parsed.L, parsed.R, parsed.T, parsed.B, actualBBMin, actualBBMax);
    if (pMin[0] !== pMax[0] || pMin[1] !== pMax[1]) {
      const minX = Math.min(pMin[0], pMax[0]);
      const minY = Math.min(pMin[1], pMax[1]);
      const maxX = Math.max(pMin[0], pMax[0]);
      const maxY = Math.max(pMin[1], pMax[1]);
      const w = Math.abs(maxX - minX);
      const h = Math.abs(maxY - minY);
      const x = minX;
      const y = minY;
      
      drawBezierTilePaths(svgGroupOrSvg, [x, y], [x + w, y + h], parsed.shape, strokeW, strokeColor);
    }
  } else if (item.kind === 'folder') {
    // Draw folder children - pass the folder as parent
    (item.children || []).forEach(child => {
      if (child.kind === 'tile') {
        drawItemInBoxWithCorrectBBox(svgGroupOrSvg, child, BBMin, BBMax, strokeColor, strokeW, item);
      }
    });
  }
}

function createCharacterPreviewForBB(characterItems, width, height, strokeW = 1, applyInset = true, extraPad = 0) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.background = "#0f1216";

  const insetFromStroke = applyInset ? strokeInsetForBox(width, height, strokeW) : 0;
  const inset = insetFromStroke + (extraPad || 0);
  const BBMin = { x: 0 + inset, y: 0 + inset, z: 0 };
  const BBMax = { x: width - inset, y: height - inset, z: 0 };

  const g0 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  g0.setAttribute('x', inset + 0.5); 
  g0.setAttribute('y', inset + 0.5);
  g0.setAttribute('width', width - inset * 2 - 1); 
  g0.setAttribute('height', height - inset * 2 - 1);
  g0.setAttribute('fill', 'none'); 
  g0.setAttribute('stroke', '#1f2733');
  g0.setAttribute('stroke-dasharray', '6 6'); 
  g0.setAttribute('stroke-width', '1.25');
  svg.appendChild(g0);

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); 
  svg.appendChild(g);

  const items = characterItems || [];
  items.forEach(item => { 
    drawItemInBoxWithCorrectBBox(g, item, BBMin, BBMax, "#e6eef4", strokeW, null); 
  });

  return svg;
}

function updatePreviewGrid() {
  renderPreviewInto('preview_100_100', 100, 100);
  renderPreviewInto('preview_50_100', 50, 100);
  renderPreviewInto('preview_400_100', 400, 100);
}

function renderPreviewInto(holderId, w, h) {
  const holder = document.getElementById(holderId);
  holder.innerHTML = '';
  const svg = createCharacterPreviewForBB(getRootTiles(), w, h, strokeWeight, true);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  holder.appendChild(svg);
}

// ---------- Mode / corners ----------
function setMode(newMode) {
  mode = newMode;
  document.getElementById('modeTile').classList.toggle('active', mode === 'tile');
  document.getElementById('modeBevel').classList.toggle('active', mode === 'bevel');

  if (mode === 'tile') {
    raw_data.A1 = A1_ORIG; raw_data.A2 = A2_ORIG; 
    raw_data.A3 = A3_ORIG; raw_data.A4 = A4_ORIG;
    raw_data.C1 = C1_ORIG; raw_data.C2 = C2_ORIG; 
    raw_data.C3 = C3_ORIG; raw_data.C4 = C4_ORIG;
  } else {
    updateCornersDynamic();
    raw_data.A1 = A1_DYNAMIC; raw_data.A2 = A2_DYNAMIC; 
    raw_data.A3 = A3_DYNAMIC; raw_data.A4 = A4_DYNAMIC;
    raw_data.C1 = C1_DYNAMIC; raw_data.C2 = C2_DYNAMIC; 
    raw_data.C3 = C3_DYNAMIC; raw_data.C4 = C4_DYNAMIC;
  }

  refreshIconGrids();
  refreshUI();
}

function setupCornerUI() {
  document.getElementById('modeTile').addEventListener('click', () => setMode('tile'));
  document.getElementById('modeBevel').addEventListener('click', () => setMode('bevel'));
  document.getElementById('chamferRange').addEventListener('input', e => { 
    chamferPx = +e.target.value; 
    updateCornersDynamic(); 
    refreshUI(); 
  });
  document.getElementById('bevelRange').addEventListener('input', e => {
    bevel01 = +e.target.value; 
    updateCornersDynamic(); 
    refreshUI(); 
  });
}

// ---------- Stroke / scale / tile-size controls ----------
function setupStrokeUI() {
  const r = document.getElementById('strokeRange');
  const val = document.getElementById('strokeVal');
  const apply = () => { 
    strokeWeight = +r.value || 2; 
    val.textContent = String(strokeWeight);
    updateViewer(); 
    updatePreviewGrid(); 
  };
  r.addEventListener('input', apply);
  apply();
}

function setupScaleUI() {
  const wR = document.getElementById('widthScaleRange');
  const hR = document.getElementById('heightScaleRange');
  const wV = document.getElementById('widthScaleVal');
  const hV = document.getElementById('heightScaleVal');

  const apply = () => {
    const w = Math.max(50, Math.min(100, +wR.value || 100));
    const h = Math.max(50, Math.min(100, +hR.value || 100));
    viewerScaleW = w / 100;
    viewerScaleH = h / 100;
    wV.textContent = `${w}%`;
    hV.textContent = `${h}%`;
    updateViewer();
    updatePreviewGrid();
  };

  wR.addEventListener('input', apply);
  hR.addEventListener('input', apply);
  apply();
}

function setupTileSizeControl() {
  const r = document.getElementById('tileSizeRange');
  const apply = () => {
    refreshIconGrids();
  };
  r.addEventListener('input', apply);
  apply();
}