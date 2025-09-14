// =================== TESSELLATION ENGINE MODULE ===================
// Handles grid layout, tessellation, and cell management

// Random number generator with seed
window.runNonce = Math.random();
window.lastRunSeed = window.runNonce;

window.rand = function() {
  return Math.abs(Math.sin(window.runNonce += 0.1337)) % 1;
};

window.shuffled = function(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(window.rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

window.rotate = function(arr, k) {
  const n = arr.length;
  if (!n) return arr.slice();
  k = ((k % n) + n) % n;
  return arr.slice(k).concat(arr.slice(0, k));
};

// Narrow set for character width determination - these characters should NOT be doubled
const NARROW_SET = new Set(["B", "P", "S", "0", "5", "2", "R", "9", "8", "6", "3"]);

// Check if a character should be considered for double-width
window.canBeDoubled = function(char) {
  // Convert to uppercase for comparison
  const upperChar = (typeof char === 'string' && char.length === 1) ? char.toUpperCase() : char;
  
  // If it's a ligature (multi-char), it can be doubled
  if (typeof char === 'string' && char.length > 1) {
    return true;
  }
  
  // If it's in the narrow set, it should NOT be doubled
  if (NARROW_SET.has(upperChar)) {
    return false;
  }
  
  // All other characters can be doubled
  return true;
};

// Get special ligature words from input
window.getSpecialLigatureWords = function() {
  const input = document.getElementById('specialLigaturesList');
  if (!input) return [];
  
  const words = input.value
    .split(',')
    .map(w => w.trim().toUpperCase())
    .filter(w => w.length > 0);
  
  return words;
};

// Check if a word should be treated as a special ligature
window.isSpecialLigatureWord = function(text, startIndex) {
  const useSpecial = document.getElementById('specialLigatures') ? 
    document.getElementById('specialLigatures').checked : false;
  
  if (!useSpecial) return null;
  
  const specialWords = window.getSpecialLigatureWords();
  const upperText = text.toUpperCase();
  
  for (const word of specialWords) {
    // Check if the text at startIndex matches this special word
    if (startIndex + word.length <= text.length) {
      const substring = upperText.substring(startIndex, startIndex + word.length);
      
      // Check if it matches and is a word boundary
      if (substring === word) {
        // Check word boundaries (start of text or after space, end of text or before space)
        const beforeOk = startIndex === 0 || text[startIndex - 1] === ' ';
        const afterOk = startIndex + word.length >= text.length || text[startIndex + word.length] === ' ';
        
        if (beforeOk && afterOk) {
          return word;
        }
      }
    }
  }
  
  return null;
};

// Cell class for managing individual tiles
window.Cell = class Cell {
  constructor(x, y, w, h, char, isFirst, type = 'normal', isSpace = false) {
    this.x = x | 0;
    this.y = y | 0;
    this.width = w | 0;
    this.height = h | 0;
    this.char = char;
    this.isFirstChar = !!isFirst;
    this.type = type;
    this.isSpace = !!isSpace;
  }
  
  drawBg(bgGroup) {
    const pad = parseInt(document.getElementById('paddingSlider').value || '0', 10);
    const bgX = this.x + pad, bgY = this.y + pad;
    const bgW = this.width - pad * 2, bgH = this.height - pad * 2;
    if (bgW <= 0 || bgH <= 0) return;

    const mode = document.querySelector('input[name="bgMode"]:checked')?.value || 'color';
    const applyColorTo = window.currentApplyColorTo();

    let bgFill = '#000000';
    if (mode === 'color') {
      if (this.isSpace && document.getElementById('customSpaceColor').checked) {
        bgFill = document.getElementById('spaceColorPicker').value.trim();
      } else {
        bgFill = (applyColorTo === 'background') ? window.tileBgColor(this.char) : document.getElementById('bgColorPicker').value.trim();
      }
    } else {
      const canvasBg = document.getElementById('bgColorPicker').value.trim();
      const cellBg = document.getElementById('cellBgColorPicker').value.trim();
      bgFill = (cellBg.toLowerCase() !== canvasBg.toLowerCase()) ? cellBg : canvasBg;
    }
    const opacity = (parseInt(document.getElementById('tileOpacitySlider').value || '100', 10)) / 100;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', bgX);
    rect.setAttribute('y', bgY);
    rect.setAttribute('width', bgW);
    rect.setAttribute('height', bgH);
    rect.setAttribute('fill', bgFill);
    rect.setAttribute('fill-opacity', String(opacity));
    bgGroup.appendChild(rect);
  }
  
  drawText(textGroup) {
    if (!document.getElementById('overlayText').checked) return;
    const pad = parseInt(document.getElementById('paddingSlider').value || '0', 10);
    const baseH = window.currentGridConfig?.bestConfig?.cellH || this.height;
    const overlayPct = parseInt(document.getElementById('overlayMarginSlider').value || '0', 10);
    const extra = Math.round(Math.max(1, baseH - 2 * pad) * (overlayPct / 100));
    const px = this.x + pad + extra, py = this.y + pad + extra;
    const pw = this.width - pad * 2 - extra * 2, ph = this.height - pad * 2 - extra * 2;
    if (pw <= 0 || ph <= 0) return;

    const mode = document.querySelector('input[name="bgMode"]:checked')?.value || 'color';
    const applyColorTo = window.currentApplyColorTo();
    let textColor = null;
    if (mode === 'color' && applyColorTo === 'text') {
      textColor = window.tileBgColor(this.char);
    }
    window.drawBezierChar(textGroup, px, py, pw, ph, this.char, this.isFirstChar, textColor);
  }
};

// Layout functions
window.largestRemainderQuotas = function(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => (w / sum) * total);
  const base = raw.map(Math.floor);
  let rem = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - base[i] })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && rem > 0; k++, rem--) base[order[k].i]++;
  return base;
};

window.planGrid = function(charData, rows, startCols = null) {
  const N = charData.length;
  const safeIDs = [], unsafeIDs = [], ligatureIDs = [];
  
  // Separate ligatures for special handling
  charData.forEach((c, i) => {
    if (c.isLigature && c.preferDouble) {
      ligatureIDs.push(i); // Ligatures get priority for double-width
    } else if (c.isFirstChar && window.canBeDoubled(c.char)) {
      safeIDs.push(i);  // Can be doubled
    } else {
      unsafeIDs.push(i);  // Cannot be doubled
    }
  });
  
  const pairs = [];
  for (let i = 0; i < unsafeIDs.length - 1; i++) {
    const a = unsafeIDs[i], b = unsafeIDs[i + 1];
    if (b === a + 1 && charData[a].wordIndex === charData[b].wordIndex) pairs.push(a);
  }
  
  // Prioritize ligatures for double-width allocation
  const availDoubles = safeIDs.length + ligatureIDs.length;
  const availDivides = pairs.length;
  const doublePct = parseInt(document.getElementById('doubleWidthSlider').value, 10) / 100;
  const halfPct = parseInt(document.getElementById('densitySlider').value, 10) / 100;
  
  // Ensure ligatures get double-width priority
  const ligatureDoubles = ligatureIDs.length;
  const remainingDoubles = Math.max(0, availDoubles - ligatureDoubles);
  const D_desired = ligatureDoubles + Math.round(remainingDoubles * doublePct);
  const V_desired = Math.round(availDivides * halfPct);

  const hintCols = startCols ?? Math.max(1, Math.round((N + D_desired - V_desired) / rows));
  let best = null;
  
  function feasible(cols) {
    const total = rows * cols, delta = total - N;
    if (delta >= 0) {
      if (delta <= availDoubles) return { cols, D: delta, V: 0, total };
    } else {
      const need = -delta;
      if (need <= availDivides) return { cols, D: 0, V: need, total };
    }
    return null;
  }
  
  for (let radius = 0; radius <= rows * 6; radius++) {
    const candidates = [hintCols - radius, hintCols + radius].filter(c => c >= 1);
    for (const c of candidates) {
      const p = feasible(c);
      if (!p) continue;
      const jitter = window.rand() * 0.1;
      const score = Math.abs(p.D - D_desired) + Math.abs(p.V - V_desired) + (c * 0.001) + jitter;
      if (!best || score < best.score) best = { ...p, score };
    }
    if (best) break;
  }
  
  if (!best) {
    let c = Math.max(1, hintCols), tries = 0;
    while (!best && tries < 200) {
      const p = feasible(c);
      if (p) best = { ...p, score: 1e6 };
      c++;
      tries++;
    }
  }
  
  const cols = best.cols, totalCells = rows * cols;
  const basePerRow = Math.floor(totalCells / rows), rem = totalCells - basePerRow * rows;
  const addOrder = window.rotate([...Array(rows).keys()], Math.floor(window.rand() * rows));
  const targetRowCells = Array.from({ length: rows }, () => basePerRow);
  for (let i = 0; i < rem; i++) {
    targetRowCells[addOrder[i]]++;
  }
  
  let quotasD = window.largestRemainderQuotas(best.D, targetRowCells);
  let quotasV = window.largestRemainderQuotas(best.V, targetRowCells);
  quotasD = window.rotate(quotasD, Math.floor(window.rand() * rows));
  quotasV = window.rotate(quotasV, Math.floor(window.rand() * rows));
  
  return {
    cols, rows, totalCells, targetRowCells, quotasD, quotasV, pairs,
    plan: { D: best.D, V: best.V },
    desired: { D: D_desired, V: V_desired }
  };
};

window.packRows = function(charData, plan) {
  const { rows, targetRowCells, quotasD, quotasV, pairs } = plan;
  const pairSet = new Set(pairs);
  const consumed = new Set();
  const placements = [];
  let globalCellsRemaining = targetRowCells.reduce((a, b) => a + b, 0);
  let globalCharsRemaining = charData.length;

  let i = 0;
  for (let r = 0; r < rows; r++) {
    let cellsLeft = targetRowCells[r], rowD = quotasD[r] || 0, rowV = quotasV[r] || 0;
    while (cellsLeft > 0) {
      if (i >= charData.length) {
        cellsLeft = 0;
        break;
      }
      if (consumed.has(i)) {
        i++;
        continue;
      }
      const cur = charData[i], next = (i + 1 < charData.length) ? charData[i + 1] : null;
      
      // Prioritize ligatures for double-width
      const isLigature = cur.isLigature && cur.preferDouble;
      const canDouble = isLigature || (cur.isFirstChar && window.canBeDoubled(cur.char));
      
      const canDivide = next && pairSet.has(i) && !consumed.has(i + 1);
      const safeToDivide = canDivide && (globalCharsRemaining - 2) >= (globalCellsRemaining - 1);

      // If it's a ligature and we have space, always try to make it double-width
      if (cellsLeft >= 2 && isLigature) {
        placements.push({ row: r, kind: 'double', ids: [i] });
        consumed.add(i);
        i++;
        cellsLeft -= 2;
        globalCellsRemaining -= 2;
        globalCharsRemaining -= 1;
        if (rowD > 0) rowD--;
        continue;
      }

      if (cellsLeft >= 2 && canDouble && rowD > 0 && safeToDivide && rowV > 0) {
        const pickDouble = (rowD / (rowD + rowV)) > window.rand();
        if (pickDouble) {
          placements.push({ row: r, kind: 'double', ids: [i] });
          consumed.add(i);
          i++;
          cellsLeft -= 2;
          globalCellsRemaining -= 2;
          globalCharsRemaining -= 1;
          rowD--;
          continue;
        } else {
          placements.push({ row: r, kind: 'divided', ids: [i, i + 1] });
          consumed.add(i);
          consumed.add(i + 1);
          i += 2;
          cellsLeft -= 1;
          globalCellsRemaining -= 1;
          globalCharsRemaining -= 2;
          rowV--;
          continue;
        }
      }
      if (cellsLeft >= 2 && canDouble && rowD > 0) {
        placements.push({ row: r, kind: 'double', ids: [i] });
        consumed.add(i);
        i++;
        cellsLeft -= 2;
        globalCellsRemaining -= 2;
        globalCharsRemaining -= 1;
        rowD--;
        continue;
      }
      if (safeToDivide && rowV > 0) {
        placements.push({ row: r, kind: 'divided', ids: [i, i + 1] });
        consumed.add(i);
        consumed.add(i + 1);
        i += 2;
        cellsLeft -= 1;
        globalCellsRemaining -= 1;
        globalCharsRemaining -= 2;
        rowV--;
        continue;
      }
      if (cellsLeft >= 2 && canDouble) {
        placements.push({ row: r, kind: 'double', ids: [i] });
        consumed.add(i);
        i++;
        cellsLeft -= 2;
        globalCellsRemaining -= 2;
        globalCharsRemaining -= 1;
        continue;
      }
      if (safeToDivide) {
        placements.push({ row: r, kind: 'divided', ids: [i, i + 1] });
        consumed.add(i);
        consumed.add(i + 1);
        i += 2;
        cellsLeft -= 1;
        globalCellsRemaining -= 1;
        globalCharsRemaining -= 2;
        continue;
      }
      placements.push({ row: r, kind: 'normal', ids: [i] });
      consumed.add(i);
      i++;
      cellsLeft -= 1;
      globalCellsRemaining -= 1;
      globalCharsRemaining -= 1;
    }
  }
  const usedChars = [...consumed].length;
  return { placements, usedChars };
};

// Basic balanced layout with ligature support
window.layoutBasicBalanced = function(rows, innerW, innerH, size) {
  let original = (document.getElementById('phraseInput').value || '')
    .toUpperCase().replace(/[""]/g, '"').replace(/\u2014/g, '-').replace(/…/g, '...').trim();
  const words = original.length ? original.split(/\s+/) : [];
  if (words.length === 0) return { cells: [], bestConfig: null };

  const includeSpaces = document.getElementById('includeSpaces').checked;

  // Calculate word lengths considering ligatures (if available)
  const wordLens = words.map(word => {
    let len = 0;
    let i = 0;
    while (i < word.length) {
      // Check for ligatures only if function exists
      let ligature = null;
      if (typeof window.getLigatureAt === 'function') {
        ligature = window.getLigatureAt(word, i);
      }
      
      if (ligature) {
        len++; // Ligature counts as 1 character
        i += ligature.length;
      } else {
        len++;
        i++;
      }
    }
    return len;
  });
  
  const totalChars = wordLens.reduce((a, b) => a + b, 0) + (includeSpaces ? Math.max(0, words.length - 1) : 0);

  const target = Math.max(1, Math.round(totalChars / rows));
  const maxPerLine = Math.max(target, Math.floor(target * 1.35));

  const n = words.length, prefixLen = [0];
  for (let i = 0; i < n; i++) prefixLen[i + 1] = prefixLen[i] + wordLens[i];
  const lineLen = (i, j) => (prefixLen[j + 1] - prefixLen[i]) + (includeSpaces ? (j - i) : 0);
  const bad = (len, isLast) => {
    if (len < 1 || len > maxPerLine) return 1e9;
    return isLast ? Math.pow(Math.max(0, len - target), 2) * 0.5 : Math.pow(Math.abs(len - target), 2);
  };

  const dp = Array.from({ length: rows + 1 }, () => Array(n + 1).fill(1e15));
  const prev = Array.from({ length: rows + 1 }, () => Array(n + 1).fill(-1));
  dp[0][0] = 0;
  for (let k = 1; k <= rows; k++) {
    for (let j = 1; j <= n; j++) {
      for (let i = 0; i < j; i++) {
        const len = lineLen(i, j - 1), isLast = (k === rows && j === n);
        const cost = dp[k - 1][i] + bad(len, isLast);
        if (cost < dp[k][j]) {
          dp[k][j] = cost;
          prev[k][j] = i;
        }
      }
    }
  }
  let k = rows, j = n, splits = [];
  while (k > 0 && j > 0) {
    const i = prev[k][j];
    if (i < 0) {
      splits = [[0, n - 1]];
      break;
    }
    splits.push([i, j - 1]);
    j = i;
    k--;
  }
  splits.reverse();

  const lines = splits.map(([i, j]) => {
    if (includeSpaces) {
      const spaceChar = document.getElementById('replaceSpaceChar').checked ? (document.getElementById('replaceCharText').value || '_') : ' ';
      return words.slice(i, j + 1).join(spaceChar);
    } else {
      return words.slice(i, j + 1).join('');
    }
  });
  while (lines.length < rows) lines.push('');

  const longestLen = Math.max(1, ...lines.map(line => {
    // Count visual length considering ligatures
    let len = 0;
    let i = 0;
    while (i < line.length) {
      // Check for ligatures only if function exists
      let ligature = null;
      if (typeof window.getLigatureAt === 'function') {
        ligature = window.getLigatureAt(line, i);
      }
      
      if (ligature) {
        len++;
        i += ligature.length;
      } else {
        len++;
        i++;
      }
    }
    return len;
  }));
  
  const cellH = Math.max(1, Math.floor(innerH / rows));
  const cellW = Math.max(1, Math.floor(innerW / longestLen));
  const startY = Math.floor((size.height - rows * cellH) / 2);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    const line = lines[r] || '';
    if (line.length === 0) continue;
    
    // Process line with ligature awareness
    let visualCells = [];
    let charIndex = 0;
    
    while (charIndex < line.length) {
      // Check for ligatures only if function exists
      let ligature = null;
      if (typeof window.getLigatureAt === 'function') {
        ligature = window.getLigatureAt(line, charIndex);
      }
      
      if (ligature) {
        // Add ligature as single cell
        const isFirst = (charIndex === 0 || line[charIndex - 1] === ' ');
        const isSpace = false;
        visualCells.push({
          char: ligature,
          isFirst: isFirst,
          isSpace: isSpace,
          originalIndex: charIndex
        });
        charIndex += ligature.length;
      } else {
        // Regular character
        const ch = line[charIndex];
        const isFirst = isFirstCharInBasic(line, charIndex);
        const isSpace = (includeSpaces && (ch === ' ' || (document.getElementById('replaceSpaceChar').checked && ch === (document.getElementById('replaceCharText').value || '_'))));
        visualCells.push({
          char: ch,
          isFirst: isFirst,
          isSpace: isSpace,
          originalIndex: charIndex
        });
        charIndex++;
      }
    }
    
    const nChars = visualCells.length;
    const rowW = nChars * cellW;
    const startX = Math.floor((size.width - rowW) / 2);
    
    visualCells.forEach((cellData, c) => {
      const x = startX + c * cellW;
      const y = startY + r * cellH;
      cells.push(new window.Cell(x, y, cellW, cellH, cellData.char, cellData.isFirst, 'normal', cellData.isSpace));
    });
  }
  
  return { cells, bestConfig: { rows, cols: longestLen, cellW, cellH, totalCells: cells.length } };
};

function isFirstCharInBasic(line, idx) {
  if (!line[idx] || line[idx] === ' ') return false;
  if (idx === 0) return true;
  return line[idx - 1] === ' ';
}

// Parse character data with ligature support and narrow set consideration
window.parseCharDataForText = function(text) {
  const includeSpaces = document.getElementById('includeSpaces').checked;
  const useFirstTwoLigatures = document.getElementById('firstTwoLigatures') ? 
    document.getElementById('firstTwoLigatures').checked : false;
  const charData = [];
  let wordIndex = 0;
  let i = 0;
  let isStartOfWord = true; // Track if we're at the start of a word
  let charsInCurrentWord = 0; // Track position within current word
  
  while (i < text.length) {
    const ch = text[i];
    
    // Check for spaces
    if (ch === ' ') {
      if (!includeSpaces) {
        wordIndex++;
        i++;
        isStartOfWord = true; // Next char will be start of word
        charsInCurrentWord = 0;
        continue;
      }
      // Include space
      const displayChar = document.getElementById('replaceSpaceChar').checked 
        ? (document.getElementById('replaceCharText').value || '_') 
        : ' ';
      charData.push({ 
        char: displayChar, 
        isFirstChar: false, 
        wordIndex, 
        originalIndex: i, 
        isSpace: true,
        canDouble: false,  // Spaces can't be doubled
        isLigature: false,
        preferDouble: false
      });
      wordIndex++;
      i++;
      isStartOfWord = true; // Next char will be start of word
      charsInCurrentWord = 0;
      continue;
    }
    
    // FIRST CHECK: Special ligature words
    const specialWord = window.isSpecialLigatureWord(text, i);
    if (specialWord && window.hasLigature && window.hasLigature(specialWord)) {
      // Found a special word that has a ligature definition
      charData.push({ 
        char: specialWord,  // Store the full word as ligature
        isFirstChar: true,  // Special words are always treated as first
        wordIndex, 
        originalIndex: i, 
        isSpace: false,
        canDouble: true,  // ALWAYS allow special ligatures to be doubled
        isLigature: true,
        preferDouble: true,
        isSpecial: true  // Mark as special ligature
      });
      
      // Skip ahead by the length of the special word
      i += specialWord.length;
      charsInCurrentWord += specialWord.length;
      isStartOfWord = false;
      
      // Check if next char is a space to update word index
      if (i < text.length && text[i] === ' ') {
        wordIndex++;
        isStartOfWord = true;
        charsInCurrentWord = 0;
      }
      continue;
    }
    
    // REGULAR LIGATURE CHECK: Only check first 2 chars of word if checkbox is checked
    let ligature = null;
    if (typeof window.getLigatureAt === 'function') {
      // Only check for ligatures if:
      // 1. The checkbox is unchecked (use ligatures everywhere) OR
      // 2. The checkbox is checked AND we're at the start of a word (first potential ligature position)
      if (!useFirstTwoLigatures || (useFirstTwoLigatures && isStartOfWord && charsInCurrentWord === 0)) {
        ligature = window.getLigatureAt(text, i);
        
        // If checkbox is checked and ligature found, verify it's only 2 characters
        if (useFirstTwoLigatures && ligature && ligature.length !== 2) {
          ligature = null; // Reject ligatures that aren't exactly 2 characters
        }
      }
    }
    
    if (ligature) {
      // Found a ligature! Treat it as a single character
      const isFirst = isStartOfWord;
      charData.push({ 
        char: ligature,  // Store the full ligature (e.g., "SO")
        isFirstChar: isFirst,  // First if at start of word
        wordIndex, 
        originalIndex: i, 
        isSpace: false,
        canDouble: true,  // ALWAYS allow ligatures to be doubled
        isLigature: true, // Mark as ligature for preferential double-width treatment
        preferDouble: true, // Preference for double-width
        isSpecial: false
      });
      
      // Skip ahead by the length of the ligature
      i += ligature.length;
      charsInCurrentWord += ligature.length;
      isStartOfWord = false; // No longer at start of word
      
      // Check if next char is a space to update word index
      if (i < text.length && text[i] === ' ') {
        wordIndex++;
        isStartOfWord = true;
        charsInCurrentWord = 0;
      }
    } else {
      // No ligature, process as normal character
      const isFirstInWord = isStartOfWord;
      
      charData.push({ 
        char: ch, 
        isFirstChar: isFirstInWord, 
        wordIndex, 
        originalIndex: i, 
        isSpace: false,
        canDouble: isFirstInWord && window.canBeDoubled(ch),  // Check if can be doubled
        isLigature: false,
        preferDouble: false,
        isSpecial: false
      });
      
      i++;
      charsInCurrentWord++;
      isStartOfWord = false; // No longer at start of word
      
      // Check if next char is a space to update word index
      if (i < text.length && text[i] === ' ') {
        wordIndex++;
        isStartOfWord = true;
        charsInCurrentWord = 0;
      }
    }
  }
  
  return charData;
};