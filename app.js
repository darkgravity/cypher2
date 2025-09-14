// =================== MAIN APPLICATION (STANDARDIZED TOKENS) ===================

// Global state variables
let selected = { parent: null, index: -1, kind: null };
let selectedShape = 'O1';
let selectedType = '01';
let mode = "tile";
let chamferPx = 40;
let bevel01 = 0.6;
let strokeWeight = 2;
let viewerScaleW = 1.0;
let viewerScaleH = 1.0;
let lastChamfer = null;
let lastBevel = null;
let dragPayload = null;

// Selection management
function setSelected(parent, index, kind) { 
  selected = { parent, index, kind }; 
  toggleShapeGridVisibility(); 
}

function getSelectedRef() {
  if (selected.index < 0) return null;
  const arr = selected.parent ? selected.parent.children : getRootTiles();
  return arr[selected.index] || null;
}

// Check if current selection is inside a folder (prevent folder nesting)
function isSelectionInFolder() {
  return selected.parent && selected.parent.kind === 'folder';
}

// Tile operations - UPDATED for standardized format with folder nesting prevention
window.app.addTile = function() {
  // Get current slider values
  let L = parseInt(document.getElementById('leftRange').value, 10) || 0;
  let R = parseInt(document.getElementById('rightRange').value, 10) || 0;
  let T = parseInt(document.getElementById('topRange').value, 10) || 0;
  let B = parseInt(document.getElementById('bottomRange').value, 10) || 0;
  
  // Get the bounds configuration for the selected tile type
  const bgConfig = getBgConfigForType(selectedType);
  
  // Check if relevant sliders for this mode are untouched
  let shouldApplyDefaults = false;
  if (bgConfig && bgConfig.defaultValue !== undefined) {
    if (bgConfig.mode === "LTRB") {
      // Check if all sliders are at 0
      shouldApplyDefaults = (L === 0 && R === 0 && T === 0 && B === 0);
    } else if (bgConfig.mode === "LR") {
      // Only check L and R
      shouldApplyDefaults = (L === 0 && R === 0);
    } else if (bgConfig.mode === "TB") {
      // Only check T and B
      shouldApplyDefaults = (T === 0 && B === 0);
    } else if (bgConfig.mode === "RAD") {
      // Check B (which represents radius)
      shouldApplyDefaults = (B === 0);
    }
  }
  
  // Only apply defaults if relevant sliders haven't been touched
  if (shouldApplyDefaults && bgConfig && bgConfig.defaultValue !== undefined) {
    const defaultVal = bgConfig.defaultValue;
    
    if (bgConfig.mode === "LTRB") {
      L = defaultVal;
      R = defaultVal;
      T = defaultVal;
      B = defaultVal;
    } else if (bgConfig.mode === "LR") {
      L = defaultVal;
      R = defaultVal;
      // Keep T and B as current values
    } else if (bgConfig.mode === "TB") {
      // Keep L and R as current values
      T = defaultVal;
      B = defaultVal;
    } else if (bgConfig.mode === "RAD") {
      // For RAD mode, all values get the same (radius)
      L = defaultVal;
      R = defaultVal;
      T = defaultVal;
      B = defaultVal;
    }
  }
  // Otherwise use current slider values
  
  // Determine the folder ID based on current selection
  let folderId = 0;
  let targetFolder = null;
  
  const sel = getSelectedRef();
  if (sel && sel.kind === 'folder' && selected.kind === 'folder') {
    // A folder is selected, add tile to it
    folderId = sel.id;
    targetFolder = sel;
  } else if (selected.parent && selected.parent.kind === 'folder') {
    // Adding to a folder that's already the parent
    folderId = selected.parent.id;
    targetFolder = selected.parent;
  }
  
  const standardCode = buildStandardTile(selectedShape, selectedType, L, R, T, B, folderId);
  const t = tileFromStandardCode(standardCode);
  t.hasBeenSet = true; // Mark that this tile has been initialized with values
  
  if (targetFolder) {
    // Add to the folder
    targetFolder.children.push(t);
    setSelected(targetFolder, targetFolder.children.length - 1, 'tile');
  } else {
    // Add to root
    getRootTiles().push(t);
    setSelected(null, getRootTiles().length - 1, 'tile');
  }
  persistAndRefresh();
};

// UPDATED: Prevent folder nesting - only allow folders at root level
window.app.addFolder = function() {
  // Prevent folder creation if we're already inside a folder
  if (isSelectionInFolder()) {
    showToastText('Folders can only be created at root level');
    return;
  }

  const ch = characters[selectedCharacterIndex]; 
  if (!ch) return;
  
  // Only check root level folders for used IDs
  const used = collectUsedFolderIds(getRootTiles());
  const next = nextFreeFolderId(used);
  if (!next) { 
    showToastText('No free folder IDs (1-9)'); 
    return; 
  }
  
  const name = 'Folder' + next;
  const f = makeFolder(next, name);
  
  // Always add to root level
  getRootTiles().push(f);
  setSelected(null, getRootTiles().length - 1, 'folder');
  persistAndRefresh();
};

window.app.clearTiles = function() {
  const ch = characters[selectedCharacterIndex]; 
  if (!ch) return;
  ch.tiles = []; 
  setSelected(null, -1, null);
  persistAndRefresh();
};

// Tile list rendering - UPDATED with folder nesting prevention and proper folder ID assignment
function renderTileList() {
  const list = document.getElementById('tileList');
  list.innerHTML = '';
  
  const walk = (arr, parent = null, indent = 0) => {
    arr.forEach((it, idx) => {
      const row = document.createElement('div');
      const isSelected = (selected.parent === parent && selected.index === idx);
      row.className = 'tile-row' + (isSelected ? ' selected' : '');
      row.style.marginLeft = (indent > 0 ? (indent * 18) + 'px' : '0');
      row.draggable = true;

      row.addEventListener('dragstart', (e) => { 
        dragPayload = { parent, index: idx, item: it }; 
        row.classList.add('dragging'); 
        e.dataTransfer.effectAllowed = 'move'; 
      });
      row.addEventListener('dragend', () => { 
        row.classList.remove('dragging'); 
        dragPayload = null; 
      });
      row.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move'; 
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragPayload) return;

        // UPDATED: Prevent folder-into-folder drops
        if (it.kind === 'folder' && dragPayload.item.kind === 'folder') {
          showToastText('Cannot nest folders inside folders');
          return;
        }

        // UPDATED: Only allow tiles into folders, or items at root level
        const srcArr = dragPayload.parent ? dragPayload.parent.children : getRootTiles();
        const moved = srcArr.splice(dragPayload.index, 1)[0];

        if (it.kind === 'folder') {
          // Only allow tiles into folders
          if (moved.kind === 'folder') {
            showToastText('Cannot nest folders inside folders');
            // Put it back where it came from
            srcArr.splice(dragPayload.index, 0, moved);
            return;
          }
          // Update the tile's folder ID when moved into a folder
          if (moved.kind === 'tile') {
            const parsed = parseStandardToken(moved.code9 || 'O101000000');
            if (parsed.kind === 'tileCode') {
              moved.code9 = buildStandardTile(
                parsed.shape,
                parsed.type,
                parsed.L,
                parsed.R,
                parsed.T,
                parsed.B,
                it.id // Set the new folder's ID
              );
            }
          }
          it.children.push(moved);
          setSelected(it, it.children.length - 1, moved.kind);
        } else {
          // Moving to root or next to another item
          const dstArr = parent ? parent.children : getRootTiles();
          let insertAt = idx;
          if (srcArr === dstArr && dragPayload.index < idx) insertAt = Math.max(0, idx - 1);
          
          // Update folder ID based on destination
          if (moved.kind === 'tile') {
            const newFolderId = parent && parent.kind === 'folder' ? parent.id : 0;
            const parsed = parseStandardToken(moved.code9 || 'O101000000');
            if (parsed.kind === 'tileCode') {
              moved.code9 = buildStandardTile(
                parsed.shape,
                parsed.type,
                parsed.L,
                parsed.R,
                parsed.T,
                parsed.B,
                newFolderId
              );
            }
          }
          
          dstArr.splice(insertAt, 0, moved);
          setSelected(parent, insertAt, moved.kind);
        }

        persistAndRefresh();
      });

      row.onclick = () => { 
        setSelected(parent, idx, it.kind); 
        refreshUI(); 
      };

      if (it.kind === 'tile') {
        const icon = document.createElement('div'); 
        icon.className = 'shape-icon';
        const shapeKey = it.code9 ? it.code9.slice(0, 2) : 'O1';
        icon.appendChild(createShapePreview(shapeKey));
        
        const code = document.createElement('span'); 
        code.className = 'code'; 
        code.textContent = displayStandardCode(it, parent && parent.kind === 'folder' ? parent.id : 0);
        
        const deleteBtn = document.createElement('button'); 
        deleteBtn.className = 'delete-btn'; 
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => { 
          e.stopPropagation(); 
          const arr = parent ? parent.children : getRootTiles(); 
          arr.splice(idx, 1); 
          setSelected(null, -1, null); 
          persistAndRefresh(); 
        };

        row.appendChild(icon); 
        row.appendChild(code); 
        row.appendChild(deleteBtn);
      } else {
        row.classList.add('folder-row');
        const toggle = document.createElement('button'); 
        toggle.className = 'folder-toggle'; 
        toggle.textContent = it.expanded ? '▾' : '▸';
        toggle.onclick = (e) => { 
          e.stopPropagation(); 
          it.expanded = !it.expanded; 
          refreshUI(); 
        };
        
        const title = document.createElement('div'); 
        title.className = 'folder-title'; 
        title.textContent = it.name + ' (id ' + it.id + ')';
        
        const spacer = document.createElement('div'); 
        spacer.style.flex = '1';
        
        const code = document.createElement('span'); 
        code.className = 'code'; 
        code.textContent = displayStandardCode(it, parent && parent.kind === 'folder' ? parent.id : 0);
        
        const deleteBtn = document.createElement('button'); 
        deleteBtn.className = 'delete-btn'; 
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => { 
          e.stopPropagation(); 
          const arr = parent ? parent.children : getRootTiles(); 
          arr.splice(idx, 1); 
          setSelected(null, -1, null); 
          persistAndRefresh(); 
        };

        row.oncontextmenu = (e) => { 
          e.preventDefault(); 
          showFolderCtx(e.clientX, e.clientY, parent, idx); 
        };

        row.appendChild(toggle); 
        row.appendChild(title); 
        row.appendChild(spacer); 
        row.appendChild(code); 
        row.appendChild(deleteBtn);
      }
      list.appendChild(row);

      // UPDATED: Only show children if this is a root-level folder (prevent deep nesting display)
      if (it.kind === 'folder' && it.expanded && parent === null) {
        walk(it.children, it, indent + 1);
      }
    });
  };
  walk(getRootTiles());
}

function updateTileList() { 
  renderTileList(); 
}

// Context menu handlers
document.addEventListener('click', hideCtxMenus);
document.addEventListener('keydown', (e) => { 
  if (e.key === 'Escape') hideCtxMenus(); 
});

document.getElementById('charCopyPath').onclick = () => {
  hideCtxMenus();
  if (charCtxIndex < 0) return;
  const curSel = selectedCharacterIndex;
  const tmpSel = charCtxIndex; 
  selectCharacter(tmpSel);
  pathClipboard = exportCharacterDefinition();
  selectCharacter(curSel);
  showToastText('Character path copied');
};

document.getElementById('charPastePath').onclick = () => {
  hideCtxMenus();
  if (charCtxIndex < 0 || !pathClipboard) return;
  selectedCharacterIndex = charCtxIndex;
  
  // When pasting to a character, folder IDs stay as-is since we're pasting at root level
  const roots = importDefinition(pathClipboard, 0);
  characters[charCtxIndex].tiles = roots;
  persistAndRefresh();
  showToastText('Character path pasted');
};

document.getElementById('folderCopyPath').onclick = () => {
  hideCtxMenus();
  if (!folderCtxRef) return;
  const arr = folderCtxRef.parent ? folderCtxRef.parent.children : getRootTiles();
  const f = arr[folderCtxRef.idx];
  if (!f || f.kind !== 'folder') return;
  
  // Use the helper function to export only the folder's tiles
  pathClipboard = exportFolderTiles(f);
  showToastText('Folder contents copied');
};

document.getElementById('folderPastePath').onclick = () => {
  hideCtxMenus();
  if (!folderCtxRef || !pathClipboard) return;
  const arr = folderCtxRef.parent ? folderCtxRef.parent.children : getRootTiles();
  const f = arr[folderCtxRef.idx];
  if (!f || f.kind !== 'folder') return;
  
  // Handle both cases: clipboard from folder copy (tiles only) or character copy (may include folders)
  // In either case, we only paste tiles and update their folder IDs
  const tiles = importTilesIntoFolder(pathClipboard, f.id);
  if (tiles.length > 0) {
    f.children.push(...tiles);
    persistAndRefresh();
    showToastText(`${tiles.length} tile(s) pasted into folder`);
  } else {
    showToastText('No tiles to paste');
  }
};

// Update tile/folder properties when sliders change - UPDATED for -10 to 10 range
function updateSelectedTileOrFolder() {
  const sel = getSelectedRef(); 
  if (!sel) return;
  
  let L = Math.max(-10, Math.min(10, parseInt(document.getElementById('leftRange').value, 10) || 0));
  let R = Math.max(-10, Math.min(10, parseInt(document.getElementById('rightRange').value, 10) || 0));
  let T = Math.max(-10, Math.min(10, parseInt(document.getElementById('topRange').value, 10) || 0));
  let B = Math.max(-10, Math.min(10, parseInt(document.getElementById('bottomRange').value, 10) || 0));
  
  // Check if we're in RAD mode
  const bgConfig = getBgConfigForType(selectedType);
  if (bgConfig && bgConfig.mode === "RAD") {
    // In RAD mode, use bottom value for all directions (it's the radius)
    L = B;
    R = B;
    T = B;
    // B stays as B
  }
  
  if (sel.kind === 'tile') {
    // Preserve the current folder ID when updating tile properties
    const parsed = parseStandardToken(sel.code9 || 'O101000000');
    const currentFolder = parsed.kind === 'tileCode' ? parsed.folderId : 0;
    sel.code9 = buildStandardTile(selectedShape, selectedType, L, R, T, B, currentFolder);
    sel.hasBeenSet = true; // Mark that user has interacted with this tile
  } else if (sel.kind === 'folder' && selected.kind === 'folder') {
    sel.config.type = selectedType;
    sel.config.L = L; 
    sel.config.R = R; 
    sel.config.T = T; 
    sel.config.B = B;
  }
  
  // Immediately update viewer and other UI elements
  updateViewer();
  updateTileList();
  updateResults();
  updatePreviewGrid();
  saveToStorage();
}

// Refresh UI
function refreshUI() {
  updateCharacterList();
  updateCurrentCharacterDisplay();
  updateTileList();
  updateViewer();
  updateResults();
  updatePreviewGrid();
  updateOverlayFromSelection();
}

function persistAndRefresh() {
  saveToStorage();
  refreshUI();
}

// Toast functions
function showToastText(text) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 2000);
}

function showToast(text) {
  showToastText(text);
}

function showToastError() {
  showToastText('Error occurred');
}

// SVG copy functions
function copyViewerSVGToClipboard() {
  const svg = document.getElementById('viewerSvg');
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgWithNamespace = svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(svgWithNamespace).then(() => showToast('SVG copied'), showToastError);
  } else {
    try {
      const ta = document.createElement('textarea'); 
      ta.value = svgWithNamespace; 
      document.body.appendChild(ta);
      ta.select(); 
      document.execCommand('copy'); 
      document.body.removeChild(ta);
      showToast('SVG copied');
    } catch (e) { 
      showToastError(); 
    }
  }
}

// Initialize application
async function initializeApp() {
  await loadFromStorage();  // Now async to handle characters.txt loading
  setupShapeGrid(); 
  setupTypeGrid();
  setupOverlayControls(); 
  setupCornerUI(); 
  setupStrokeUI(); 
  setupTileSizeControl(); 
  setupScaleUI();
  setMode('tile');
  
  // Set initial default values for the sliders based on default tile type
  const bgConfig = getBgConfigForType(selectedType);
  if (bgConfig && bgConfig.defaultValue !== undefined) {
    const defaultVal = bgConfig.defaultValue;
    const L = document.getElementById('leftRange');
    const R = document.getElementById('rightRange');
    const T = document.getElementById('topRange');
    const B = document.getElementById('bottomRange');
    
    if (bgConfig.mode === "LTRB") {
      L.value = defaultVal;
      R.value = defaultVal;
      T.value = defaultVal;
      B.value = defaultVal;
    } else if (bgConfig.mode === "LR") {
      L.value = defaultVal;
      R.value = defaultVal;
      T.value = 0;
      B.value = 0;
    } else if (bgConfig.mode === "TB") {
      L.value = 0;
      R.value = 0;
      T.value = defaultVal;
      B.value = defaultVal;
    } else if (bgConfig.mode === "RAD") {
      L.value = defaultVal;
      R.value = defaultVal;
      T.value = defaultVal;
      B.value = defaultVal;
    }
  }
  
  refreshUI();

  // Wire up buttons
  document.getElementById('reorderBtn').addEventListener('click', heuristicReorder);
  document.getElementById('copySvgBtn').addEventListener('click', copyViewerSVGToClipboard);
  document.getElementById('copyMergedPathBtn').addEventListener('click', copyMergedPathSVGToClipboard);

  // Character modal
  document.getElementById('characterNameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') window.app.saveCharacter();
    if (e.key === 'Escape') window.app.closeCharacterModal();
  });
  document.getElementById('characterModal').addEventListener('click', function(e) {
    if (e.target === this) window.app.closeCharacterModal();
  });
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}