// =================== DYNAMIC CHARACTER LOADER MODULE ===================
// Loads and manages character definitions from characters.txt with ligature support

// Character storage
window.dynamicCharacters = {};
window.dynamicCharacterFolders = {}; // Store folder definitions per character
window.dynamicLigatures = []; // Store ligature keys sorted by length (longest first)
window.DEFAULT_QUOTE = `Here's to the crazy ones, the misfits, the rebels, the troublemakers, the round pegs in the square holes... the ones who see things differently - they're not fond of rules... You can quote them, disagree with them, glorify or vilify them, but the only thing you can't do is ignore them because they change things... they push the human race forward, and while some may see them as the crazy ones, we see genius, because the ones who are crazy enough to think that they can change the world, are the ones who do. - Steve Jobs, 1997`;

// Parse standardized token format (from tileCreator)
function parseStandardToken(code) {
  if (!code || typeof code !== 'string' || code.length < 8) {
    return { kind: 'invalid' };
  }
  
  // Handle 8-char format by padding with 0
  if (code.length === 8) {
    code = code + '0';
  }
  
  // Check if it's a folder token
  if (code[0] === 'X') {
    // Folder format: X + id + type + LRTB + parent
    const id = parseInt(code[1], 10);
    const type = code.slice(2, 4);
    const L = decodeOffset(code[4] || '0');
    const R = decodeOffset(code[5] || '0');
    const T = decodeOffset(code[6] || '0');
    const B = decodeOffset(code[7] || '0');
    const parent = parseInt(code[8] || '0', 10);
    
    return {
      kind: 'folderCode',
      ownId: id,
      parentId: parent,
      type: type,
      L: L,
      R: R,
      T: T,
      B: B,
      raw: code
    };
  }
  
  // Tile format: shape (2) + type (2) + LRTB (4) + folder (1)
  const shape = code.slice(0, 2);
  const type = code.slice(2, 4);
  const L = decodeOffset(code[4] || '0');
  const R = decodeOffset(code[5] || '0');
  const T = decodeOffset(code[6] || '0');
  const B = decodeOffset(code[7] || '0');
  const folder = parseInt(code[8] || '0', 10);
  
  return {
    kind: 'tileCode',
    shape: shape,
    type: type,
    L: L,
    R: R,
    T: T,
    B: B,
    folderId: folder,
    raw: code
  };
}

// Decode offset helper (supports -10 to 10 range)
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
  
  return 0;
}

// Convert old format specs to standardized format
function convertToStandardFormat(specs) {
  if (!Array.isArray(specs)) return [];
  
  return specs.map(spec => {
    if (typeof spec !== 'string') return 'O101000000';
    
    // Already 9 characters - assume it's correct
    if (spec.length === 9) return spec;
    
    // Old 8-character format
    if (spec.length === 8) {
      // Format was: type(2) + shape(2) + LRTB(4)
      const type = spec.slice(0, 2);
      const shape = spec.slice(2, 4);
      const L = spec[4] || '0';
      const R = spec[5] || '0';
      const T = spec[6] || '0';
      const B = spec[7] || '0';
      
      // Convert to new format: shape(2) + type(2) + LRTB(4) + folder(1)
      return `${shape}${type}${L}${R}${T}${B}0`;
    }
    
    // Unknown format - return default
    return 'O101000000';
  });
}

// Process character definitions to extract folders and tiles
function processCharacterDefinition(codes) {
  const standardCodes = convertToStandardFormat(codes);
  const folders = {};
  const tiles = [];
  
  // First pass: identify folders
  standardCodes.forEach(code => {
    const parsed = parseStandardToken(code);
    if (parsed.kind === 'folderCode') {
      folders[parsed.ownId] = {
        id: parsed.ownId,
        type: parsed.type,
        L: parsed.L,
        R: parsed.R,
        T: parsed.T,
        B: parsed.B
      };
    }
  });
  
  // Second pass: collect tiles
  standardCodes.forEach(code => {
    const parsed = parseStandardToken(code);
    if (parsed.kind === 'tileCode') {
      tiles.push(code);
    }
  });
  
  return { folders, tiles };
}

// Load characters from file
async function loadCharactersFromFile() {
  try {
    const response = await fetch('characters.txt');
    if (!response.ok) {
      console.log('characters.txt not found, using minimal fallback');
      loadMinimalFallback();
      return;
    }
    
    const content = await response.text();
    if (!content.trim()) {
      console.log('characters.txt is empty, using minimal fallback');
      loadMinimalFallback();
      return;
    }
    
    // IMPROVED PARSING: Handle special characters including comma and apostrophe
    // Split by lines first to handle each character definition separately
    const lines = content.split('\n');
    let foundCharacters = false;
    const ligatureKeys = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Try to match the pattern: CHAR:["code1","code2",...],
      // Use a more flexible approach for the character part
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      // Extract character (everything before the colon, trimmed)
      let charName = line.substring(0, colonIndex).trim();
      
      // FIXED: Only remove quotes if the character is wrapped in quotes AND has content inside
      // Don't remove quotes if the character itself IS a quote
      if (charName.length > 2) {
        if (charName.startsWith('"') && charName.endsWith('"')) {
          charName = charName.slice(1, -1);
        } else if (charName.startsWith("'") && charName.endsWith("'")) {
          charName = charName.slice(1, -1);
        }
      }
      
      // Extract the array part
      const arrayMatch = line.substring(colonIndex + 1).match(/\[([^\]]*)\]/);
      if (!arrayMatch) continue;
      
      const codesStr = arrayMatch[1];
      
      // Parse the codes array
      const codes = [];
      const codePattern = /"([^"]+)"/g;
      const codeMatches = codesStr.matchAll(codePattern);
      for (const codeMatch of codeMatches) {
        codes.push(codeMatch[1]);
      }
      
      if (codes.length > 0) {
        foundCharacters = true;
        
        // Store using uppercase for letters/multi-char sequences, but preserve special characters
        const storageKey = (charName.length === 1 && /[A-Za-z0-9]/.test(charName)) 
          ? charName.toUpperCase() 
          : (charName.length > 1 && /^[A-Za-z0-9]+$/.test(charName))
          ? charName.toUpperCase()
          : charName;
        
        // Process to separate folders and tiles
        const processed = processCharacterDefinition(codes);
        window.dynamicCharacterFolders[storageKey] = processed.folders;
        window.dynamicCharacters[storageKey] = processed.tiles;
        
        // Track ligatures (multi-character sequences)
        if (storageKey.length > 1) {
          ligatureKeys.push(storageKey);
        }
        
        console.log(`Loaded character: "${storageKey}" with ${codes.length} tokens`);
      }
    }
    
    // Sort ligatures by length (longest first) for proper matching
    window.dynamicLigatures = ligatureKeys.sort((a, b) => b.length - a.length);
    
    if (window.dynamicLigatures.length > 0) {
      console.log(`Loaded ligatures: ${window.dynamicLigatures.join(', ')}`);
    }
    
    if (!foundCharacters) {
      console.log('No valid characters found in file, using minimal fallback');
      loadMinimalFallback();
    } else {
      console.log(`Loaded ${Object.keys(window.dynamicCharacters).length} characters from characters.txt`);
    }
    
  } catch (error) {
    console.log('Error loading characters.txt:', error);
    loadMinimalFallback();
  }
}

// Minimal fallback - just provide a simple default if file is missing
function loadMinimalFallback() {
  // Just provide a minimal fallback for basic functionality
  // This should rarely be used since characters.txt exists
  const minimalDefault = {
    tiles: ["O101000000"], // Simple circle tile
    folders: {}
  };
  
  // Apply minimal default to all letters
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').forEach(char => {
    window.dynamicCharacters[char] = minimalDefault.tiles;
    window.dynamicCharacterFolders[char] = minimalDefault.folders;
  });
  
  window.dynamicLigatures = [];
  
  console.warn('Using minimal fallback - please ensure characters.txt is present');
}

// Get specs for a character (with folder info)
window.getSpecsForChar = function(ch) {
  if (ch === ' ') return { tiles: [], folders: {} };
  
  // For single character lookups, try uppercase first for letters/numbers
  let lookupKey = ch;
  if (ch.length === 1 && /[A-Za-z0-9]/.test(ch)) {
    lookupKey = ch.toUpperCase();
  } else if (ch.length > 1 && /^[A-Za-z0-9]+$/.test(ch)) {
    // Multi-char sequences (ligatures) - uppercase them
    lookupKey = ch.toUpperCase();
  }
  
  return {
    tiles: window.dynamicCharacters[lookupKey] || ["O101000000"],
    folders: window.dynamicCharacterFolders[lookupKey] || {}
  };
};

// Check if a ligature exists for a substring
window.hasLigature = function(str) {
  const upperStr = str.toUpperCase();
  return window.dynamicCharacters.hasOwnProperty(upperStr);
};

// Get the best ligature match starting at a position in text
window.getLigatureAt = function(text, startIndex) {
  // Try to match ligatures, longest first
  for (const ligature of window.dynamicLigatures) {
    const endIndex = startIndex + ligature.length;
    if (endIndex <= text.length) {
      const substring = text.substring(startIndex, endIndex).toUpperCase();
      if (substring === ligature) {
        return ligature;
      }
    }
  }
  return null;
};

// Initialize on load
window.initializeDynamicCharacters = async function() {
  await loadCharactersFromFile();
};