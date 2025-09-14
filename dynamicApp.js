// =================== DYNAMIC APP MODULE ===================
// Main application initialization and UI wiring

// Fullscreen UI auto-hide
let uiHideTimer = null;

function shouldAutoHideUI() {
  return !!document.fullscreenElement && document.body.classList.contains('sidebar-collapsed');
}

function showUI() {
  document.body.classList.remove('fullscreen-ui-hidden');
}

function scheduleHideUI() {
  clearTimeout(uiHideTimer);
  if (shouldAutoHideUI()) {
    uiHideTimer = setTimeout(() => {
      document.body.classList.add('fullscreen-ui-hidden');
    }, 3000);
  } else {
    showUI();
  }
}

function pokeUI() {
  showUI();
  scheduleHideUI();
}

function bindInteractionWake() {
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach(ev => {
    document.addEventListener(ev, pokeUI, { passive: true });
  });
}

// First render handling
let firstDrawDone = false;

function tryRenderNow() {
  if (firstDrawDone) return;
  window.currentCells = null;
  window.generateGrid(true);
  const hasTiles = !!window.$('#textTiles') || !!window.$('#bgTiles');
  if (hasTiles) firstDrawDone = true;
}

function setupFirstRenderWatchers() {
  const container = window.$('#canvasContainer');
  if (window.ResizeObserver && container) {
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          tryRenderNow();
        }
      }
    });
    ro.observe(container);
  }
  let attempts = 0;
  const tick = () => {
    if (firstDrawDone || attempts > 20) return;
    attempts++;
    tryRenderNow();
    setTimeout(tick, 75);
  };
  setTimeout(tick, 0);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => tryRenderNow());
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => tryRenderNow(), { timeout: 200 });
  } else {
    setTimeout(() => tryRenderNow(), 200);
  }
}

// UI functions
function toggleSidebar() {
  const b = window.$('#toggleSidebar');
  document.body.classList.toggle('sidebar-collapsed');
  b.textContent = document.body.classList.contains('sidebar-collapsed') ? '→' : '×';
  setTimeout(() => {
    window.currentCells = null;
    window.generateGrid(true);
    scheduleHideUI();
  }, 300);
}

function toggleFullscreen() {
  const btn = window.$('#fullscreenBtn');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      btn.title = 'Exit Fullscreen';
    });
  } else {
    document.exitFullscreen().then(() => {
      btn.title = 'Toggle Fullscreen';
    });
  }
}

// Initialize application
window.addEventListener('load', async () => {
  // Initialize characters from file
  await window.initializeDynamicCharacters();
  
  // Initialize beveled corners if needed
  if (typeof window.updateCornersDynamic === 'function') {
    window.updateCornersDynamic();
    if (typeof window.setCornerMode === 'function') {
      window.setCornerMode('tile');
    }
  }
  
  // Seed textarea before renders
  const ta = window.$('#phraseInput');
  ta.value = window.DEFAULT_QUOTE;

  // Buttons
  window.on(window.$('#toggleSidebar'), 'click', toggleSidebar);
  window.on(window.$('#regen'), 'click', () => {
    if ((document.querySelector('input[name="gridType"]:checked')?.value || 'tessellated') === 'tessellated') {
      const r = () => Math.round(10 + window.rand() * 80);
      window.$('#densitySlider').value = r();
      window.$('#doubleWidthSlider').value = r();
    }
    window.currentCells = null;
    window.generateGrid(true);
  });
  window.on(window.$('#saveBtn'), 'click', () => window.openModal(window.$('#saveSvgModal')));
  window.on(window.$('#copyBtn'), 'click', () => window.openModal(window.$('#copySvgModal')));
  window.on(window.$('#saveImageBtn'), 'click', () => window.openModal(window.$('#saveImageModal')));

  // Modals
  window.on(window.$('#exportCancelBtn'), 'click', () => window.closeModal(window.$('#saveImageModal')));
  window.on(window.$('#saveImageModal'), 'click', (e) => {
    if (e.target === e.currentTarget) window.closeModal(window.$('#saveImageModal'));
  });
  window.on(window.$('#exportCurrentBtn'), 'click', () => {
    window.closeModal(window.$('#saveImageModal'));
    window.exportPNG('current');
  });
  window.on(window.$('#exportScreenBtn'), 'click', () => {
    window.closeModal(window.$('#saveImageModal'));
    window.exportPNG('screen');
  });

  window.on(window.$('#svgCancelBtn'), 'click', () => window.closeModal(window.$('#saveSvgModal')));
  window.on(window.$('#saveSvgModal'), 'click', (e) => {
    if (e.target === e.currentTarget) window.closeModal(window.$('#saveSvgModal'));
  });
  window.on(window.$('#svgCurrentBtn'), 'click', () => {
    window.closeModal(window.$('#saveSvgModal'));
    window.exportSVG('current');
  });
  window.on(window.$('#svgScreenBtn'), 'click', () => {
    window.closeModal(window.$('#saveSvgModal'));
    window.exportSVG('screen');
  });

  window.on(window.$('#copyCancelBtn'), 'click', () => window.closeModal(window.$('#copySvgModal')));
  window.on(window.$('#copySvgModal'), 'click', (e) => {
    if (e.target === e.currentTarget) window.closeModal(window.$('#copySvgModal'));
  });
  window.on(window.$('#copyCurrentBtn'), 'click', () => {
    window.closeModal(window.$('#copySvgModal'));
    window.exportCopy('current');
  });
  window.on(window.$('#copyScreenBtn'), 'click', () => {
    window.closeModal(window.$('#copySvgModal'));
    window.exportCopy('screen');
  });

  window.on(window.$('#fullscreenBtn'), 'click', toggleFullscreen);

  // Canvas size
  window.on(window.$('#screenSize'), 'change', () => {
    window.$('#manualSize').classList.toggle('disabled', window.$('#screenSize').checked);
    window.applyCanvasSizingUI();
    window.currentCells = null;
    window.generateGrid(true);
  });
  window.on(window.$('#canvasWidth'), 'change', () => {
    window.applyCanvasSizingUI();
    window.currentCells = null;
    window.generateGrid(true);
  });
  window.on(window.$('#canvasHeight'), 'change', () => {
    window.applyCanvasSizingUI();
    window.currentCells = null;
    window.generateGrid(true);
  });

  // Grid controls
  window.on(window.$('#rowSlider'), 'input', () => {
    window.$('#autoRows').checked = false;
    window.currentCells = null;
    window.generateGrid(true);
  });
  window.on(window.$('#autoRows'), 'change', () => {
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    }
  });
  window.on(window.$('#rowSlider'), 'change', () => {
    window.lastAutoRows = parseInt(window.$('#rowSlider').value, 10) || 15;
  });

  window.on(window.$('#densitySlider'), 'input', () => {
    window.currentCells = null;
    window.generateGrid(true);
  });
  window.on(window.$('#doubleWidthSlider'), 'input', () => {
    window.currentCells = null;
    window.generateGrid(true);
  });

  window.on(window.$('#paddingSlider'), 'input', window.redrawGrid);
  window.on(window.$('#marginSlider'), 'input', () => {
    window.currentCells = null;
    window.generateGrid(true);
  });

  // First 2 ligatures checkbox
  window.on(window.$('#firstTwoLigatures'), 'change', () => {
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.currentCells = null;
      window.generateGrid(true);
    }
  });

  // Special ligatures checkbox
  window.on(window.$('#specialLigatures'), 'change', () => {
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.currentCells = null;
      window.generateGrid(true);
    }
  });

  // Special ligatures list input
  window.on(window.$('#specialLigaturesList'), 'input', window.debounce(() => {
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.currentCells = null;
      window.generateGrid(true);
    }
  }, 500)); // Debounce to avoid too many updates while typing

  // Mode switches
  window.$$('input[name="bgMode"]').forEach(el => window.on(el, 'change', () => {
    const mode = document.querySelector('input[name="bgMode"]:checked')?.value || 'color';
    window.$('#singleControls').style.display = mode === 'single' ? 'block' : 'none';
    window.$('#colorControls').style.display = mode === 'color' ? 'block' : 'none';
    if (mode === 'color') {
      window.$('#overlayText').checked = true;
    }
    window.updateOverlayUIEnabled();
    window.toggleSpaceControls();
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.currentCells = null;
      window.generateGrid(true);
    }
  }));
  window.$$('input[name="applyColor"]').forEach(el => window.on(el, 'change', () => {
    window.currentCells = null;
    window.generateGrid(true);
  }));
  window.$$('input[name="gridType"]').forEach(el => window.on(el, 'change', () => {
    const gt = document.querySelector('input[name="gridType"]:checked')?.value || 'tessellated';
    window.$('#tessControls').style.display = (gt === 'tessellated') ? 'block' : 'none';
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.currentCells = null;
      window.generateGrid(true);
    }
  }));

  // Space controls
  window.on(window.$('#includeSpaces'), 'change', () => {
    window.updateSpaceControlsVisibility();
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.currentCells = null;
      window.generateGrid(true);
    }
  });
  window.on(window.$('#customSpaceColor'), 'change', () => {
    window.toggleSpaceControls();
    window.redrawGrid();
  });
  window.on(window.$('#replaceSpaceChar'), 'change', () => {
    window.updateReplaceCharVisibility();
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.redrawGrid();
    }
  });
  window.on(window.$('#replaceCharText'), 'input', () => {
    if (window.$('#autoRows').checked) {
      window.autoPickRowsAndRedraw();
    } else {
      window.redrawGrid();
    }
  });

  // Overlay + thickness + margins + text opacity
  window.on(window.$('#overlayText'), 'change', () => {
    window.updateOverlayUIEnabled();
    window.redrawGrid();
  });
  window.on(window.$('#overlayMarginSlider'), 'input', window.redrawGrid);
  window.on(window.$('#textOpacitySlider'), 'input', window.redrawGrid);
  window.on(window.$('#firstThickness'), 'input', () => {
    if (window.$('#syncOtherToggle').checked) {
      window.syncOtherFromInitial();
    }
    window.redrawGrid();
  });
  window.on(window.$('#otherThickness'), 'input', window.redrawGrid);

  // Sync toggle for Other Characters
  window.on(window.$('#syncOtherToggle'), 'change', () => {
    window.updateOtherControlsState();
    if (window.$('#syncOtherToggle').checked) {
      window.syncOtherFromInitial();
    }
    window.redrawGrid();
  });

  // Color hex bindings
  window.bindHexPair('#bgColorPicker', '#bgColorText', () => {
    window.applyCanvasSizingUI();
    window.redrawGrid();
  });
  window.bindHexPair('#firstLetterColorPicker', '#firstLetterColorText', () => {
    if (window.$('#syncOtherToggle').checked) {
      window.syncOtherFromInitial();
    }
    window.redrawGrid();
  });
  window.bindHexPair('#otherTextColorPicker', '#otherTextColorText', window.redrawGrid);
  window.bindHexPair('#cellBgColorPicker', '#cellBgColorText', window.redrawGrid);
  window.bindHexPair('#spaceColorPicker', '#spaceColorText', window.redrawGrid);

  // Other color sliders
  window.on(window.$('#hueCenter'), 'input', window.redrawGrid);
  window.on(window.$('#hueRadius'), 'input', window.redrawGrid);
  window.on(window.$('#saturationSlider'), 'input', window.redrawGrid);
  window.on(window.$('#contrastSlider'), 'input', window.redrawGrid);
  window.on(window.$('#brightnessSlider'), 'input', window.redrawGrid);
  window.on(window.$('#tileOpacitySlider'), 'input', window.redrawGrid);

  // Corner UI wiring (if available)
  window.$$('input[name="cornerMode"]').forEach(el => window.on(el, 'change', () => {
    const mode = document.querySelector('input[name="cornerMode"]:checked')?.value || 'tile';
    if (typeof window.setCornerMode === 'function') {
      window.setCornerMode(mode);
    }
    window.redrawGrid();
  }));
  window.on(window.$('#chamferSlider'), 'input', () => {
    if (typeof window.updateCornersDynamic === 'function') {
      window.updateCornersDynamic();
    }
    window.redrawGrid();
  });
  window.on(window.$('#bevelSlider'), 'input', () => {
    if (typeof window.updateCornersDynamic === 'function') {
      window.updateCornersDynamic();
    }
    window.redrawGrid();
  });

  // Textarea typing -> auto rows
  window.on(ta, 'input', window.autoPickRowsAndRedraw);
  window.on(ta, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.$('#regen').click();
    }
  });

  // Window events
  window.on(window, 'resize', window.debounce(() => {
    if (window.$('#screenSize').checked) {
      window.applyCanvasSizingUI();
      if (window.$('#autoRows').checked) {
        window.autoPickRowsAndRedraw();
      } else {
        window.currentCells = null;
        window.generateGrid(true);
      }
    }
  }, 100));
  window.on(document, 'fullscreenchange', () => {
    window.$('#fullscreenBtn').title = document.fullscreenElement ? 'Exit Fullscreen' : 'Toggle Fullscreen';
    if (window.$('#screenSize').checked) {
      setTimeout(() => {
        if (window.$('#autoRows').checked) {
          window.autoPickRowsAndRedraw();
        } else {
          window.currentCells = null;
          window.generateGrid(true);
        }
      }, 100);
    }
    if (document.fullscreenElement) {
      showUI();
      scheduleHideUI();
    } else {
      showUI();
      clearTimeout(uiHideTimer);
    }
  });
  window.on(document, 'keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('input,textarea')) {
      e.preventDefault();
      window.$('#regen').click();
    }
    if (e.code === 'Escape') {
      toggleSidebar();
    }
  });

  bindInteractionWake();

  // Initial UI state
  window.$('#tessControls').style.display = 'block';
  window.updateReplaceCharVisibility();
  window.updateOverlayUIEnabled();
  window.updateSpaceControlsVisibility();
  if (window.$('#syncOtherToggle').checked) {
    window.syncOtherFromInitial();
    window.updateOtherControlsState();
  }
  window.applyCanvasSizingUI();

  // First render + set lastAutoRows baseline
  window.lastAutoRows = parseInt(window.$('#rowSlider').value, 10) || 15;
  setupFirstRenderWatchers();
});