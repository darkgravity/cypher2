// =================== TILE & FOLDER MANAGEMENT (STANDARDIZED TOKENS) ===================

// Encoding/Decoding helpers - UPDATED for -10 to 10 range
// Mapping: A=-10, B=-9, C=-8, D=-7, E=-6, F=-5, G=-4, H=-3, I=-2, J=-1, 0=0, 1=1...9=9, K=10
function encodeOffset(value) {
  const v = parseInt(value, 10);
  if (v < -10 || v > 10) return '0'; // Default to 0 for out-of-range
  
  if (v === -10) return 'A';
  if (v === -9) return 'B';
  if (v === -8) return 'C';
  if (v === -7) return 'D';
  if (v === -6) return 'E';
  if (v === -5) return 'F';
  if (v === -4) return 'G';
  if (v === -3) return 'H';
  if (v === -2) return 'I';
  if (v === -1) return 'J';
  if (v >= 0 && v <= 9) return v.toString();
  if (v === 10) return 'K';
  return '0';
}

function decodeOffset(char) {
  if (!char) return 0;
  
  // Handle alphabet characters for negative values and 10
  if (char === 'A') return -10;
  if (char === 'B') return -9;
  if (char === 'C') return -8;
  if (char === 'D') return -7;
  if (char === 'E') return -6;
  if (char === 'F') return -5;
  if (char === 'G') return -4;
  if (char === 'H') return -3;
  if (char === 'I') return -2;
  if (char === 'J') return -1;
  if (char === 'K') return 10;
  
  // Handle numeric characters
  if (char >= '0' && char <= '9') return parseInt(char, 10);
  
  return 0; // Default to 0 for invalid characters
}

function pad2(n) { 
  n = String(n); 
  return n.length === 1 ? '0' + n : n; 
}

// Check if token is folder (starts with X)
function isFolderToken(code) { 
  return typeof code === 'string' && code[0] === 'X'; 
}

// Convert old formats to new standardized format
function migrateToStandardFormat(code) {
  if (!code || typeof code !== 'string') return 'O101000000'; // Default tile
  
  // If already 9 characters and valid format, return as-is
  if (code.length === 9) {
    if (code[0] === 'X') {
      // Folder format: X + id + type + LRTB + parent (UPDATED: parent should be 0 for no nesting)
      if (/^X[1-9][0-9]{2}[0-9A-K]{4}[0-9]$/.test(code)) {
        // Ensure no folder nesting - set parent to 0
        return code.slice(0, 8) + '0';
      }
    } else {
      // Tile format: shape + type + LRTB + folder - Updated regex for new range
      if (/^[A-Z][0-9A-Z][0-9]{2}[0-9A-K]{4}[0-9]$/.test(code)) return code;
    }
  }
  
  // Handle old folder formats
  if (code[0] === 'X') {
    if (/^X[1-9]$/.test(code)) {
      // X1 -> X101000000 (folder id 1, type 01, no offsets, parent 0)
      const id = code[1];
      return `X${id}01000000`;
    }
    if (/^X[1-9][0-9]$/.test(code)) {
      // X12 -> X201000000 (folder id 2, type 01, no offsets, parent 0 - NO NESTING)
      const id = code[1];
      return `X${id}01000000`;
    }
    // For complex old folder formats, extract what we can but force parent to 0
    if (code.length >= 3) {
      const id = code[1] || '1';
      const type = code.length >= 4 ? code.slice(2, 4) : '01';
      const L = code.length >= 5 ? encodeOffset(decodeOffset(code[4])) : '0';
      const R = code.length >= 6 ? encodeOffset(decodeOffset(code[5])) : '0';
      const T = code.length >= 7 ? encodeOffset(decodeOffset(code[6])) : '0';
      const B = code.length >= 8 ? encodeOffset(decodeOffset(code[7])) : '0';
      return `X${id}${type}${L}${R}${T}${B}0`; // Force parent to 0
    }
    return 'X101000000'; // Default folder
  }
  
  // Handle old tile formats
  if (code.length === 8) {
    // Old 8-char format: check if shape+type or type+shape
    const first2 = code.slice(0, 2);
    const second2 = code.slice(2, 4);
    
    // Try to determine if it's shape+type or type+shape
    const isShapeFirst = /^[A-Z][1-9]$/.test(first2);
    const isTypeFirst = /^[0-9]{2}$/.test(first2);
    
    if (isShapeFirst) {
      // Already in correct order: shape + type + LRTB
      const shape = first2;
      const type = second2;
      const L = encodeOffset(decodeOffset(code[4]));
      const R = encodeOffset(decodeOffset(code[5]));
      const T = encodeOffset(decodeOffset(code[6]));
      const B = encodeOffset(decodeOffset(code[7]));
      return `${shape}${type}${L}${R}${T}${B}0`;
    } else if (isTypeFirst) {
      // Old format: type + shape + LRTB, need to swap
      const type = first2;
      const shape = second2;
      const L = encodeOffset(decodeOffset(code[4]));
      const R = encodeOffset(decodeOffset(code[5]));
      const T = encodeOffset(decodeOffset(code[6]));
      const B = encodeOffset(decodeOffset(code[7]));
      return `${shape}${type}${L}${R}${T}${B}0`;
    }
  }
  
  if (code.length === 9) {
    // 9-char tile with folder digit
    const base8 = code.slice(0, 8);
    const folder = code[8];
    const migrated8 = migrateToStandardFormat(base8);
    return migrated8.slice(0, 8) + folder;
  }
  
  // Default fallback
  return 'O101000000';
}

// Parse standardized token format
function parseStandardToken(code) {
  const migrated = migrateToStandardFormat(code);
  
  if (migrated[0] === 'X') {
    // Folder: X + id + type + LRTB + parent (UPDATED: parent should always be 0)
    const id = parseInt(migrated[1], 10);
    const type = migrated.slice(2, 4);
    const L = decodeOffset(migrated[4]);
    const R = decodeOffset(migrated[5]);
    const T = decodeOffset(migrated[6]);
    const B = decodeOffset(migrated[7]);
    const parent = 0; // Force no nesting
    
    return {
      kind: 'folderCode',
      ownId: id,
      parentId: parent,
      type: type,
      L: L,
      R: R,
      T: T,
      B: B,
      raw: migrated
    };
  } else {
    // Tile: shape + type + LRTB + folder
    const shape = migrated.slice(0, 2);
    const type = migrated.slice(2, 4);
    const L = decodeOffset(migrated[4]);
    const R = decodeOffset(migrated[5]);
    const T = decodeOffset(migrated[6]);
    const B = decodeOffset(migrated[7]);
    const folder = parseInt(migrated[8], 10);
    
    return {
      kind: 'tileCode',
      shape: shape,
      type: type,
      L: L,
      R: R,
      T: T,
      B: B,
      folderId: folder,
      raw: migrated
    };
  }
}

// Build standardized tile code (9 chars) - UPDATED for -10 to 10 range
function buildStandardTile(shapeKey, tileType, L, R, T, B, folderId = 0) {
  const l = encodeOffset(Math.max(-10, Math.min(10, parseInt(L, 10) || 0)));
  const r = encodeOffset(Math.max(-10, Math.min(10, parseInt(R, 10) || 0)));
  const t = encodeOffset(Math.max(-10, Math.min(10, parseInt(T, 10) || 0)));
  const b = encodeOffset(Math.max(-10, Math.min(10, parseInt(B, 10) || 0)));
  const f = Math.max(0, Math.min(9, parseInt(folderId, 10) || 0)).toString();
  return `${shapeKey}${tileType}${l}${r}${t}${b}${f}`;
}

// Build standardized folder code (9 chars) - UPDATED for -10 to 10 range
function buildStandardFolder(ownId, type, L, R, T, B, parentId = 0) {
  const id = Math.max(1, Math.min(9, parseInt(ownId, 10) || 1)).toString();
  const l = encodeOffset(Math.max(-10, Math.min(10, parseInt(L, 10) || 0)));
  const r = encodeOffset(Math.max(-10, Math.min(10, parseInt(R, 10) || 0)));
  const t = encodeOffset(Math.max(-10, Math.min(10, parseInt(T, 10) || 0)));
  const b = encodeOffset(Math.max(-10, Math.min(10, parseInt(B, 10) || 0)));
  // Force parent to 0 to prevent nesting
  return `X${id}${type}${l}${r}${t}${b}0`;
}

// Create tile object from standardized code
function tileFromStandardCode(code) { 
  return { kind: 'tile', code9: migrateToStandardFormat(code) }; 
}

// Create folder object
function makeFolder(id, name) { 
  return {
    kind: 'folder', 
    id: Math.max(1, Math.min(9, parseInt(id, 10) || 1)), 
    name: name || `Folder${id}`, 
    expanded: true, 
    config: { type: '01', L: 0, R: 0, T: 0, B: 0 }, 
    children: []
  }; 
}

// Display code for UI - FIXED to show the actual code9 value
function displayStandardCode(item, parentFolderId = 0) {
  if (item.kind === 'tile') {
    // For tiles, just display the code9 as-is
    return item.code9 || 'O101000000';
  } else if (item.kind === 'folder') {
    const cfg = item.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
    return buildStandardFolder(
      item.id, 
      cfg.type || '01', 
      cfg.L || 0, 
      cfg.R || 0, 
      cfg.T || 0, 
      cfg.B || 0, 
      0 // Always 0 for no nesting
    );
  }
  return 'O101000000';
}

// UPDATED: Simplified - no folder nesting checks needed
function isDescendantFolder(srcFolder, targetFolder) {
  // Since we don't allow nesting, just check direct equality
  return srcFolder === targetFolder;
}

// UPDATED: Only collect root-level folder IDs (simplified)
function collectUsedFolderIds(arr) {
  const s = new Set();
  // Only look at root level items
  arr.forEach(n => { 
    if (n.kind === 'folder') { 
      s.add(n.id); 
    } 
  });
  return s;
}

// UPDATED: Only search root level (simplified)
function findFolderById(id, arr) {
  // Only search root level
  for (const n of arr) { 
    if (n.kind === 'folder' && n.id === id) { 
      return n; 
    } 
  }
  return null;
}

// Get next free folder ID (1-9)
function nextFreeFolderId(usedSet) {
  for (let i = 1; i <= 9; i++) 
    if (!usedSet.has(i)) return i;
  return null;
}

// UPDATED: Flatten any nested folders during migration
function flattenNestedFolders(items) {
  const flattened = [];
  const foldersToFlatten = [];
  
  items.forEach(item => {
    if (item.kind === 'folder') {
      // Add the folder itself to root level
      const flatFolder = {
        ...item,
        children: [] // Start with empty children
      };
      flattened.push(flatFolder);
      foldersToFlatten.push({ folder: flatFolder, originalChildren: item.children || [] });
    } else {
      flattened.push(item);
    }
  });
  
  // Add all tiles from nested folders to their parent folders or root
  foldersToFlatten.forEach(({ folder, originalChildren }) => {
    const collectTiles = (children) => {
      children.forEach(child => {
        if (child.kind === 'tile') {
          // Ensure tile has correct folder ID
          const parsed = parseStandardToken(child.code9 || 'O101000000');
          if (parsed.kind === 'tileCode') {
            child.code9 = buildStandardTile(
              parsed.shape,
              parsed.type,
              parsed.L,
              parsed.R,
              parsed.T,
              parsed.B,
              folder.id // Set to parent folder's ID
            );
          }
          folder.children.push(child);
        } else if (child.kind === 'folder') {
          // Recursively collect tiles from nested folders
          collectTiles(child.children || []);
        }
      });
    };
    collectTiles(originalChildren);
  });
  
  return flattened;
}

// Update dynamic corners (same as before)
function updateCornersDynamic() {
  const ch = chamferPx, bv = bevel01;
  if (ch === lastChamfer && bv === lastBevel) return;
  lastChamfer = ch; 
  lastBevel = bv;

  A1_DYNAMIC = genA1Beveled(ch, bv);
  A2_DYNAMIC = rotateQuarter(A1_DYNAMIC, 1, 50, 50);
  A3_DYNAMIC = rotateQuarter(A1_DYNAMIC, 2, 50, 50);
  A4_DYNAMIC = rotateQuarter(A1_DYNAMIC, 3, 50, 50);

  C1_DYNAMIC = removeFirst3(JSON.parse(JSON.stringify(A1_DYNAMIC)));
  C2_DYNAMIC = removeLast3 (JSON.parse(JSON.stringify(A2_DYNAMIC)));
  C3_DYNAMIC = removeFirst3(JSON.parse(JSON.stringify(A3_DYNAMIC)));
  C4_DYNAMIC = removeLast3 (JSON.parse(JSON.stringify(A4_DYNAMIC)));

  if (mode === "bevel") {
    raw_data.A1 = A1_DYNAMIC; 
    raw_data.A2 = A2_DYNAMIC; 
    raw_data.A3 = A3_DYNAMIC; 
    raw_data.A4 = A4_DYNAMIC;
    raw_data.C1 = C1_DYNAMIC; 
    raw_data.C2 = C2_DYNAMIC; 
    raw_data.C3 = C3_DYNAMIC; 
    raw_data.C4 = C4_DYNAMIC;
  }

  refreshIconGrids();
}