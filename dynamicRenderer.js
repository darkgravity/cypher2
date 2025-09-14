// =================== DYNAMIC RENDERER MODULE ===================
// Handles drawing bezier tiles using geometry functions with folder support

// Global state
window.EXPORT_SIZE_OVERRIDE = null;
window.lastAutoRows = 15;
window.lastGoodOutput = null;
window.currentGridConfig = null;
window.currentCells = null;
window.strokeWeight = 2;
window.viewerScaleW = 1.0;
window.viewerScaleH = 1.0;

// Corner mode state
window.cornerMode = 'tile'; // 'tile' | 'bevel'
window.lastChamferVal = null;
window.lastBevelVal = null;

// Set corner mode
window.setCornerMode = function(mode) {
  window.cornerMode = mode;
  if (window.cornerMode === 'tile') {
    // Restore original corners
    raw_data.A1 = A1_ORIG;
    raw_data.A2 = A2_ORIG;
    raw_data.A3 = A3_ORIG;
    raw_data.A4 = A4_ORIG;
    raw_data.C1 = C1_ORIG;
    raw_data.C2 = C2_ORIG;
    raw_data.C3 = C3_ORIG;
    raw_data.C4 = C4_ORIG;
  } else {
    // Use dynamic beveled corners
    window.updateCornersDynamic();
    raw_data.A1 = A1_DYNAMIC;
    raw_data.A2 = A2_DYNAMIC;
    raw_data.A3 = A3_DYNAMIC;
    raw_data.A4 = A4_DYNAMIC;
    raw_data.C1 = C1_DYNAMIC;
    raw_data.C2 = C2_DYNAMIC;
    raw_data.C3 = C3_DYNAMIC;
    raw_data.C4 = C4_DYNAMIC;
  }
};

// Update dynamic corners
window.updateCornersDynamic = function() {
  const chamfer = Number(window.$('#chamferSlider').value);
  const bevel = Number(window.$('#bevelSlider').value);
  if (chamfer === window.lastChamferVal && bevel === window.lastBevelVal) return;

  window.lastChamferVal = chamfer;
  window.lastBevelVal = bevel;

  // A dynamics
  A1_DYNAMIC = genA1Beveled(chamfer, bevel);
  A2_DYNAMIC = rotateQuarter(A1_DYNAMIC, 1, 50, 50);
  A3_DYNAMIC = rotateQuarter(A1_DYNAMIC, 2, 50, 50);
  A4_DYNAMIC = rotateQuarter(A1_DYNAMIC, 3, 50, 50);

  // C dynamics derived from A
  C1_DYNAMIC = removeFirst3(JSON.parse(JSON.stringify(A1_DYNAMIC)));
  C2_DYNAMIC = removeLast3(JSON.parse(JSON.stringify(A2_DYNAMIC)));
  C3_DYNAMIC = removeFirst3(JSON.parse(JSON.stringify(A3_DYNAMIC)));
  C4_DYNAMIC = removeLast3(JSON.parse(JSON.stringify(A4_DYNAMIC)));

  if (window.cornerMode === 'bevel') {
    raw_data.A1 = A1_DYNAMIC;
    raw_data.A2 = A2_DYNAMIC;
    raw_data.A3 = A3_DYNAMIC;
    raw_data.A4 = A4_DYNAMIC;
    raw_data.C1 = C1_DYNAMIC;
    raw_data.C2 = C2_DYNAMIC;
    raw_data.C3 = C3_DYNAMIC;
    raw_data.C4 = C4_DYNAMIC;
  }
};

// Color helpers
window.hslToRgbString = function(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255);
  };
  return `rgb(${f(0)}, ${f(8)}, ${f(4)})`;
};

window.tileBgColor = function(char) {
  const hueCenter = (parseInt(document.getElementById('hueCenter').value, 10) || 0) / 100;
  const hueRadius = (parseInt(document.getElementById('hueRadius').value, 10) || 0) / 100;

  const EPS = 1e-7;
  const satPct = parseFloat(document.getElementById('saturationSlider').value) || 0;
  const contrastPct = parseFloat(document.getElementById('contrastSlider').value) || 0;
  const brightPct = parseFloat(document.getElementById('brightnessSlider').value) || 0;

  const s = clamp(Math.max(EPS, satPct / 100), 0, 1);
  const baseL = clamp(0.5 * Math.max(EPS, brightPct / 100), 0, 1);
  const spread = Math.max(EPS, (contrastPct / 100) * 0.4);

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', numbers = '0123456789', punct = ' .,!?\'"/-:;()[]{}@#$%&*+=<>~`|\\_';
  let t = .5;
  if (letters.includes(char)) t = letters.indexOf(char) / Math.max(1, letters.length - 1);
  else if (numbers.includes(char)) t = numbers.indexOf(char) / Math.max(1, numbers.length - 1);
  else if (punct.includes(char)) t = punct.indexOf(char) / Math.max(1, punct.length - 1);
  else if (char === ' ') {
    if (document.getElementById('customSpaceColor').checked) return document.getElementById('spaceColorPicker').value.trim();
    t = 0.0;
  }

  if (hueRadius === 0) {
    const h = hueCenter;
    const l = baseL;
    return window.hslToRgbString(h, s, l);
  }

  let h = (hueCenter - hueRadius) + (2 * hueRadius) * t;
  while (h < 0) h += 1;
  while (h > 1) h -= 1;
  const l = clamp(baseL + (t - 0.5) * 2 * spread, 0, 1);
  return window.hslToRgbString(h, s, l);
};

window.strokeWidthPx = function(isFirst) {
  const sync = document.getElementById('syncOtherToggle').checked;
  const first = parseInt(document.getElementById('firstThickness').value || '2', 10);
  const other = parseInt(document.getElementById('otherThickness').value || '2', 10);
  return Math.max(1, isFirst ? first : (sync ? first : other));
};

window.currentApplyColorTo = function() {
  const el = document.querySelector('input[name="applyColor"]:checked');
  return el ? el.value : 'background';
};

window.getStrokeColor = function(isFirst) {
  const sync = document.getElementById('syncOtherToggle').checked;
  if (isFirst || sync) return document.getElementById('firstLetterColorPicker').value.trim();
  return document.getElementById('otherTextColorPicker').value.trim();
};

// UPDATED: Draw bezier character with folder transformation support
window.drawBezierChar = function(parent, x, y, w, h, ch, isFirst, colorOverride = null) {
  if (ch === ' ') return;
  const strokeColor = colorOverride || window.getStrokeColor(isFirst);
  const charData = window.getSpecsForChar(ch);
  const specs = charData.tiles;
  const folders = charData.folders || {};
  
  if (!specs.length) return;
  
  const BBMin = { x: x, y: y, z: 0 }, BBMax = { x: x + w, y: y + h, z: 0 };
  const strokeWidth = window.strokeWidthPx(isFirst);
  
  for (const specRaw of specs) {
    // Parse standardized token
    const parsed = parseStandardToken(specRaw);
    if (parsed.kind !== 'tileCode') continue;
    
    // CRITICAL: Two-stage transformation for folder support
    let actualBBMin = BBMin;
    let actualBBMax = BBMax;
    
    // STAGE 1: Apply folder transformation if tile belongs to a folder
    if (parsed.folderId > 0 && folders[parsed.folderId]) {
      const folder = folders[parsed.folderId];
      
      // Apply folder's tile type to get the constrained bounds
      const [folderMin, folderMax] = tileBoxPython(
        folder.type || '01',
        folder.L || 0,
        folder.R || 0,
        folder.T || 0,
        folder.B || 0,
        BBMin,
        BBMax
      );
      
      // Update bounds to the folder's transformed space
      actualBBMin = { 
        x: Math.min(folderMin[0], folderMax[0]), 
        y: Math.min(folderMin[1], folderMax[1]), 
        z: 0 
      };
      actualBBMax = { 
        x: Math.max(folderMin[0], folderMax[0]), 
        y: Math.max(folderMin[1], folderMax[1]), 
        z: 0 
      };
    }
    
    // STAGE 2: Apply tile's own transformation within the (possibly constrained) space
    const tileType = parsed.type;
    const shapeKey = parsed.shape;
    
    // Decode offsets
    const d1 = parsed.L;
    const d2 = parsed.R;
    const d3 = parsed.T;
    const d4 = parsed.B;
    
    // Use tileBoxPython with the actual bounds (folder-constrained or original)
    const [pMin, pMax] = tileBoxPython(tileType, d1, d2, d3, d4, actualBBMin, actualBBMax);
    if (pMin[0] === pMax[0] && pMin[1] === pMax[1]) continue;
    
    // Draw using geometry functions
    const minX = Math.min(pMin[0], pMax[0]);
    const minY = Math.min(pMin[1], pMax[1]);
    const maxX = Math.max(pMin[0], pMax[0]);
    const maxY = Math.max(pMin[1], pMax[1]);
    const boxW = Math.abs(maxX - minX);
    const boxH = Math.abs(maxY - minY);
    const boxX = minX;
    const boxY = minY;
    
    drawBezierTilePaths(parent, [boxX, boxY], [boxX + boxW, boxY + boxH], shapeKey, strokeWidth, strokeColor);
  }
};

// Decode offset helper (duplicated from dynamicCharLoader for convenience)
function decodeOffset(char) {
  if (!char) return 0;
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
  if (char >= '0' && char <= '9') return parseInt(char, 10);
  return 0;
}

// Parse standard token (duplicated for convenience)
function parseStandardToken(code) {
  if (!code || typeof code !== 'string' || code.length < 8) {
    return { kind: 'invalid' };
  }
  
  if (code.length === 8) {
    code = code + '0';
  }
  
  if (code[0] === 'X') {
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

// Canvas size handling
window.getCanvasSize = function() {
  if (window.EXPORT_SIZE_OVERRIDE) {
    return { width: window.EXPORT_SIZE_OVERRIDE.w, height: window.EXPORT_SIZE_OVERRIDE.h };
  }
  if (document.getElementById('screenSize').checked) {
    const r = document.getElementById('canvasContainer').getBoundingClientRect();
    return { width: Math.max(1, Math.floor(r.width)), height: Math.max(1, Math.floor(r.height)) };
  }
  return {
    width: parseInt(document.getElementById('canvasWidth').value || '1200', 10),
    height: parseInt(document.getElementById('canvasHeight').value || '800', 10)
  };
};

// Main grid generation function
window.generateGrid = function(newRandom = false, startNonceOverride = null) {
  try {
    if (newRandom) window.runNonce = Math.random();
    if (startNonceOverride != null) window.runNonce = startNonceOverride;
    const seedAtStart = window.runNonce;

    const stage = document.getElementById('stage');
    stage.innerHTML = '';

    const rawText = (document.getElementById('phraseInput').value || window.DEFAULT_QUOTE)
      .toUpperCase().replace(/[""]/g, '"').replace(/\u2014/g, '-').replace(/…/g, '...');
    const hasText = !!rawText.trim();

    const size = window.getCanvasSize();
    const margin = parseInt(document.getElementById('marginSlider').value || '0', 10);

    const innerW = Math.max(1, size.width - margin * 2), innerH = Math.max(1, size.height - margin * 2);
    stage.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);

    const gridType = document.querySelector('input[name="gridType"]:checked')?.value || 'tessellated';
    let currentOutput = null;
    let usedFallbackBasic = false;

    if (gridType === 'basic') {
      currentOutput = window.layoutBasicBalanced(parseInt(document.getElementById('rowSlider').value, 10), innerW, innerH, size);
    } else if (hasText) {
      // Try tessellated first
      const text = rawText;
      const charData = window.parseCharDataForText(text);

      let rows = parseInt(document.getElementById('rowSlider').value, 10);
      let colsHint = null, success = false, tries = 0, startX = 0, startY = 0, cells = [], bestConfig = null;

      while (!success && tries < 120) {
        const plan = window.planGrid(charData, rows, colsHint);
        const cols = plan.cols;
        const cellW = Math.max(1, Math.floor(innerW / cols));
        const cellH = Math.max(1, Math.floor(innerH / rows));
        const gridW = cols * cellW, gridH = rows * cellH;

        startX = margin + Math.floor((size.width - margin * 2 - gridW) / 2);
        startY = margin + Math.floor((size.height - margin * 2 - gridH) / 2);

        const { placements, usedChars } = window.packRows(charData, plan);
        const totalCells = rows * cols;
        const placedCells = placements.reduce((s, p) => s + (p.kind === 'double' ? 2 : 1), 0);
        const usedAll = (usedChars === charData.length);
        const filledAll = (placedCells === totalCells);

        if (usedAll && filledAll) {
          let colIndexPerRow = Array(rows).fill(0);
          cells = [];
          for (const p of placements) {
            const r = p.row, c = colIndexPerRow[r];
            const x = startX + c * cellW, y = startY + r * cellH;
            if (p.kind === 'double') {
              const c0 = charData[p.ids[0]];
              cells.push(new window.Cell(x, y, cellW * 2, cellH, c0.char, c0.isFirstChar, 'double', c0.isSpace));
              colIndexPerRow[r] += 2;
            } else if (p.kind === 'divided') {
              const h1 = Math.floor(cellH / 2), h2 = cellH - h1;
              const cA = charData[p.ids[0]], cB = charData[p.ids[1]];
              cells.push(new window.Cell(x, y, cellW, h1, cA.char, cA.isFirstChar, 'split', cA.isSpace));
              cells.push(new window.Cell(x, y + h1, cellW, h2, cB.char, cB.isFirstChar, 'split', cB.isSpace));
              colIndexPerRow[r] += 1;
            } else {
              const c0 = charData[p.ids[0]];
              cells.push(new window.Cell(x, y, cellW, cellH, c0.char, c0.isFirstChar, 'normal', c0.isSpace));
              colIndexPerRow[r] += 1;
            }
          }
          bestConfig = { rows, cols, cellW, cellH, totalCells };
          currentOutput = { cells, bestConfig };
          success = true;
        } else {
          colsHint = !filledAll ? Math.max(1, plan.cols - 1) : plan.cols + 1;
          tries++;
        }
      }

      // Fallback to BASIC if tessellation did not succeed this frame
      if (!success) {
        usedFallbackBasic = true;
        const fbRows = document.getElementById('autoRows').checked ? window.pickBestRowsBasicOnly() : rows;
        currentOutput = window.layoutBasicBalanced(fbRows, innerW, innerH, size);
      }
    }

    // If still no output, last-resort reuse last good
    if ((!currentOutput || !currentOutput.cells || !currentOutput.cells.length) && window.lastGoodOutput) {
      currentOutput = window.lastGoodOutput.output;
    }

    const bgColor = document.getElementById('bgColorPicker').value.trim();

    if (!currentOutput || !currentOutput.cells || !currentOutput.cells.length) {
      // Nothing to draw (no text) -> draw background only
      const bgOnly = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgOnly.setAttribute('x', '0');
      bgOnly.setAttribute('y', '0');
      bgOnly.setAttribute('width', String(size.width));
      bgOnly.setAttribute('height', String(size.height));
      bgOnly.setAttribute('fill', bgColor);
      stage.appendChild(bgOnly);
      return;
    }

    window.currentGridConfig = { bestConfig: currentOutput.bestConfig };
    window.currentCells = currentOutput.cells;

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(size.width));
    bg.setAttribute('height', String(size.height));
    bg.setAttribute('fill', bgColor);
    stage.appendChild(bg);

    // Groups
    const gBg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gBg.setAttribute('id', 'bgTiles');
    stage.appendChild(gBg);
    const gText = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gText.setAttribute('id', 'textTiles');
    stage.appendChild(gText);
    const txtOpacity = (parseInt(document.getElementById('textOpacitySlider').value || '100', 10)) / 100;
    gText.setAttribute('opacity', String(txtOpacity));

    // Draw
    for (const cell of currentOutput.cells) cell.drawBg(gBg);
    for (const cell of currentOutput.cells) {
      if (!cell.isFirstChar) cell.drawText(gText);
    }
    for (const cell of currentOutput.cells) {
      if (cell.isFirstChar) cell.drawText(gText);
    }

    // Remember last good
    if (currentOutput.cells.length) {
      window.lastGoodOutput = { output: currentOutput };
    }

    window.lastRunSeed = seedAtStart;

  } catch (err) {
    console.error(err);
  }
};