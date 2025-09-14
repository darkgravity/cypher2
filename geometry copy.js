// =================== VECTOR UTILITIES & GEOMETRY (STANDARDIZED TOKENS) ===================
const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (v, s) => ({ x: v.x * s, y: v.y * s }),
  len: (v) => Math.hypot(v.x, v.y),
  norm: (v) => { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; },
  dot: (a, b) => a.x * b.x + a.y * b.y,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
};

// Rotate control points by 90 degree increments
function rotateQuarter(ctrlPts, k, cx = 50, cy = 50) {
  k = ((k % 4) + 4) % 4;
  const out = [];
  for (const [x, y] of ctrlPts) {
    const dx = x - cx, dy = y - cy;
    let nx, ny;
    if (k === 0) { nx = dx; ny = dy; }
    else if (k === 1) { nx = -dy; ny = dx; }
    else if (k === 2) { nx = -dx; ny = -dy; }
    else { nx = dy; ny = -dx; }
    out.push([cx + nx, cy + ny]);
  }
  return out;
}

// Generate beveled corner A1
function genA1Beveled(chamferPx, bevel01) {
  const p0 = { x: 0, y: 100 };
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 100, y: 0 };

  const d = V.clamp(chamferPx, 0, 100);
  const A = { x: 0, y: d };
  const B = { x: d, y: 0 };

  const u_p0A = V.norm(V.sub(A, p0));
  const u_AB = V.norm(V.sub(B, A));
  const u_Bp2 = V.norm(V.sub(p2, B));

  const thetaA = Math.acos(V.clamp(V.dot({ x: -u_p0A.x, y: -u_p0A.y }, u_AB), -1, 1));
  const thetaB = Math.acos(V.clamp(V.dot({ x: -u_AB.x, y: -u_AB.y }, u_Bp2), -1, 1));

  const lenA_in = V.len(V.sub(A, p0));
  const lenA_out = V.len(V.sub(B, A));
  const lenB_in = V.len(V.sub(B, A));
  const lenB_out = V.len(V.sub(p2, B));

  const tanA = Math.tan(thetaA / 2);
  const tanB = Math.tan(thetaB / 2);

  const rMaxA = Math.min(lenA_in, lenA_out) / (tanA || 1e9);
  const rMaxB = Math.min(lenB_in, lenB_out) / (tanB || 1e9);
  const lenAB = V.len(V.sub(B, A));
  const rMaxAB = lenAB / ((tanA + tanB) || 1e9);
  const rMax = Math.max(0, Math.min(rMaxA, rMaxB, rMaxAB));
  const r = V.clamp(bevel01, 0, 1) * rMax;

  const tA = r * tanA;
  const tB = r * tanB;

  const EA0 = V.add(A, V.mul(u_p0A, -tA));
  const EA1 = V.add(A, V.mul(u_AB, +tA));
  const EB0 = V.add(B, V.mul(u_AB, -tB));
  const EB1 = V.add(B, V.mul(u_Bp2, +tB));

  const hA = K * V.len(V.sub(EA1, EA0));
  const hB = K * V.len(V.sub(EB1, EB0));

  const C0A = V.add(EA0, V.mul(u_p0A, hA));
  const C1A = V.add(EA1, V.mul(u_AB, -hA));
  const C0B = V.add(EB0, V.mul(u_AB, hB));
  const C1B = V.add(EB1, V.mul(u_Bp2, -hB));

  const seg1 = lineAsCubic(p0, EA0);
  const seg2 = { p0: EA0, c1: C0A, c2: C1A, p1: EA1 };
  const seg3 = lineAsCubic(EA1, EB0);
  const seg4 = { p0: EB0, c1: C0B, c2: C1B, p1: EB1 };
  const seg5 = lineAsCubic(EB1, p2);

  return chainToCtrlPts([seg1, seg2, seg3, seg4, seg5]);
}

const removeFirst3 = arr => arr.slice(3);
const removeLast3 = arr => arr.slice(0, Math.max(0, arr.length - 3));

// Convert line to cubic bezier
function lineAsCubic(P, Q) {
  const v = V.sub(Q, P);
  const c1 = V.add(P, V.mul(v, 1 / 3));
  const c2 = V.add(P, V.mul(v, 2 / 3));
  return { p0: P, c1, c2, p1: Q };
}

// Convert chain of cubic segments to control points
function chainToCtrlPts(cubics) {
  if (!cubics.length) return [];
  const out = [];
  out.push([cubics[0].p0.x, cubics[0].p0.y],
    [cubics[0].c1.x, cubics[0].c1.y],
    [cubics[0].c2.x, cubics[0].c2.y],
    [cubics[0].p1.x, cubics[0].p1.y]);
  for (let i = 1; i < cubics.length; i++) {
    const s = cubics[i];
    out.push([s.c1.x, s.c1.y], [s.c2.x, s.c2.y], [s.p1.x, s.p1.y]);
  }
  return out;
}

// Convert data to paths
function toPaths(value) {
  if (!value) return [];
  if (Array.isArray(value) && Array.isArray(value[0]) && typeof value[0][0] === 'number') {
    return [value.map(([x, y]) => [+x, +y])];
  }
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return value.map(p => p.map(([x, y]) => [+x, +y]));
  }
  throw new Error("Unsupported path data type");
}

function getPaths(key) {
  if (!raw_data[key]) throw new Error("Unknown control array: " + key);
  return toPaths(raw_data[key]);
}

// Remap values from one range to another
function remapVals(vals, omin, omax, nmin, nmax) {
  const span = omax - omin;
  if (span === 0) return vals.map(() => nmin + (nmax - nmin) * 0.5);
  return vals.map(v => nmin + (v - omin) * (nmax - nmin) / span);
}

// Convert control points to cubic segments for SVG
function cubicSegments(controlPts) {
  const n = controlPts.length;
  if (n < 4) return [];
  const segs = (n - 1) / 3;
  if (Math.abs(segs - Math.round(segs)) > 1e-9) {
    return [{ d: controlPts.reduce((acc, [x, y], i) => acc + (i ? ` L ${x} ${y}` : `M ${x} ${y}`), "") }];
  }
  const out = [];
  for (let s = 0; s < segs; s++) {
    const i = 3 * s;
    const p0 = controlPts[i], p1 = controlPts[i + 1], p2 = controlPts[i + 2], p3 = controlPts[i + 3];
    out.push({ d: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}` });
  }
  return out;
}

function toLLUR(minX, minY, maxX, maxY) {
  const left = Math.min(minX, maxX), right = Math.max(minX, maxX);
  const top = Math.min(minY, maxY), bottom = Math.max(minY, maxY);
  return [[left, bottom], [right, top]];
}

// Calculate tile bounding box based on type and offsets
function tileBoxPython(tileType, d1, d2, d3, d4, BBMin, BBMax) {
  const origWidth = BBMax.x - BBMin.x, origHeight = BBMax.y - BBMin.y;
  const tileWidth = Math.min(origWidth, origHeight, origHeight * 2);
  const tileD1 = d1 ? (tileWidth / d1) : 0, tileD2 = d2 ? (tileWidth / d2) : 0;
  const midX = BBMin.x + origWidth * 0.5, midY = BBMin.y + origHeight * 0.5, tileHeight = origHeight;
  switch (tileType) {
    case '01': {return toLLUR(BBMin.x, BBMin.y, BBMax.x, BBMax.y);}
    case '02': return toLLUR(BBMin.x, BBMin.y, BBMin.x + tileD1, BBMin.y + tileD1);
    case '03': return toLLUR(BBMax.x - tileD1, BBMin.y, BBMax.x, BBMin.y + tileD1);
    case '04': return toLLUR(BBMax.x - tileD1, BBMax.y - tileD1, BBMax.x, BBMax.y);
    case '05': return toLLUR(BBMin.x, BBMax.y - tileD1, BBMin.x + tileD1, BBMax.y);
    case '06': return toLLUR(BBMin.x, BBMin.y + tileD1, BBMin.x, BBMax.y - tileD2);
    case '07': return toLLUR(BBMin.x, BBMin.y + tileD1, BBMin.x, BBMin.y + (tileHeight * 0.5) - tileD2);
    case '08': return toLLUR(BBMin.x, BBMin.y + (tileHeight * 0.5) + tileD1, BBMin.x, BBMin.y + tileHeight - tileD2);
    case '09': return toLLUR(midX, BBMax.y - tileD2, midX, BBMin.y + tileD1);
    case '10': return toLLUR(midX, BBMin.y + tileD1, midX, BBMin.y + (tileHeight * 0.5) - tileD2);
    case '11': return toLLUR(midX, BBMin.y + (tileHeight * 0.5) + tileD1, midX, BBMin.y + tileHeight - tileD2);
    case '12': return toLLUR(BBMax.x, BBMax.y - tileD2, BBMax.x, BBMin.y + tileD1);
    case '13': return toLLUR(BBMax.x, BBMin.y + tileD1, BBMax.x, BBMin.y + (tileHeight * 0.5) - tileD2);
    case '14': return toLLUR(BBMax.x, BBMin.y + (tileHeight * 0.5) + tileD1, BBMax.x, BBMax.y - tileD2);
    case '15': return toLLUR(BBMin.x + tileD1, BBMin.y, BBMax.x - tileD2, BBMin.y);
    case '16': return toLLUR(BBMin.x + tileD1, BBMin.y, midX - tileD2, BBMin.y);
    case '17': return toLLUR(midX + tileD1, BBMin.y, BBMax.x - tileD2, BBMin.y);
    case '18': return toLLUR(BBMin.x + tileD1, midY, BBMax.x - tileD2, midY);
    case '19': return toLLUR(BBMin.x + tileD1, midY, midX - tileD2, midY);
    case '20': return toLLUR(midX + tileD1, midY, BBMax.x - tileD2, midY);
    case '21': return toLLUR(BBMin.x + tileD1, BBMax.y, BBMax.x - tileD2, BBMax.y);
    case '22': return toLLUR(BBMin.x + tileD1, BBMax.y, midX - tileD2, BBMax.y);
    case '23': return toLLUR(midX + tileD1, BBMax.y, BBMax.x - tileD2, BBMax.y);
    case '24': return toLLUR(midX - tileD1, BBMin.y, midX, BBMin.y + tileD1);
    case '25': return toLLUR(midX, BBMin.y, midX + tileD1, BBMin.y + tileD1);
    case '26': return toLLUR(BBMax.x - tileD1, midY - tileD1, BBMax.x, midY);
    case '27': return toLLUR(BBMax.x - tileD1, midY, BBMax.x, midY + tileD1);
    case '28': return toLLUR(midX, BBMax.y - tileD1, midX + tileD1, BBMax.y);
    case '29': return toLLUR(midX - tileD1, BBMax.y - tileD1, midX, BBMax.y);
    case '30': return toLLUR(BBMin.x, midY, BBMin.x + tileD1, midY + tileD1);
    case '31': return toLLUR(BBMin.x, midY - tileD1, BBMin.x + tileD1, midY);
    case '32': return toLLUR(midX - (tileD1 * 0.5), BBMin.y, midX + (tileD1 * 0.5), BBMin.y + tileD1);
    case '33': return toLLUR(midX - (tileD1 * 0.5), BBMin.y, midX + (tileD1 * 0.5), BBMin.y + tileD1);
    case '34': return toLLUR(midX - (tileD1 * 0.5), BBMax.y, midX + (tileD1 * 0.5), BBMax.y - tileD1);
    case '35': return toLLUR(midX - (tileD1 * 0.5), BBMax.y, midX + (tileD1 * 0.5), BBMax.y - tileD1);
    case '36': return toLLUR(BBMin.x, BBMin.y + tileD1, BBMax.x, BBMax.y - tileD2);
    case '37': return toLLUR(BBMin.x, BBMin.y + tileD1, BBMax.x, BBMin.y + (tileHeight * 0.5) - tileD2);
    case '38': return toLLUR(BBMin.x, BBMin.y + (tileHeight * 0.5) + tileD1, BBMax.x, BBMin.y + tileHeight - tileD2);
    case '39': return toLLUR(BBMin.x + tileD1, BBMin.y, BBMax.x - tileD2, BBMax.y);
    case '40': return toLLUR(BBMin.x + tileD1, BBMin.y, midX - tileD2, BBMax.y);
    case '41': return toLLUR(midX + tileD1, BBMin.y, BBMax.x - tileD2, BBMax.y);
    case '42': return toLLUR(BBMin.x + tileD1, BBMin.y + tileD1, BBMax.x - tileD2, BBMax.y - tileD2);
    default: return toLLUR(BBMin.x, BBMin.y, BBMax.x, BBMax.y);
  }
}

// Draw bezier tile paths to SVG
function drawBezierTilePaths(svg, pMin, pMax, arrayKey, strokeWidth = 2, stroke = "#e6eef4") {
  const minX = pMin[0], minY = pMin[1], maxX = pMax[0], maxY = pMax[1];
  const w = Math.abs(maxX - minX), h = Math.abs(maxY - minY);
  const x = Math.min(minX, maxX), y = Math.min(minY, maxY);
  try {
    const paths = getPaths(arrayKey);
    for (const pathArr of paths) {
      const xs = pathArr.map(p => p[0]), ys = pathArr.map(p => p[1]);
      const mx = remapVals(xs, 0, 100, x, x + w), my = remapVals(ys, 0, 100, y, y + h);
      const ctrl = mx.map((vx, i) => [vx, my[i]]);
      const segs = cubicSegments(ctrl);
      for (const { d } of segs) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
        el.setAttribute("d", d);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", stroke);
        el.setAttribute("stroke-width", String(strokeWidth));
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");
        svg.appendChild(el);
      }
    }
  } catch (e) { console.warn('Error drawing tile:', arrayKey, e); }
}

// FIXED: Calculate final bounding box for tile with folder transformation
function calculateItemFinalBBox(item, BBMin, BBMax) {
  if (item.kind === 'tile') {
    const code9 = item.code9 || 'O101000000';
    const parsed = parseStandardToken(code9);
    if (parsed.kind !== 'tileCode') {
      return { min: BBMin, max: BBMax };
    }

    // If no folder parent, use original bounding box
    if (parsed.folderId === 0) {
      return { min: BBMin, max: BBMax };
    }

    // Find the folder by ID
    const folder = findFolderById(parsed.folderId, getRootTiles());
    if (!folder || folder.kind !== 'folder') {
      return { min: BBMin, max: BBMax };
    }

    // Get folder configuration
    const folderConfig = folder.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };

    // FIXED: Apply folder transformation to get the NEW coordinate space for children
    const [pMin, pMax] = tileBoxPython(
      folderConfig.type || '01',
      folderConfig.L || 0,
      folderConfig.R || 0,
      folderConfig.T || 0,
      folderConfig.B || 0,
      BBMin,
      BBMax
    );

    // This becomes the NEW BBMin, BBMax for the child tile
    return {
      min: { x: Math.min(pMin[0], pMax[0]), y: Math.min(pMin[1], pMax[1]), z: 0 },
      max: { x: Math.max(pMin[0], pMax[0]), y: Math.max(pMin[1], pMax[1]), z: 0 }
    };
  }
  return { min: BBMin, max: BBMax };
}

// FIXED: Draw item (tile or folder) in bounding box with proper folder coordinate space
function drawItemInBox(svg, item, BBMin, BBMax, strokeCol, strokeW) {
  if (item.kind === 'tile') {
    // FIXED: Get the folder's coordinate space as BBMinFinal, BBMaxFinal
    const bboxResult = calculateItemFinalBBox(item, BBMin, BBMax);
    const BBMinFinal = bboxResult.min;
    const BBMaxFinal = bboxResult.max;
    
    const code9 = item.code9 || 'O101000000';
    const parsed = parseStandardToken(code9);
    if (parsed.kind === 'tileCode') {
      // FIXED: Now use BBMinFinal, BBMaxFinal as the coordinate space for the tile
      const [pMin, pMax] = tileBoxPython(parsed.type, parsed.L, parsed.R, parsed.T, parsed.B, BBMinFinal, BBMaxFinal);
      if (pMin[0] !== pMax[0] || pMin[1] !== pMax[1]) {
        const minX = Math.min(pMin[0], pMax[0]);
        const minY = Math.min(pMin[1], pMax[1]);
        const maxX = Math.max(pMin[0], pMax[0]);
        const maxY = Math.max(pMin[1], pMax[1]);
        const w = Math.abs(maxX - minX);
        const h = Math.abs(maxY - minY);
        const x = minX;
        const y = minY;
        
        drawBezierTilePaths(svg, [x, y], [x + w, y + h], parsed.shape, strokeW, strokeCol);
      }
    }
  } else if (item.kind === 'folder') {
    // Draw folder children - they will each calculate their own correct bounding box
    (item.children || []).forEach(child => {
      if (child.kind === 'tile') {
        drawItemInBox(svg, child, BBMin, BBMax, strokeCol, strokeW);
      }
    });
  }
}

// Draw ghost frame and cross guides
function drawGhostFrameAndCross(svg, x, y, w, h, stroke = '#2a3441') {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute('data-ghost', '1');
  svg.appendChild(g);
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute('x', x); rect.setAttribute('y', y);
  rect.setAttribute('width', w); rect.setAttribute('height', h);
  rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-dasharray', '6 6'); rect.setAttribute('stroke-width', '1.25');
  g.appendChild(rect);
  const cx = x + w / 2, cy = y + h / 2;
  const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hLine.setAttribute('x1', x); hLine.setAttribute('y1', cy);
  hLine.setAttribute('x2', x + w); hLine.setAttribute('y2', cy);
  hLine.setAttribute('stroke', stroke); hLine.setAttribute('stroke-dasharray', '6 6'); hLine.setAttribute('stroke-width', '1.25');
  const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  vLine.setAttribute('x1', x + w / 2); vLine.setAttribute('y1', y);
  vLine.setAttribute('x2', x + w / 2); vLine.setAttribute('y2', y + h);
  vLine.setAttribute('stroke', stroke); vLine.setAttribute('stroke-dasharray', '6 6'); vLine.setAttribute('stroke-width', '1.25');
  g.appendChild(hLine); g.appendChild(vLine);
}

// Draw ghost frame icon for grid buttons
function drawGhostFrameIcon(svg) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute('x', 10); rect.setAttribute('y', 10); rect.setAttribute('width', 80); rect.setAttribute('height', 80);
  rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', '#1f2733'); rect.setAttribute('stroke-dasharray', '6 6'); rect.setAttribute('stroke-width', '1.25');
  svg.appendChild(rect);
}