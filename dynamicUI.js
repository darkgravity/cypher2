// =================== DYNAMIC UI MODULE ===================
// Handles UI interactions, controls, and modals

// Helper functions
window.$ = sel => document.querySelector(sel);
window.$$ = sel => Array.from(document.querySelectorAll(sel));
window.clamp = (v, min, max) => Math.max(min, Math.min(max, v));
window.on = (el, ev, fn) => { el.addEventListener(ev, fn); return el; };
window.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
window.validateHexColor = (hex) => { const m = /^#([0-9A-Fa-f]{6})$/.exec(hex); return m ? hex.toUpperCase() : null; };

// Redraw with debounce
window.redrawGrid = window.debounce(() => window.generateGrid(false, window.lastRunSeed), 0);

// Auto rows evaluation
window.evaluateTessRows = function(rows, charData, innerW, innerH, size) {
  let colsHint = null, success = false, tries = 0, chosenCols = null;
  while (!success && tries < 120) {
    const plan = window.planGrid(charData, rows, colsHint);
    const cols = plan.cols;
    const cellW = Math.max(1, Math.floor(innerW / cols));
    const cellH = Math.max(1, Math.floor(innerH / rows));
    const { placements, usedChars } = window.packRows(charData, plan);
    const totalCells = rows * cols;
    const placedCells = placements.reduce((s, p) => s + (p.kind === 'double' ? 2 : 1), 0);
    const usedAll = (usedChars === charData.length);
    const filledAll = (placedCells === totalCells);
    if (usedAll && filledAll) {
      chosenCols = cols;
      success = true;
      break;
    }
    colsHint = !filledAll ? Math.max(1, plan.cols - 1) : plan.cols + 1;
    tries++;
  }
  if (!success) return { score: Infinity };
  const cols = chosenCols;
  const cellW = Math.max(1, Math.floor(innerW / cols));
  const cellH = Math.max(1, Math.floor(innerH / rows));

  let score = 0;
  const ar = cellW / cellH;
  score += Math.abs(Math.log(ar)) * 3;
  const minDim = Math.min(cellW, cellH);
  if (minDim < 22) score += (22 - minDim) * 1.4;
  if (minDim > 120) score += (minDim - 120) * 0.6;
  if (cols < 6) score += (6 - cols) * 0.8;
  if (cols > 40) score += (cols - 40) * 0.5;
  const ratio = cols / rows;
  if (ratio < 0.8) score += (0.8 - ratio) * 10;
  if (ratio > 3.0) score += (ratio - 3.0) * 10;
  if (rows % 2 !== 0) score += 0.15;
  if (typeof window.lastAutoRows === 'number') score += Math.abs(rows - window.lastAutoRows) * 0.02;

  return { score, cols, cellW, cellH };
};

window.evaluateBasicRows = function(rows, innerW, innerH, size) {
  const out = window.layoutBasicBalanced(rows, innerW, innerH, size);
  if (!out.bestConfig) return { score: Infinity };
  const { cols, cellW, cellH } = out.bestConfig;
  let score = 0;
  const ar = cellW / cellH;
  score += Math.abs(Math.log(ar)) * 3;
  const minDim = Math.min(cellW, cellH);
  if (minDim < 22) score += (22 - minDim) * 1.4;
  if (minDim > 120) score += (minDim - 120) * 0.6;
  if (cols < 6) score += (6 - cols) * 0.8;
  if (cols > 40) score += (cols - 40) * 0.5;
  const ratio = cols / rows;
  if (ratio < 0.8) score += (0.8 - ratio) * 10;
  if (ratio > 3.0) score += (ratio - 3.0) * 10;
  if (rows % 2 !== 0) score += 0.15;
  if (typeof window.lastAutoRows === 'number') score += Math.abs(rows - window.lastAutoRows) * 0.02;

  return { score, cols, cellW, cellH };
};

window.pickBestRowsForCurrentText = function() {
  const rawText = (window.$('#phraseInput').value || window.DEFAULT_QUOTE)
    .toUpperCase().replace(/[""]/g, '"').replace(/\u2014/g, '-').replace(/…/g, '...');
  const size = window.getCanvasSize();
  const margin = parseInt(window.$('#marginSlider').value || '0', 10);
  const innerW = Math.max(1, size.width - margin * 2), innerH = Math.max(1, size.height - margin * 2);

  const gridType = document.querySelector('input[name="gridType"]:checked')?.value || 'tessellated';

  let best = { rows: parseInt(window.$('#rowSlider').value, 10) || 15, score: Infinity };
  const RMIN = 1, RMAX = 50;

  if (gridType === 'tessellated') {
    const charData = window.parseCharDataForText(rawText);
    if (charData.length === 0) return best.rows;
    for (let r = RMIN; r <= RMAX; r++) {
      const e = window.evaluateTessRows(r, charData, innerW, innerH, size);
      if (e.score < best.score) {
        best = { rows: r, score: e.score };
      }
    }
  } else {
    for (let r = RMIN; r <= RMAX; r++) {
      const e = window.evaluateBasicRows(r, innerW, innerH, size);
      if (e.score < best.score) {
        best = { rows: r, score: e.score };
      }
    }
  }
  return best.rows;
};

window.pickBestRowsBasicOnly = function() {
  const size = window.getCanvasSize();
  const margin = parseInt(window.$('#marginSlider').value || '0', 10);
  const innerW = Math.max(1, size.width - margin * 2), innerH = Math.max(1, size.height - margin * 2);
  let best = { rows: parseInt(window.$('#rowSlider').value, 10) || 15, score: Infinity };
  for (let r = 1; r <= 50; r++) {
    const e = window.evaluateBasicRows(r, innerW, innerH, size);
    if (e.score < best.score) {
      best = { rows: r, score: e.score };
    }
  }
  return best.rows;
};

// Auto-rows with debounce
window.autoPickRowsAndRedraw = window.debounce(() => {
  if (!window.$('#autoRows').checked) {
    window.currentCells = null;
    window.generateGrid(false);
    return;
  }
  const best = window.pickBestRowsForCurrentText();
  const current = parseInt(window.$('#rowSlider').value, 10) || 15;
  if (best !== current) {
    window.$('#rowSlider').value = best;
  }
  window.lastAutoRows = best;
  window.currentCells = null;
  window.generateGrid(true);
}, 120);

// Export helpers
window.flashButton = function(sel) {
  const btn = window.$(sel);
  if (!btn) return;
  const old = btn.style.boxShadow;
  btn.style.boxShadow = '0 0 0 3px rgba(23,162,184,.7)';
  setTimeout(() => btn.style.boxShadow = old, 350);
};

window.buildSerializedSvg = function(w, h) {
  const original = window.$('#stage');
  const clone = original.cloneNode(true);
  clone.removeAttribute('style');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
};

// Export functions
window.exportSVG = async function(mode) {
  const restore = () => { window.EXPORT_SIZE_OVERRIDE = null; window.generateGrid(false, window.lastRunSeed); };
  try {
    if (mode === 'current') {
      const stage = window.$('#stage');
      const vb = (stage.getAttribute('viewBox') || '0 0 1024 768').trim().split(/\s+/).map(Number);
      const w = Math.max(1, Math.round(vb[2] || stage.clientWidth || 1024));
      const h = Math.max(1, Math.round(vb[3] || stage.clientHeight || 768));
      const xml = window.buildSerializedSvg(w, h);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tessellation.svg';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    } else {
      const cssW = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth;
      const cssH = (window.screen && window.screen.height) ? window.screen.height : window.innerHeight;
      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      const w = Math.max(1, cssW * dpr);
      const h = Math.max(1, cssH * dpr);
      window.EXPORT_SIZE_OVERRIDE = { w, h };
      window.generateGrid(false, window.lastRunSeed);
      const xml = window.buildSerializedSvg(w, h);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tessellation-screen.svg';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    }
  } catch (err) {
    console.error(err);
    alert('Saving SVG failed.');
  } finally {
    restore();
  }
};

window.exportCopy = async function(mode) {
  const restore = () => { window.EXPORT_SIZE_OVERRIDE = null; window.generateGrid(false, window.lastRunSeed); };
  try {
    let w, h;
    if (mode === 'current') {
      const stage = window.$('#stage');
      const vb = (stage.getAttribute('viewBox') || '0 0 1024 768').trim().split(/\s+/).map(Number);
      w = Math.max(1, Math.round(vb[2] || stage.clientWidth || 1024));
      h = Math.max(1, Math.round(vb[3] || stage.clientHeight || 768));
    } else {
      const cssW = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth;
      const cssH = (window.screen && window.screen.height) ? window.screen.height : window.innerHeight;
      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      w = Math.max(1, cssW * dpr);
      h = Math.max(1, cssH * dpr);
      window.EXPORT_SIZE_OVERRIDE = { w, h };
      window.generateGrid(false, window.lastRunSeed);
    }
    const xml = window.buildSerializedSvg(w, h);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(xml);
    } else {
      const ta = document.createElement('textarea');
      ta.value = xml;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    window.flashButton('#copyBtn');
  } catch (err) {
    console.error(err);
    alert('Copy failed.');
  } finally {
    restore();
  }
};

// PNG export
window.svgToPng = function(w, h, filename = 'tessellation.png') {
  return new Promise((resolve, reject) => {
    const xml = window.buildSerializedSvg(w, h);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        if (canvas.toBlob) {
          canvas.toBlob(blob => {
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(pngUrl); URL.revokeObjectURL(url); resolve(); }, 0);
          }, 'image/png');
        } else {
          const dataURL = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataURL;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); resolve(); }, 0);
        }
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG to PNG conversion failed'));
    };
    img.src = url;
  });
};

window.exportPNG = async function(mode) {
  const restore = () => { window.EXPORT_SIZE_OVERRIDE = null; window.generateGrid(false, window.lastRunSeed); };
  try {
    if (mode === 'current') {
      const stage = window.$('#stage');
      const vb = (stage.getAttribute('viewBox') || '0 0 1024 768').trim().split(/\s+/).map(Number);
      const w = Math.max(1, Math.round(vb[2] || stage.clientWidth || 1024));
      const h = Math.max(1, Math.round(vb[3] || stage.clientHeight || 768));
      await window.svgToPng(w, h, 'tessellation.png');
    } else {
      const cssW = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth;
      const cssH = (window.screen && window.screen.height) ? window.screen.height : window.innerHeight;
      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      const w = Math.max(1, cssW * dpr);
      const h = Math.max(1, cssH * dpr);
      window.EXPORT_SIZE_OVERRIDE = { w, h };
      window.generateGrid(false, window.lastRunSeed);
      await window.svgToPng(w, h, 'tessellation-screen.png');
    }
  } catch (err) {
    console.error(err);
    alert('Saving image failed.');
  } finally {
    restore();
  }
};

// Modal functions
window.openModal = function(el) {
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
};

window.closeModal = function(el) {
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
};

// Canvas sizing
window.applyCanvasSizingUI = function() {
  const stage = window.$('#stage');
  const art = window.$('#artboard');
  if (window.$('#screenSize').checked) {
    art.style.width = '100%';
    art.style.height = '100%';
    stage.style.width = '100%';
    stage.style.height = '100%';
    window.$('#canvasContainer').style.backgroundColor = window.$('#bgColorPicker').value.trim();
  } else {
    const w = parseInt(window.$('#canvasWidth').value || '1200', 10);
    const h = parseInt(window.$('#canvasHeight').value || '800', 10);
    art.style.width = w + 'px';
    art.style.height = h + 'px';
    stage.style.width = '100%';
    stage.style.height = '100%';
    window.$('#canvasContainer').style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--app-bg') || '#1a1a1a';
  }
};

// UI state functions
window.updateOverlayUIEnabled = function() {
  const overlay = window.$('#overlayText').checked;
  window.$('#overlayMarginRow').classList.toggle('disabled', !overlay);
  ['#firstLetterColorPicker', '#firstLetterColorText', '#firstThickness',
    '#otherTextColorPicker', '#otherTextColorText', '#otherThickness',
    '#textOpacitySlider', '#syncOtherToggle']
    .forEach(sel => {
      const el = window.$(sel);
      if (!el) return;
      (!overlay) ? el.setAttribute('disabled', 'disabled') : el.removeAttribute('disabled');
    });
  window.updateOtherControlsState();
};

window.updateOtherControlsState = function() {
  const overlay = window.$('#overlayText').checked;
  const sync = window.$('#syncOtherToggle').checked;
  const disable = !overlay || sync;
  ['#otherTextColorPicker', '#otherTextColorText', '#otherThickness'].forEach(sel => {
    const el = window.$(sel);
    if (!el) return;
    if (disable) el.setAttribute('disabled', 'disabled');
    else el.removeAttribute('disabled');
  });
};

window.syncOtherFromInitial = function() {
  const color = window.$('#firstLetterColorPicker').value;
  window.$('#otherTextColorPicker').value = color;
  window.$('#otherTextColorText').value = color;
  window.$('#otherThickness').value = window.$('#firstThickness').value;
};

window.toggleSpaceControls = function() {
  const showSpaceColor = window.$('#customSpaceColor').checked;
  window.$('#spaceColorRow').style.display = showSpaceColor ? 'flex' : 'none';
};

window.updateReplaceCharVisibility = function() {
  window.$('#replaceCharRow').style.display = window.$('#replaceSpaceChar').checked ? 'flex' : 'none';
};

window.updateSpaceControlsVisibility = function() {
  const inc = window.$('#includeSpaces').checked;
  window.$('#spaceControls').style.display = inc ? 'block' : 'none';
};

window.bindHexPair = function(pickerSel, textSel, onChange) {
  window.on(window.$(pickerSel), 'input', () => {
    const v = window.$(pickerSel).value;
    window.$(textSel).value = v;
    onChange();
  });
  window.on(window.$(textSel), 'input', () => {
    const valid = window.validateHexColor(window.$(textSel).value.trim());
    if (valid) {
      window.$(pickerSel).value = valid;
      onChange();
    }
  });
};