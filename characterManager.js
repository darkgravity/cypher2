// =================== CHARACTER MANAGEMENT (STANDARDIZED TOKENS) ===================

// Character variables
let characters = [];
let selectedCharacterIndex = -1;
let typeBackgrounds = {};
let editingCharacterIndex = -1;
let draggedCharIndex = -1;
let pathClipboard = null;

// Context menu references
let charCtxIndex = -1;
let folderCtxRef = null;

// Get root tiles for current character
function getRootTiles() { 
  if (selectedCharacterIndex >= 0 && selectedCharacterIndex < characters.length) {
    const ch = characters[selectedCharacterIndex];
    if (!ch.tiles || !Array.isArray(ch.tiles)) {
      ch.tiles = [];
    }
    return ch.tiles;
  }
  return [];
}

// Add character (global handler)
window.app = window.app || {};
window.app.addCharacter = function () {
  document.getElementById('modalTitle').textContent = 'Add Character';
  document.getElementById('characterNameInput').value = '';
  editingCharacterIndex = -1;
  document.getElementById('characterModal').classList.remove('hidden');
  document.getElementById('characterNameInput').focus();
};

// Close character modal
window.app.closeCharacterModal = function () {
  document.getElementById('characterModal').classList.add('hidden');
  editingCharacterIndex = -1;
};

// Save character
window.app.saveCharacter = function () {
  const name = document.getElementById('characterNameInput').value.trim();
  if (!name) { 
    alert('Please enter a character name'); 
    return; 
  }

  if (editingCharacterIndex >= 0) {
    characters[editingCharacterIndex].name = name;
    saveToStorage();
    updateCharacterList();
    window.app.closeCharacterModal();
    return;
  }

  const defaultTile = buildStandardTile('O1', '01', 0, 0, 0, 0, 0);
  const newCharacter = { 
    name, 
    tiles: [ tileFromStandardCode(defaultTile) ] 
  };

  characters.push(newCharacter);
  selectCharacter(characters.length - 1);
  window.app.closeCharacterModal();
};

// IMPORT CHARACTERS FROM JSON FILE OR SIMPLE TEXT
window.app.importCharacters = function() {
  const fileInput = document.getElementById('importFileInput');
  
  // Reset and trigger file selection
  fileInput.value = '';
  fileInput.accept = '.json,.txt,.js'; // Accept multiple file types
  fileInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const content = event.target.result;
        let processedCharacters = [];
        
        // Try to parse as simple character definitions first
        // Format: CharName:["code1","code2",...],
        const simplePattern = /([^:,\s]+)\s*:\s*\[([^\]]+)\]/g;
        const matches = content.matchAll(simplePattern);
        let foundSimple = false;
        
        for (const match of matches) {
          foundSimple = true;
          const charName = match[1].trim();
          const codesStr = match[2];
          
          // Parse the codes array
          const codes = [];
          const codePattern = /"([^"]+)"/g;
          const codeMatches = codesStr.matchAll(codePattern);
          for (const codeMatch of codeMatches) {
            codes.push(codeMatch[1]);
          }
          
          if (codes.length > 0) {
            // Import the character using the existing importDefinition function
            const tiles = importDefinition(codes, 0);
            processedCharacters.push({
              name: charName,
              tiles: tiles
            });
          }
        }
        
        // If no simple format found, try parsing as JSON
        if (!foundSimple) {
          try {
            const imported = JSON.parse(content);
            
            // Check if it's a full export format
            if (imported.characters && Array.isArray(imported.characters)) {
              // Full export format
              processedCharacters = imported.characters.map(char => {
                // Ensure character has a name
                if (!char.name) {
                  char.name = 'Unnamed';
                }
                
                // Use codes if available (preserves folder structure)
                if (char.codes && Array.isArray(char.codes)) {
                  char.tiles = importDefinition(char.codes, 0);
                } else if (char.tiles && Array.isArray(char.tiles)) {
                  // Already has tiles array - migrate and flatten
                  char.tiles = migrateAndFlattenCharacterTiles(char.tiles);
                } else {
                  // No tiles - add default
                  char.tiles = [ tileFromStandardCode('O101000000') ];
                }
                
                return char;
              });
              
              // Import type backgrounds if present
              if (imported.typeBackgrounds) {
                typeBackgrounds = imported.typeBackgrounds;
              }
            } else if (Array.isArray(imported)) {
              // Array of character objects
              processedCharacters = imported.map(char => {
                if (typeof char === 'object' && char.name) {
                  if (char.codes && Array.isArray(char.codes)) {
                    char.tiles = importDefinition(char.codes, 0);
                  }
                  return char;
                }
                return null;
              }).filter(Boolean);
            } else if (imported.name && (imported.codes || imported.tiles)) {
              // Single character object
              if (imported.codes && Array.isArray(imported.codes)) {
                imported.tiles = importDefinition(imported.codes, 0);
              }
              processedCharacters = [imported];
            }
          } catch (jsonError) {
            // Not valid JSON, might be simple text format that wasn't caught
            console.log('Not JSON format, tried simple format parsing');
          }
        }
        
        if (processedCharacters.length === 0) {
          alert('No valid character data found in the file.');
          return;
        }
        
        // Ask user what to do with imported characters
        const choice = confirm(
          `Found ${processedCharacters.length} character(s) in the file.\n\n` +
          `Click OK to REPLACE all current characters.\n` +
          `Click Cancel to ADD them to existing characters.`
        );
        
        if (choice) {
          // Replace all characters
          characters = processedCharacters;
          selectedCharacterIndex = 0;
        } else {
          // Add to existing characters
          characters.push(...processedCharacters);
        }
        
        setSelected(null, -1, null);
        persistAndRefresh();
        showToastText(`Successfully imported ${processedCharacters.length} character(s)`);
        
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import file. Please check the file format.');
      }
    };
    
    reader.onerror = function() {
      alert('Failed to read file.');
    };
    
    reader.readAsText(file);
  };
  
  fileInput.click();
};

// EXPORT ALL CHARACTERS TO JSON FILE
window.app.exportCharacters = function() {
  try {
    // Ask user which format they want
    const useSimple = confirm(
      'Export format:\n\n' +
      'OK = Simple format (just character codes)\n' +
      'Cancel = Full JSON format (includes all settings)'
    );
    
    if (useSimple) {
      // Simple format export
      let output = '';
      characters.forEach(char => {
        const oldSelectedIndex = selectedCharacterIndex;
        selectedCharacterIndex = characters.indexOf(char);
        const codes = exportCharacterDefinition();
        selectedCharacterIndex = oldSelectedIndex;
        
        // Format as: CharName:["code1","code2",...],
        output += `${char.name}:[${codes.map(c => `"${c}"`).join(',')}],\n`;
      });
      
      // Create blob and download
      const blob = new Blob([output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bezier-characters-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToastText(`Exported ${characters.length} character(s) in simple format`);
      
    } else {
      // Full JSON export
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        characters: characters.map(char => {
          // Export each character with its full definition
          const charCopy = {
            name: char.name,
            tiles: char.tiles // Keep the full tile structure
          };
          
          // Also include the compact codes for compatibility
          const oldSelectedIndex = selectedCharacterIndex;
          selectedCharacterIndex = characters.indexOf(char);
          const codes = exportCharacterDefinition();
          selectedCharacterIndex = oldSelectedIndex;
          charCopy.codes = codes;
          
          return charCopy;
        }),
        typeBackgrounds: typeBackgrounds
      };
      
      // Convert to JSON
      const jsonStr = JSON.stringify(exportData, null, 2);
      
      // Create blob and download link
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create temporary download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `bezier-characters-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToastText(`Exported ${characters.length} character(s) in full format`);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export characters.');
  }
};

// Edit character
function editCharacter(index) {
  document.getElementById('modalTitle').textContent = 'Edit Character';
  document.getElementById('characterNameInput').value = characters[index].name;
  editingCharacterIndex = index;
  document.getElementById('characterModal').classList.remove('hidden');
  document.getElementById('characterNameInput').focus();
}

// Delete character
function deleteCharacter(index) {
  if (characters.length <= 1) { 
    alert('Cannot delete the last character.'); 
    return; 
  }
  if (!confirm(`Delete character "${characters[index].name}"?`)) return;
  characters.splice(index, 1);
  if (selectedCharacterIndex >= characters.length) 
    selectedCharacterIndex = characters.length - 1;
  if (selectedCharacterIndex < 0) 
    selectedCharacterIndex = 0;
  setSelected(null, -1, null);
  persistAndRefresh();
}

// Generate duplicate name
function generateDuplicateName(originalName) {
  const existing = new Set(characters.map(c => (c.name || '').trim()));
  const m = String(originalName || '').trim().match(/^(.*?)(\d+)$/);
  let base = m ? m[1] : String(originalName || '').trim();
  if (base === '') base = String(originalName || '').trim();
  let start = m ? (parseInt(m[2], 10) + 1) : 2;
  while (true) {
    const candidate = `${base}${start}`;
    if (!existing.has(candidate)) return candidate;
    start++;
  }
}

// Duplicate character
function duplicateCharacter(index) {
  if (index < 0 || index >= characters.length) return;
  const orig = characters[index];
  const newName = generateDuplicateName(orig.name);
  
  // Deep clone and flatten any nested structure
  const clonedTiles = JSON.parse(JSON.stringify(orig.tiles));
  const flattenedTiles = flattenNestedFolders(clonedTiles);
  
  const newChar = { 
    name: newName, 
    tiles: flattenedTiles
  };
  characters.splice(index + 1, 0, newChar);
  persistAndRefresh();
  selectCharacter(index + 1);
}

// Select character with migration and flattening
function selectCharacter(index) {
  selectedCharacterIndex = index;
  if (index >= 0 && index < characters.length) {
    const ch = characters[index];
    if (!ch.tiles || !Array.isArray(ch.tiles)) {
      ch.tiles = [ tileFromStandardCode('O101000000') ];
    }
    
    // Migrate and flatten to ensure no nesting
    ch.tiles = migrateAndFlattenCharacterTiles(ch.tiles);
  }
  setSelected(null, -1, null);
  refreshUI();
  saveToStorage();
}

// UPDATED: Migrate character tiles and flatten nested folders
function migrateAndFlattenCharacterTiles(tiles) {
  // First migrate to standardized format
  const migrated = tiles.map(item => {
    if (typeof item === 'string') {
      // Old string format - convert to standardized tile object
      const standardCode = migrateToStandardFormat(item);
      return tileFromStandardCode(standardCode);
    } else if (item && item.kind === 'tile') {
      // Existing tile object - migrate code
      if (item.code8) {
        // Old 8-char format
        item.code9 = migrateToStandardFormat(item.code8 + '0');
        delete item.code8;
      } else if (item.code9) {
        // Ensure it's properly formatted
        item.code9 = migrateToStandardFormat(item.code9);
      } else {
        // No code at all - use default
        item.code9 = 'O101000000';
      }
      return item;
    } else if (item && item.kind === 'folder') {
      // Ensure folder config is proper
      if (!item.config) {
        item.config = { type: '01', L: 0, R: 0, T: 0, B: 0 };
      }
      // Ensure folder ID is in range 1-9
      if (!item.id || item.id < 1 || item.id > 9) {
        item.id = 1;
      }
      // Recursively migrate children
      item.children = migrateAndFlattenCharacterTiles(item.children || []);
      return item;
    } else {
      // Unknown format - create default tile
      return tileFromStandardCode('O101000000');
    }
  });
  
  // Then flatten any nested folders
  return flattenNestedFolders(migrated);
}

// Update character list UI with folder nesting prevention
function updateCharacterList() {
  const list = document.getElementById('characterList');
  list.innerHTML = '';
  characters.forEach((ch, index) => {
    const item = document.createElement('div');
    item.className = 'character-item' + (index === selectedCharacterIndex ? ' selected' : '');
    item.draggable = true;
    item.onclick = (e) => { 
      if (!e.target.closest('button')) selectCharacter(index); 
    };
    
    // Drag and drop
    item.addEventListener('dragstart', (e) => { 
      draggedCharIndex = index; 
      e.dataTransfer.effectAllowed = 'move'; 
      setTimeout(() => item.classList.add('dragging'), 0); 
      e.dataTransfer.setData('text/plain', index.toString());
    });
    item.addEventListener('dragend', () => { 
      item.classList.remove('dragging'); 
      draggedCharIndex = -1; 
    });
    item.addEventListener('dragover', (e) => { 
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move'; 
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const targetIndex = index;
      if (isFinite(from) && from !== targetIndex) {
        const dragged = characters.splice(from, 1)[0];
        characters.splice(targetIndex, 0, dragged);
        if (selectedCharacterIndex === from) 
          selectedCharacterIndex = targetIndex;
        else if (selectedCharacterIndex > from && selectedCharacterIndex <= targetIndex) 
          selectedCharacterIndex--;
        else if (selectedCharacterIndex < from && selectedCharacterIndex >= targetIndex) 
          selectedCharacterIndex++;
        persistAndRefresh();
      }
    });
    
    // Context menu
    item.oncontextmenu = (e) => { 
      e.preventDefault(); 
      showCharCtx(e.clientX, e.clientY, index); 
    };

    // Build UI elements
    const icon = document.createElement('div'); 
    icon.className = 'char-icon';
    icon.appendChild(createCharacterPreviewForBB(ch.tiles, 100, 100, 1, false, 5));
    
    const name = document.createElement('div'); 
    name.className = 'char-name'; 
    name.textContent = ch.name;
    
    const editBtn = document.createElement('button'); 
    editBtn.className = 'edit-btn'; 
    editBtn.title = 'Edit name'; 
    editBtn.textContent = '✎';
    editBtn.onclick = (e) => { 
      e.stopPropagation(); 
      editCharacter(index); 
    };
    
    const dupBtn = document.createElement('button'); 
    dupBtn.className = 'duplicate-btn'; 
    dupBtn.title = 'Duplicate'; 
    dupBtn.textContent = 'D';
    dupBtn.onclick = (e) => { 
      e.stopPropagation(); 
      duplicateCharacter(index); 
    };
    
    const delBtn = document.createElement('button'); 
    delBtn.className = 'delete-btn'; 
    delBtn.title = 'Delete'; 
    delBtn.textContent = '×';
    delBtn.onclick = (e) => { 
      e.stopPropagation(); 
      deleteCharacter(index); 
    };

    item.appendChild(icon); 
    item.appendChild(name); 
    item.appendChild(editBtn); 
    item.appendChild(dupBtn); 
    item.appendChild(delBtn);
    list.appendChild(item);
  });
}

// Update current character display
function updateCurrentCharacterDisplay() {
  const display = document.getElementById('currentCharName');
  if (selectedCharacterIndex >= 0 && selectedCharacterIndex < characters.length)
    display.textContent = `Editing: ${characters[selectedCharacterIndex].name}`;
  else 
    display.textContent = 'No character selected';
}

// Update results
function updateResults() {
  const ch = characters[selectedCharacterIndex]; 
  if (!ch) { 
    document.getElementById('charResult').textContent = ''; 
    return; 
  }
  const out = exportCharacterDefinition();
  const charResult = `${ch.name}:${JSON.stringify(out)},`;
  document.getElementById('charResult').textContent = charResult;
}

// FIXED: Export character definition preserving folder IDs
function exportCharacterDefinition() {
  const ch = characters[selectedCharacterIndex]; 
  if (!ch) return [];
  const out = [];
  
  // Only process root level (no deep nesting)
  const rootTiles = ch.tiles || [];
  
  // Export root-level folders first
  rootTiles.forEach(item => {
    if (item.kind === 'folder') {
      const cfg = item.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
      out.push(buildStandardFolder(
        item.id, 
        cfg.type || '01', 
        cfg.L || 0, 
        cfg.R || 0, 
        cfg.T || 0, 
        cfg.B || 0, 
        0 // Always 0 for root level
      ));
    }
  });
  
  // Export root-level tiles (keep their actual folder ID which should be 0)
  rootTiles.forEach(item => {
    if (item.kind === 'tile') {
      // Just export the code9 as-is to preserve folder ID
      out.push(item.code9 || 'O101000000');
    }
  });
  
  // Export folder children (tiles only) preserving their folder ID
  rootTiles.forEach(item => {
    if (item.kind === 'folder') {
      (item.children || []).forEach(child => {
        if (child.kind === 'tile') {
          // Export the code9 as-is to preserve the folder ID relationship
          out.push(child.code9 || 'O101000000');
        }
      });
    }
  });
  
  return out;
}

// FIXED: Import definition preserving folder IDs from codes
function importDefinition(codes, targetParentId) {
  const parsed = codes.map(parseStandardToken);
  const folderDefs = parsed.filter(p => p.kind === 'folderCode');
  const tileDefs = parsed.filter(p => p.kind === 'tileCode');

  // Create folders first
  const folderObjects = {};
  folderDefs.forEach(f => {
    const fo = makeFolder(f.ownId, 'Folder' + f.ownId);
    // Set folder config from the parsed definition
    fo.config = {
      type: f.type || '01',
      L: f.L || 0,
      R: f.R || 0,
      T: f.T || 0,
      B: f.B || 0
    };
    folderObjects[f.ownId] = fo;
  });

  const roots = [];
  
  // Add folders to root (since we don't allow nesting)
  Object.values(folderObjects).forEach(folder => {
    roots.push(folder);
  });

  // Add tiles, preserving their folder IDs
  tileDefs.forEach(t => {
    // Create tile with its original folder ID preserved
    const tileObj = tileFromStandardCode(t.raw);
    
    if (t.folderId === 0) {
      // Root level tile
      roots.push(tileObj);
    } else if (folderObjects[t.folderId]) {
      // Tile belongs to a folder that exists
      folderObjects[t.folderId].children.push(tileObj);
    } else {
      // Folder doesn't exist, put at root but keep the folder ID
      // This preserves the relationship if the folder is added later
      roots.push(tileObj);
    }
  });

  return roots;
}

// Context menu functions
function showCharCtx(x, y, i) { 
  charCtxIndex = i; 
  const ctx = document.getElementById('charCtx');
  ctx.style.left = x + 'px'; 
  ctx.style.top = y + 'px'; 
  ctx.classList.remove('hidden'); 
}

function showFolderCtx(x, y, parent, idx) { 
  folderCtxRef = { parent, idx }; 
  const ctx = document.getElementById('folderCtx');
  ctx.style.left = x + 'px'; 
  ctx.style.top = y + 'px'; 
  ctx.classList.remove('hidden'); 
}

function hideCtxMenus() { 
  document.getElementById('charCtx').classList.add('hidden'); 
  document.getElementById('folderCtx').classList.add('hidden'); 
}

// Storage functions
function initializeDefaults() {
  characters = [{ 
    name: 'O2', 
    tiles: [ tileFromStandardCode('O101000000') ] 
  }];
  selectedCharacterIndex = 0;
  setSelected(null, -1, null);
  typeBackgrounds = {};
}

// Load initial data from characters.txt file
async function loadFromCharactersFile() {
  try {
    const response = await fetch('characters.txt');
    if (!response.ok) {
      console.log('characters.txt not found, using defaults');
      return false;
    }
    
    const content = await response.text();
    if (!content.trim()) {
      console.log('characters.txt is empty, using defaults');
      return false;
    }
    
    // Try to parse as simple character definitions first
    // Format: CharName:["code1","code2",...],
    const simplePattern = /([^:,\s]+)\s*:\s*\[([^\]]+)\]/g;
    const matches = content.matchAll(simplePattern);
    let foundCharacters = [];
    
    for (const match of matches) {
      const charName = match[1].trim();
      const codesStr = match[2];
      
      // Parse the codes array
      const codes = [];
      const codePattern = /"([^"]+)"/g;
      const codeMatches = codesStr.matchAll(codePattern);
      for (const codeMatch of codeMatches) {
        codes.push(codeMatch[1]);
      }
      
      if (codes.length > 0) {
        // Import the character using the existing importDefinition function
        const tiles = importDefinition(codes, 0);
        foundCharacters.push({
          name: charName,
          tiles: tiles
        });
      }
    }
    
    // If no simple format found, try parsing as JSON
    if (foundCharacters.length === 0) {
      try {
        const imported = JSON.parse(content);
        
        // Check if it's a full export format
        if (imported.characters && Array.isArray(imported.characters)) {
          // Full export format
          foundCharacters = imported.characters.map(char => {
            // Ensure character has a name
            if (!char.name) {
              char.name = 'Unnamed';
            }
            
            // Use codes if available (preserves folder structure)
            if (char.codes && Array.isArray(char.codes)) {
              char.tiles = importDefinition(char.codes, 0);
            } else if (char.tiles && Array.isArray(char.tiles)) {
              // Already has tiles array - migrate and flatten
              char.tiles = migrateAndFlattenCharacterTiles(char.tiles);
            } else {
              // No tiles - add default
              char.tiles = [ tileFromStandardCode('O101000000') ];
            }
            
            return char;
          });
          
          // Import type backgrounds if present
          if (imported.typeBackgrounds) {
            typeBackgrounds = imported.typeBackgrounds;
          }
        } else if (Array.isArray(imported)) {
          // Array of character objects
          foundCharacters = imported.map(char => {
            if (typeof char === 'object' && char.name) {
              if (char.codes && Array.isArray(char.codes)) {
                char.tiles = importDefinition(char.codes, 0);
              }
              return char;
            }
            return null;
          }).filter(Boolean);
        } else if (imported.name && (imported.codes || imported.tiles)) {
          // Single character object
          if (imported.codes && Array.isArray(imported.codes)) {
            imported.tiles = importDefinition(imported.codes, 0);
          }
          foundCharacters = [imported];
        }
      } catch (jsonError) {
        console.log('characters.txt is not valid JSON, but found simple format data');
      }
    }
    
    if (foundCharacters.length > 0) {
      characters = foundCharacters;
      selectedCharacterIndex = 0;
      setSelected(null, -1, null);
      console.log(`Loaded ${foundCharacters.length} character(s) from characters.txt`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('Error loading characters.txt:', error);
    return false;
  }
}

// UPDATED: Migration with folder flattening
function migrateStorageIfNeeded(payload) {
  (payload.characters || []).forEach(ch => {
    // Migrate and flatten character tiles
    ch.tiles = migrateAndFlattenCharacterTiles(ch.tiles || []);
    
    // Fix folder IDs for root-level folders only
    const used = collectUsedFolderIds(ch.tiles || []);
    ch.tiles.forEach(item => {
      if (item.kind === 'folder') {
        if (!(item.id >= 1 && item.id <= 9)) {
          const nid = nextFreeFolderId(used) || 1; 
          used.add(nid); 
          item.id = nid;
        }
        item.config = item.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
        item.children = item.children || [];
      }
    });
  });
}

function saveToStorage() {
  try { 
    const pkg = { characters, selectedCharacterIndex, typeBackgrounds };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pkg)); 
  } catch (e) { 
    console.warn('Save failed', e); 
  }
}

async function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { 
      // First run - try to load from characters.txt
      console.log('No saved data found, attempting to load from characters.txt');
      const loadedFromFile = await loadFromCharactersFile();
      if (!loadedFromFile) {
        // No file or error, use defaults
        initializeDefaults();
      }
      saveToStorage(); 
      return; 
    }
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.characters) || payload.characters.length === 0) {
      // Invalid saved data - try to load from characters.txt
      console.log('Invalid saved data, attempting to load from characters.txt');
      const loadedFromFile = await loadFromCharactersFile();
      if (!loadedFromFile) {
        // No file or error, use defaults
        initializeDefaults();
      }
      saveToStorage(); 
      return;
    }
    migrateStorageIfNeeded(payload);
    characters = payload.characters;
    typeBackgrounds = payload.typeBackgrounds || {};
    selectedCharacterIndex = Math.min(Math.max(0, payload.selectedCharacterIndex || 0), characters.length - 1);
    setSelected(null, -1, null);
  } catch (e) { 
    console.warn('Load failed, attempting to load from characters.txt', e); 
    // Try to load from characters.txt as fallback
    const loadedFromFile = await loadFromCharactersFile();
    if (!loadedFromFile) {
      // No file or error, use defaults
      initializeDefaults();
    }
    saveToStorage(); 
  }
}

// FIXED: Calculate centroid with proper BBMinFinal, BBMaxFinal calculation
function calculateTileCentroidWithCorrectBBox(tile, BBMin, BBMax, parentFolder = null) {
  const code9 = tile.code9 || 'O101000000';
  const parsed = parseStandardToken(code9);
  if (parsed.kind !== 'tileCode') {
    return { x: BBMin.x + (BBMax.x - BBMin.x) / 2, y: BBMin.y + (BBMax.y - BBMin.y) / 2 };
  }

  // START with original bounds
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
      actualBBMin = { x: Math.min(folderMin[0], folderMax[0]), y: Math.min(folderMin[1], folderMax[1]) };
      actualBBMax = { x: Math.max(folderMin[0], folderMax[0]), y: Math.max(folderMin[1], folderMax[1]) };
    }
  }

  // NOW apply the tile's own transformation using the (possibly updated) bounds
  const [pMin, pMax] = tileBoxPython(parsed.type, parsed.L, parsed.R, parsed.T, parsed.B, actualBBMin, actualBBMax);
  const minX = Math.min(pMin[0], pMax[0]);
  const minY = Math.min(pMin[1], pMax[1]);
  const maxX = Math.max(pMin[0], pMax[0]);
  const maxY = Math.max(pMin[1], pMax[1]);
  const w = Math.abs(maxX - minX);
  const h = Math.abs(maxY - minY);
  const x = minX;
  const y = minY;
  
  const paths = getPaths(parsed.shape);
  const pathArr = paths[0] || [[50, 50]];
  const vx = remapVals([pathArr[0][0]], 0, 100, x, x + w)[0];
  const vy = remapVals([pathArr[0][1]], 0, 100, y, y + h)[0];
  
  return { x: vx, y: vy };
}

// FIXED: Heuristic reorder with proper BBMinFinal, BBMaxFinal calculation
function heuristicReorder() {
  const ch = characters[selectedCharacterIndex]; 
  if (!ch) return;
  const baseW = 300, baseH = 300;
  const ghostW = baseW * viewerScaleW;
  const ghostH = baseH * viewerScaleH;
  const ghostX = (500 - ghostW) / 2;
  const ghostY = (500 - ghostH) / 2;
  const BBMin = { x: ghostX, y: ghostY }, BBMax = { x: ghostX + ghostW, y: ghostY + ghostH };
  
  const centroidOfItem = (item, parentFolder = null) => {
    const pts = [];
    
    if (item.kind === 'tile') {
      // FIXED: Pass parent folder for proper calculation
      const centroid = calculateTileCentroidWithCorrectBBox(item, BBMin, BBMax, parentFolder);
      pts.push(centroid);
    } else if (item.kind === 'folder') {
      // Folder - collect centroids of its children, passing the folder as parent
      (item.children || []).forEach(child => {
        if (child.kind === 'tile') {
          const centroid = calculateTileCentroidWithCorrectBBox(child, BBMin, BBMax, item);
          pts.push(centroid);
        }
      });
    }
    
    if (!pts.length) return { x: 0, y: 0 };
    return { 
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length, 
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length 
    };
  };

  const reorderArray = (arr, parentFolder = null) => {
    if (arr.length <= 1) return;
    const cents = arr.map(item => centroidOfItem(item, parentFolder));
    const order = []; 
    const used = new Array(arr.length).fill(false);
    let current = 0; 
    used[current] = true; 
    order.push(arr[current]);
    for (let step = 1; step < arr.length; step++) {
      let best = -1, bestD = 1e12;
      for (let i = 0; i < arr.length; i++) {
        if (used[i]) continue;
        const d = Math.hypot(cents[current].x - cents[i].x, cents[current].y - cents[i].y);
        if (d < bestD) { 
          bestD = d; 
          best = i; 
        }
      }
      used[best] = true; 
      order.push(arr[best]); 
      current = best;
    }
    arr.splice(0, arr.length, ...order);
    
    // Also reorder children within folders, passing the folder as parent
    arr.forEach(item => { 
      if (item.kind === 'folder') {
        reorderArray(item.children || [], item);
      }
    });
  };

  reorderArray(ch.tiles || [], null);
  persistAndRefresh();
  showToastText('Reordered');
}

// Simple import for pasting tiles into a folder
function importTilesIntoFolder(codes, targetFolderId) {
  const tiles = [];
  codes.forEach(code => {
    const parsed = parseStandardToken(code);
    if (parsed.kind === 'tileCode') {
      // Create tile with the target folder's ID
      const newCode = buildStandardTile(
        parsed.shape,
        parsed.type,
        parsed.L,
        parsed.R,
        parsed.T,
        parsed.B,
        targetFolderId
      );
      tiles.push(tileFromStandardCode(newCode));
    }
    // Skip folder codes since we don't allow folder nesting
  });
  return tiles;
}

// Export only tiles from a folder (for copy operation)
function exportFolderTiles(folder) {
  const codes = [];
  (folder.children || []).forEach(child => {
    if (child.kind === 'tile') {
      const parsed = parseStandardToken(child.code9 || 'O101000000');
      if (parsed.kind === 'tileCode') {
        // Export with folder ID 0 (will be updated when pasting)
        const code = buildStandardTile(
          parsed.shape,
          parsed.type,
          parsed.L,
          parsed.R,
          parsed.T,
          parsed.B,
          0 // Temporarily set to 0, will be updated on paste
        );
        codes.push(code);
      }
    }
  });
  return codes;
}