// =================== CONTINUOUS PATH BUILDER (STANDARDIZED TOKENS) ===================

// Path builder parameters
let MERGE_EPS = 0.75;
let CONNECT_MAX = 2.0;
let PASS2_SCALE = 1.5;

// Point utilities for path building
const Pnt = {
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
  len: (a) => Math.hypot(a.x, a.y),
  norm: (a) => { const L = Math.hypot(a.x, a.y) || 1; return { x: a.x / L, y: a.y / L }; },
  dot: (a, b) => a.x * b.x + a.y * b.y
};

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPt(A, B, t) { return { x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t) }; }

// Evaluate cubic bezier at parameter t
function evalCubicSeg(s, t) {
  const a = lerpPt(s.p0, s.c1, t);
  const b = lerpPt(s.c1, s.c2, t);
  const c = lerpPt(s.c2, s.p1, t);
  const d = lerpPt(a, b, t);
  const e = lerpPt(b, c, t);
  return lerpPt(d, e, t);
}

function reverseCubic(seg) { 
  return { p0: seg.p1, c1: seg.c2, c2: seg.c1, p1: seg.p0 }; 
}

// Map control points to box coordinates
function mapCtrlToBoxPts(ctrl, x, y, w, h) {
  const xs = ctrl.map(p => p[0]);
  const ys = ctrl.map(p => p[1]);
  const mx = remapVals(xs, 0, 100, x, x + w);
  const my = remapVals(ys, 0, 100, y, y + h);
  return mx.map((vx, i) => ({ x: vx, y: my[i] }));
}

// Convert control points to cubic segments
function segmentsFromCtrlDetailed(ctrlPts) {
  const n = ctrlPts.length;
  if (n < 2) return [];
  const out = [];
  if ((n - 1) % 3 === 0) {
    const segs = (n - 1) / 3;
    for (let s = 0; s < segs; s++) {
      const i = 3 * s;
      out.push({ p0: ctrlPts[i + 0], c1: ctrlPts[i + 1], c2: ctrlPts[i + 2], p1: ctrlPts[i + 3] });
    }
  } else {
    for (let i = 0; i < n - 1; i++) {
      const P0 = ctrlPts[i], P1 = ctrlPts[i + 1];
      const v = Pnt.sub(P1, P0);
      out.push({ p0: P0, c1: { x: P0.x + v.x / 3, y: P0.y + v.y / 3 }, c2: { x: P0.x + 2 * v.x / 3, y: P0.y + 2 * v.y / 3 }, p1: P1 });
    }
  }
  // Calculate segment lengths
  for (const s of out) {
    let L = 0, prev = s.p0;
    for (let k = 1; k <= 8; k++) { 
      const t = k / 8, pt = evalCubicSeg(s, t); 
      L += Math.hypot(pt.x - prev.x, pt.y - prev.y); 
      prev = pt; 
    }
    s.len = L;
  }
  return out;
}

// FIXED: Collect units with proper BBMinFinal, BBMaxFinal calculation
function collectUnitsFromEntries(entries, BBMin, BBMax, groupId = null, out = []) {
  entries.forEach((entry, idx) => {
    if (entry.kind === 'tile') {
      const code9 = entry.code9 || 'O101000000';
      const parsed = parseStandardToken(code9);
      if (parsed.kind === 'tileCode') {
        try {
          // START with original BBMin, BBMax
          let actualBBMin = BBMin;
          let actualBBMax = BBMax;
          
          // If tile has a folder parent, transform the bounding box FIRST
          if (parsed.folderId > 0) {
            const folder = findFolderById(parsed.folderId, getRootTiles());
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
          if (pMin[0] === pMax[0] && pMin[1] === pMax[1]) return;
          
          const minX = Math.min(pMin[0], pMax[0]);
          const minY = Math.min(pMin[1], pMax[1]);
          const maxX = Math.max(pMin[0], pMax[0]);
          const maxY = Math.max(pMin[1], pMax[1]);
          const w = Math.abs(maxX - minX);
          const h = Math.abs(maxY - minY);
          const x = minX;
          const y = minY;
          
          const paths = getPaths(parsed.shape);
          
          for (let subIdx = 0; subIdx < paths.length; subIdx++) {
            const pathArr = paths[subIdx];
            const ctrl = mapCtrlToBoxPts(pathArr, x, y, w, h);
            const segs = segmentsFromCtrlDetailed(ctrl);
            if (!segs.length) continue;
            const start = segs[0].p0, end = segs[segs.length - 1].p1;
            const inTan = Pnt.norm(Pnt.sub(segs[0].c1, segs[0].p0));
            const outTan = Pnt.norm(Pnt.sub(segs[segs.length - 1].p1, segs[segs.length - 1].c2));
            let len = 0; 
            for (const s of segs) len += s.len;
            out.push({ 
              segs, 
              start: { ...start }, 
              end: { ...end }, 
              inTan, 
              outTan, 
              len, 
              groupId, 
              tileRef: { rootIndex: idx, childIndex: -1 } 
            });
          }
        } catch (e) {
          console.warn('Error processing tile:', entry, parsed, e);
        }
      }
    } else if (entry && entry.kind === 'folder') {
      // Process folder children - pass the folder directly
      (entry.children || []).forEach((child, childIdx) => {
        if (child.kind === 'tile') {
          const code9 = child.code9 || 'O101000000';
          const parsed = parseStandardToken(code9);
          if (parsed.kind === 'tileCode') {
            try {
              // START with original BBMin, BBMax
              let actualBBMin = BBMin;
              let actualBBMax = BBMax;
              
              // Since we're processing a child of a folder, apply folder transformation
              const cfg = entry.config || { type: '01', L: 0, R: 0, T: 0, B: 0 };
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
              
              // NOW apply the tile's own transformation using the updated bounds
              const [pMin, pMax] = tileBoxPython(parsed.type, parsed.L, parsed.R, parsed.T, parsed.B, actualBBMin, actualBBMax);
              if (pMin[0] === pMax[0] && pMin[1] === pMax[1]) return;
              
              const minX = Math.min(pMin[0], pMax[0]);
              const minY = Math.min(pMin[1], pMax[1]);
              const maxX = Math.max(pMin[0], pMax[0]);
              const maxY = Math.max(pMin[1], pMax[1]);
              const w = Math.abs(maxX - minX);
              const h = Math.abs(maxY - minY);
              const x = minX;
              const y = minY;
              
              const paths = getPaths(parsed.shape);
              
              for (let subIdx = 0; subIdx < paths.length; subIdx++) {
                const pathArr = paths[subIdx];
                const ctrl = mapCtrlToBoxPts(pathArr, x, y, w, h);
                const segs = segmentsFromCtrlDetailed(ctrl);
                if (!segs.length) continue;
                const start = segs[0].p0, end = segs[segs.length - 1].p1;
                const inTan = Pnt.norm(Pnt.sub(segs[0].c1, segs[0].p0));
                const outTan = Pnt.norm(Pnt.sub(segs[segs.length - 1].p1, segs[segs.length - 1].c2));
                let len = 0; 
                for (const s of segs) len += s.len;
                out.push({ 
                  segs, 
                  start: { ...start }, 
                  end: { ...end }, 
                  inTan, 
                  outTan, 
                  len, 
                  groupId: `folder:${idx}`, 
                  tileRef: { rootIndex: idx, childIndex: childIdx } 
                });
              }
            } catch (e) {
              console.warn('Error processing folder tile:', child, parsed, e);
            }
          }
        }
      });
    }
  });
  return out;
}

function reverseUnit(u) {
  const revSegs = u.segs.slice().reverse().map(reverseCubic);
  const first = revSegs[0], last = revSegs[revSegs.length - 1];
  return { 
    segs: revSegs, 
    start: { ...first.p0 }, 
    end: { ...last.p1 },
    inTan: Pnt.norm(Pnt.sub(first.c1, first.p0)), 
    outTan: Pnt.norm(Pnt.sub(last.p1, last.c2)),
    len: u.len, 
    groupId: u.groupId, 
    tileRef: u.tileRef 
  };
}

// Cluster points within epsilon distance
function clusterPoints(points, eps) {
  const clusters = [];
  const assign = (pt) => {
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      if (Pnt.dist(pt, c) <= eps) {
        c.x = (c.x * c.count + pt.x) / (c.count + 1);
        c.y = (c.y * c.count + pt.y) / (c.count + 1);
        c.count++;
        return i;
      }
    }
    clusters.push({ x: pt.x, y: pt.y, count: 1 });
    return clusters.length - 1;
  };
  const ids = points.map(assign);
  return { clusters, ids };
}

// Cluster unit endpoints
function clusterUnitEndpoints(units, eps) {
  const points = [];
  units.forEach(u => { 
    points.push(u.start); 
    points.push(u.end); 
  });
  const { clusters, ids } = clusterPoints(points, eps);
  for (let i = 0; i < units.length; i++) {
    const ca = clusters[ids[2 * i + 0]], cb = clusters[ids[2 * i + 1]];
    units[i].start = { x: ca.x, y: ca.y };
    units[i].end = { x: cb.x, y: cb.y };
    units[i].segs[0].p0 = { x: ca.x, y: ca.y };
    units[i].segs[units[i].segs.length - 1].p1 = { x: cb.x, y: cb.y };
  }
  return { clusters };
}

// Chain metadata from segments
function chainMetaFromSegs(segs) {
  const len = segs.reduce((s, sg) => s + sg.len, 0);
  const first = segs[0], last = segs[segs.length - 1];
  const start = first.p0, end = last.p1;
  const inTan = Pnt.norm(Pnt.sub(first.c1, first.p0));
  const outTan = Pnt.norm(Pnt.sub(last.p1, last.c2));
  return { len, start, end, inTan, outTan };
}

function reverseSegs(segs) { 
  return segs.slice().reverse().map(reverseCubic); 
}

function chainClosed(segs, eps) { 
  const m = chainMetaFromSegs(segs); 
  return Pnt.dist(m.start, m.end) <= eps; 
}

function makeChainFromUnit(units, idx, orientation) { 
  const base = (orientation === 'F') ? units[idx] : reverseUnit(units[idx]); 
  return { segs: base.segs.slice(), unitOrder: [{ idx, orientation }] }; 
}

function metaOf(chain) { 
  return chainMetaFromSegs(chain.segs); 
}

function reverseChainObj(chain) { 
  return { 
    segs: reverseSegs(chain.segs), 
    unitOrder: chain.unitOrder.slice().reverse().map(u => ({ idx: u.idx, orientation: (u.orientation === 'F' ? 'R' : 'F') })) 
  }; 
}

function concatChains(A, B) { 
  return { 
    segs: A.segs.concat(B.segs), 
    unitOrder: A.unitOrder.concat(B.unitOrder) 
  }; 
}

// Pick best neighbor forward
function pickBestNeighborForward(endPoint, endTan, candidates, used, connectMax, units) {
  let best = null, bestScore = -Infinity;
  for (const idx of candidates) {
    if (used[idx]) continue;
    const uF = units[idx];
    const uR = reverseUnit(uF);

    const dF = Pnt.dist(endPoint, uF.start);
    if (dF <= connectMax) {
      const score = (1 - dF / connectMax) + 0.9 * Pnt.dot(endTan, uF.inTan) + 0.00001 * uF.len;
      if (score > bestScore) { 
        bestScore = score; 
        best = { idx, orientation: 'F', dist: dF }; 
      }
    }
    const dR = Pnt.dist(endPoint, uR.start);
    if (dR <= connectMax) {
      const score = (1 - dR / connectMax) + 0.9 * Pnt.dot(endTan, uR.inTan) + 0.00001 * uR.len;
      if (score > bestScore) { 
        bestScore = score; 
        best = { idx, orientation: 'R', dist: dR }; 
      }
    }
  }
  return best;
}

// Pick best neighbor backward
function pickBestNeighborBackward(startPoint, startInTan, candidates, used, connectMax, units) {
  let best = null, bestScore = -Infinity;
  for (const idx of candidates) {
    if (used[idx]) continue;
    const uF = units[idx];
    const uR = reverseUnit(uF);

    const dF = Pnt.dist(startPoint, uF.end);
    if (dF <= connectMax) {
      const score = (1 - dF / connectMax) + 0.9 * Pnt.dot(startInTan, uF.outTan) + 0.00001 * uF.len;
      if (score > bestScore) { 
        bestScore = score; 
        best = { idx, orientation: 'F', dist: dF, prepend: true }; 
      }
    }
    const dR = Pnt.dist(startPoint, uR.end);
    if (dR <= connectMax) {
      const score = (1 - dR / connectMax) + 0.9 * Pnt.dot(startInTan, uR.outTan) + 0.00001 * uR.len;
      if (score > bestScore) { 
        bestScore = score; 
        best = { idx, orientation: 'R', dist: dR, prepend: true }; 
      }
    }
  }
  return best;
}

// Chain units together
function chainUnits(units) {
  const used = new Array(units.length).fill(false);
  const order = units.map((_, i) => i).sort((a, b) => units[b].len - units[a].len);
  const allChains = [];

  for (const seedIdx of order) {
    if (used[seedIdx]) continue;
    let chain = makeChainFromUnit(units, seedIdx, 'F');
    used[seedIdx] = true;

    // Extend forward
    let endMeta = metaOf(chain);
    while (true) {
      const candIdxs = order.filter(i => !used[i]);
      const best = pickBestNeighborForward(endMeta.end, endMeta.outTan, candIdxs, used, CONNECT_MAX, units);
      if (!best) break;
      const uo = (best.orientation === 'F') ? units[best.idx] : reverseUnit(units[best.idx]);
      chain.segs = chain.segs.concat(uo.segs);
      chain.unitOrder.push({ idx: best.idx, orientation: best.orientation });
      used[best.idx] = true;
      endMeta = metaOf(chain);
    }

    // Extend backward
    let startMeta = metaOf(chain);
    while (true) {
      const candIdxs = order.filter(i => !used[i]);
      const best = pickBestNeighborBackward(startMeta.start, startMeta.inTan, candIdxs, used, CONNECT_MAX, units);
      if (!best) break;
      const uo = (best.orientation === 'F') ? units[best.idx] : reverseUnit(units[best.idx]);
      chain.segs = uo.segs.concat(chain.segs);
      chain.unitOrder = [{ idx: best.idx, orientation: best.orientation }].concat(chain.unitOrder);
      used[best.idx] = true;
      startMeta = metaOf(chain);
    }

    allChains.push(chain);
  }
  return allChains;
}

// Cluster chain endpoints
function clusterChainsEndpoints(chains, eps) {
  const pts = []; 
  const roles = [];
  chains.forEach((ch, idx) => {
    const m = metaOf(ch);
    pts.push(m.start); 
    roles.push({ idx, role: 'start' });
    pts.push(m.end);   
    roles.push({ idx, role: 'end' });
  });
  const { clusters, ids } = clusterPoints(pts, eps);
  const buckets = new Map();
  ids.forEach((cid, i) => {
    const entry = roles[i];
    if (!buckets.has(cid)) buckets.set(cid, []);
    buckets.get(cid).push(entry);
  });
  return { clusters, buckets };
}

function orientChainForEnd(ch, endRole) { 
  return (endRole === 'end') ? ch : reverseChainObj(ch); 
}

function orientChainForStart(ch, startRole) { 
  return (startRole === 'start') ? ch : reverseChainObj(ch); 
}

function scorePair(A, aRole, B, bRole) {
  const Ao = orientChainForEnd(A, aRole);
  const Bo = orientChainForStart(B, bRole);
  const mA = metaOf(Ao), mB = metaOf(Bo);
  const score = 0.9 * Pnt.dot(mA.outTan, mB.inTan) + 0.000001 * mB.len;
  return { score, Ao, Bo };
}

// Merge strict junctions
function mergeStrictJunctions(chains, eps) {
  let changed = false;
  while (true) {
    const { buckets } = clusterChainsEndpoints(chains, eps);
    let best = null;
    for (const [cid, list] of buckets.entries()) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const a = list[i], b = list[j];
          if (a.idx === b.idx) continue;
          const { score, Ao, Bo } = scorePair(chains[a.idx], a.role, chains[b.idx], b.role);
          if (!best || score > best.score) {
            best = { score, i: a.idx, j: b.idx, A: Ao, B: Bo };
          }
        }
      }
    }
    if (!best) break;
    const next = [];
    for (let k = 0; k < chains.length; k++) {
      if (k === best.i || k === best.j) continue;
      next.push(chains[k]);
    }
    next.push(concatChains(best.A, best.B));
    chains = next;
    changed = true;
  }
  return { chains, changed };
}

// Try best pair join
function tryBestPairJoinChains(A, B, passMax) {
  const A_r = reverseChainObj(A);
  const B_r = reverseChainObj(B);
  const options = [
    { a: A, b: B, mA: metaOf(A), mB: metaOf(B) },
    { a: A, b: B_r, mA: metaOf(A), mB: metaOf(B_r) },
    { a: A_r, b: B, mA: metaOf(A_r), mB: metaOf(B) },
    { a: A_r, b: B_r, mA: metaOf(A_r), mB: metaOf(B_r) },
  ].map(o => ({ ...o, d: Pnt.dist(o.mA.end, o.mB.start), dot: Pnt.dot(o.mA.outTan, o.mB.inTan) }));

  let best = null, bestScore = -Infinity;
  for (const opt of options) {
    if (opt.d > passMax) continue;
    const score = (1 - opt.d / passMax) + 0.9 * opt.dot + 0.000001 * oPtLen(opt.b);
    if (score > bestScore) { 
      bestScore = score; 
      best = opt; 
    }
  }
  if (!best) return null;
  return { merged: concatChains(best.a, best.b), d: best.d };
}

function oPtLen(chain) { 
  return chain.segs.reduce((s, sg) => s + sg.len, 0); 
}

// Merge one pass
function mergeOnePass(chains, passMax) {
  if (chains.length <= 1) return { chains, changed: false };
  let bestPair = null;
  for (let i = 0; i < chains.length; i++) {
    for (let j = 0; j < chains.length; j++) {
      if (i === j) continue;
      const attempt = tryBestPairJoinChains(chains[i], chains[j], passMax);
      if (!attempt) continue;
      if (!bestPair || attempt.d < bestPair.d) {
        bestPair = { i, j, merged: attempt.merged, d: attempt.d };
      }
    }
  }
  if (!bestPair) return { chains, changed: false };
  const next = [];
  for (let k = 0; k < chains.length; k++) {
    if (k === bestPair.i || k === bestPair.j) continue;
    next.push(chains[k]);
  }
  next.push(bestPair.merged);
  return { chains: next, changed: true };
}

// Merge until no change
function mergeUntilNoChangeDistance(chains, passMax) {
  let changed = false, step = true;
  while (step) {
    const res = mergeOnePass(chains, passMax);
    chains = res.chains; 
    step = res.changed; 
    changed = changed || step;
  }
  return { chains, changed };
}

// Exhaustive stitch
function exhaustiveStitch(initialChains) {
  let chains = initialChains.slice();
  let loopChanged = true;
  while (loopChanged) {
    loopChanged = false;
    let r1 = mergeStrictJunctions(chains, MERGE_EPS);
    chains = r1.chains; 
    loopChanged = loopChanged || r1.changed;

    let r2 = mergeUntilNoChangeDistance(chains, CONNECT_MAX);
    chains = r2.chains; 
    loopChanged = loopChanged || r2.changed;

    let r3 = mergeUntilNoChangeDistance(chains, CONNECT_MAX * PASS2_SCALE);
    chains = r3.chains; 
    loopChanged = loopChanged || r3.changed;
  }
  return chains;
}

// Convert chain segments to SVG path data
function dForSegChain(chainSegs, closeIt = false) {
  if (!chainSegs.length) return '';
  function round2(v) { return Math.round(v * 100) / 100; }
  const first = chainSegs[0];
  let d = `M ${round2(first.p0.x)} ${round2(first.p0.y)} C ${round2(first.c1.x)} ${round2(first.c1.y)}, ${round2(first.c2.x)} ${round2(first.c2.y)}, ${round2(first.p1.x)} ${round2(first.p1.y)}`;
  for (let i = 1; i < chainSegs.length; i++) {
    const s = chainSegs[i];
    d += ` C ${round2(s.c1.x)} ${round2(s.c1.y)}, ${round2(s.c2.x)} ${round2(s.c2.y)}, ${round2(s.p1.x)} ${round2(s.p1.y)}`;
  }
  if (closeIt) d += ' Z';
  return d;
}

// FIXED: Build merged path data with proper BBMinFinal, BBMaxFinal calculation
function buildMergedPathData() {
  const baseW = 300, baseH = 300;
  const ghostW = baseW * viewerScaleW;
  const ghostH = baseH * viewerScaleH;
  const ghostX = (500 - ghostW) / 2;
  const ghostY = (500 - ghostH) / 2;
  const BBMin = { x: ghostX, y: ghostY, z: 0 };
  const BBMax = { x: ghostX + ghostW, y: ghostY + ghostH, z: 0 };
  
  const units = collectUnitsFromEntries(getRootTiles(), BBMin, BBMax);
  if (!units.length) return { d: '', count: 0, segments: 0 };
  
  clusterUnitEndpoints(units, MERGE_EPS);
  const seedChains = chainUnits(units);
  const finalChains = exhaustiveStitch(seedChains);
  
  const chunks = finalChains.map(ch => dForSegChain(ch.segs, chainClosed(ch.segs, MERGE_EPS))).filter(Boolean);
  const totalSegments = units.reduce((s, u) => s + u.segs.length, 0);
  return { d: chunks.join(' '), count: finalChains.length, segments: totalSegments };
}

// Copy merged path SVG to clipboard
function copyMergedPathSVGToClipboard() {
  const res = buildMergedPathData();
  if (!res.d) { showToastError(); return; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <path d="${res.d}" fill="none" stroke="#000" stroke-width="${strokeWeight || 2}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(svg).then(() => showToast('Continuous path copied'), showToastError);
  } else {
    try {
      const ta = document.createElement('textarea'); 
      ta.value = svg; 
      document.body.appendChild(ta);
      ta.select(); 
      document.execCommand('copy'); 
      document.body.removeChild(ta);
      showToast('Continuous path copied');
    } catch (e) { 
      showToastError(); 
    }
  }
}

// Expose tuning helpers
window.setMergeTolerance = function(px) { MERGE_EPS = Math.max(0, +px || 0.75); };
window.setConnectMax = function(px) { CONNECT_MAX = Math.max(MERGE_EPS, +px || 2.0); };
window.setSecondPassScale = function(s) { PASS2_SCALE = Math.max(1, +s || 1.5); };
window.copyMergedPathSVG = copyMergedPathSVGToClipboard;