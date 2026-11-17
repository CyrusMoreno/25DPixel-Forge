import {
  ALL_TILE_DEFINITIONS,
  AtlasFrameSpec,
  GeneratedAtlas,
  PaletteTheme,
  TileKind,
  TilemapConfig,
} from '../types/studio';
import {
  IndexedPixelBuffer,
  RGBColor,
  ShadeIndex,
  createCanvasFromRgba,
  hexToRgb,
} from './pixelBuffer';

function bayer2x2(x: number, y: number): number {
  const bx = ((x % 2) + 2) % 2;
  const by = ((y % 2) + 2) % 2;
  const matrix = [
    [0, 2],
    [3, 1],
  ];
  return matrix[by][bx];
}

function hash2d(x: number, y: number, seed = 17): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

interface DiamondMetrics {
  lw: number;
  lh: number;
  lCellH: number;
  baseTopY: number;
  mask: Uint8Array;
  topY: Int32Array;
  botY: Int32Array;
}

function computeDiamondMetrics(
  lw: number,
  lh: number,
  lCellH: number,
): DiamondMetrics {
  const baseTopY = Math.max(0, lCellH - lh);
  const mask = new Uint8Array(lw * lCellH);
  const topY = new Int32Array(lw).fill(-1);
  const botY = new Int32Array(lw).fill(-1);

  const cx = lw / 2;
  const cy = baseTopY + lh / 2;
  const rx = lw / 2;
  const ry = lh / 2;

  for (let y = baseTopY; y < lCellH; y++) {
    for (let x = 0; x < lw; x++) {
      const dx = Math.abs(x + 0.5 - cx) / rx;
      const dy = Math.abs(y + 0.5 - cy) / ry;
      if (dx + dy <= 1.0001) {
        mask[y * lw + x] = 1;
        if (topY[x] === -1 || y < topY[x]) topY[x] = y;
        if (botY[x] === -1 || y > botY[x]) botY[x] = y;
      }
    }
  }

  return { lw, lh, lCellH, baseTopY, mask, topY, botY };
}

function isDiamondEdge(
  x: number,
  y: number,
  m: DiamondMetrics,
): boolean {
  if (y < m.baseTopY || y >= m.lCellH || x < 0 || x >= m.lw) return false;
  if (m.mask[y * m.lw + x] === 0) return false;
  const left = x > 0 ? m.mask[y * m.lw + (x - 1)] : 0;
  const right = x < m.lw - 1 ? m.mask[y * m.lw + (x + 1)] : 0;
  const up = y > 0 ? m.mask[(y - 1) * m.lw + x] : 0;
  const down = y < m.lCellH - 1 ? m.mask[(y + 1) * m.lw + x] : 0;
  return left === 0 || right === 0 || up === 0 || down === 0;
}

function drawExtrudedBlock(
  buf: IndexedPixelBuffer,
  m: DiamondMetrics,
  elevation: number,
  showOutlines: boolean,
  dither: boolean,
  inset = 0,
): void {
  const { lw, lCellH, baseTopY, mask, topY, botY } = m;
  const elev = Math.max(1, Math.min(elevation, baseTopY));

  // Scale inner diamond if inset > 0 (for pillars / crates)
  const cx = lw / 2;
  const cy = baseTopY + m.lh / 2;
  const rx = Math.max(2, lw / 2 - inset);
  const ry = Math.max(2, m.lh / 2 - inset * (m.lh / lw));

  const subMask = new Uint8Array(lw * lCellH);
  const subTop = new Int32Array(lw).fill(-1);
  const subBot = new Int32Array(lw).fill(-1);

  if (inset === 0) {
    subMask.set(mask);
    subTop.set(topY);
    subBot.set(botY);
  } else {
    for (let y = baseTopY; y < lCellH; y++) {
      for (let x = 0; x < lw; x++) {
        const dx = Math.abs(x + 0.5 - cx) / rx;
        const dy = Math.abs(y + 0.5 - cy) / ry;
        if (dx + dy <= 1.0001) {
          subMask[y * lw + x] = 1;
          if (subTop[x] === -1 || y < subTop[x]) subTop[x] = y;
          if (subBot[x] === -1 || y > subBot[x]) subBot[x] = y;
        }
      }
    }
  }

  // Draw extruded side walls
  for (let x = 0; x < lw; x++) {
    if (subBot[x] === -1) continue;
    const isLeftFace = x + 0.5 < cx;
    const yEnd = subBot[x];
    const yStart = Math.max(0, yEnd - elev);

    for (let y = yStart; y <= yEnd; y++) {
      let shade: ShadeIndex = isLeftFace ? 1 : 2;
      if (dither) {
        const b = bayer2x2(x, y);
        if (isLeftFace && (y === yEnd || (b === 0 && (x + y) % 3 === 0))) {
          shade = 2;
        } else if (!isLeftFace && b === 3 && (y - yStart) > elev * 0.5) {
          shade = 3;
        }
      }
      buf.setPixel(x, y, shade);
    }
  }

  // Draw top diamond shifted up by elev
  for (let y = baseTopY; y < lCellH; y++) {
    for (let x = 0; x < lw; x++) {
      if (subMask[y * lw + x] === 1) {
        let shade: ShadeIndex = 0;
        if (dither && bayer2x2(x, y) === 3 && hash2d(x, y, 7) > 0.72) {
          shade = 1;
        }
        buf.setPixel(x, y - elev, shade);
      }
    }
  }

  if (showOutlines) {
    // Top face rim
    for (let y = baseTopY; y < lCellH; y++) {
      for (let x = 0; x < lw; x++) {
        if (subMask[y * lw + x] === 0) continue;
        const left = x > 0 ? subMask[y * lw + (x - 1)] : 0;
        const right = x < lw - 1 ? subMask[y * lw + (x + 1)] : 0;
        const up = y > 0 ? subMask[(y - 1) * lw + x] : 0;
        const down = y < lCellH - 1 ? subMask[(y + 1) * lw + x] : 0;
        if (left === 0 || right === 0 || up === 0 || down === 0) {
          buf.setPixel(x, y - elev, 3);
        }
      }
    }
    // Bottom rim & side silhouettes
    for (let x = 0; x < lw; x++) {
      if (subBot[x] === -1) continue;
      buf.setPixel(x, subBot[x], 3);
      if (x === 0 || subBot[x - 1] === -1 || x === lw - 1 || subBot[x + 1] === -1) {
        for (let y = subBot[x] - elev; y <= subBot[x]; y++) {
          buf.setPixel(x, y, 3);
        }
      }
    }
    // Center vertical corner seam
    const midX = Math.floor(cx);
    if (subBot[midX] !== -1) {
      for (let y = subBot[midX] - elev; y <= subBot[midX]; y++) {
        buf.setPixel(midX, y, 3);
      }
    }
  }
}

function drawRampTile(
  buf: IndexedPixelBuffer,
  m: DiamondMetrics,
  dir: 'N' | 'E' | 'S' | 'W',
  elevation: number,
  showOutlines: boolean,
  dither: boolean,
): void {
  const { lw, lh, lCellH, baseTopY, mask } = m;
  const cx = lw / 2;
  const cy = baseTopY + lh / 2;
  const elev = Math.max(2, Math.min(elevation, baseTopY));

  const heightMap = new Int32Array(lw * lCellH).fill(-1);

  for (let y = baseTopY; y < lCellH; y++) {
    for (let x = 0; x < lw; x++) {
      if (mask[y * lw + x] === 0) continue;
      const nx = (x + 0.5 - cx) / (lw / 2);
      const ny = (y + 0.5 - cy) / (lh / 2);
      const u = (nx + ny) * 0.5 + 0.5; // 0 (NW) -> 1 (SE)
      const v = (ny - nx) * 0.5 + 0.5; // 0 (NE) -> 1 (SW)

      let t = 0;
      if (dir === 'N') t = 1 - u; // rises toward NW/N
      else if (dir === 'S') t = u; // rises toward SE/S
      else if (dir === 'E') t = 1 - v; // rises toward NE/E
      else t = v; // rises toward SW/W

      t = Math.max(0, Math.min(1, t));
      const h = Math.round(t * elev);
      heightMap[y * lw + x] = h;

      // Extrude column down to base diamond y
      const isLeftSide = x + 0.5 < cx;
      const wallShade: ShadeIndex = isLeftSide ? 1 : 2;
      for (let yy = y - h + 1; yy <= y; yy++) {
        buf.setPixel(x, yy, wallShade);
      }
    }
  }

  // Paint sloped top steps
  const stepCount = Math.max(3, Math.round(elev / 3));
  for (let y = baseTopY; y < lCellH; y++) {
    for (let x = 0; x < lw; x++) {
      const h = heightMap[y * lw + x];
      if (h < 0) continue;
      const stepBand = Math.floor((h / Math.max(1, elev)) * stepCount);
      let shade: ShadeIndex = stepBand % 2 === 0 ? 0 : 1;
      if (dither && bayer2x2(x, y) === 2 && shade === 0) {
        shade = 1;
      }
      buf.setPixel(x, y - h, shade);

      if (showOutlines && isDiamondEdge(x, y, m)) {
        buf.setPixel(x, y - h, 3);
      }
    }
  }

  if (showOutlines) {
    for (let y = baseTopY; y < lCellH; y++) {
      for (let x = 0; x < lw; x++) {
        if (isDiamondEdge(x, y, m)) {
          buf.setPixel(x, y, 3);
        }
      }
    }
  }
}

function drawFlatDiamond(
  buf: IndexedPixelBuffer,
  m: DiamondMetrics,
  baseShade: ShadeIndex,
  showOutlines: boolean,
  patternFn?: (x: number, y: number) => ShadeIndex,
): void {
  for (let y = m.baseTopY; y < m.lCellH; y++) {
    for (let x = 0; x < m.lw; x++) {
      if (m.mask[y * m.lw + x] === 0) continue;
      let shade: ShadeIndex = patternFn ? patternFn(x, y) : baseShade;
      if (showOutlines && isDiamondEdge(x, y, m)) {
        shade = 3;
      }
      buf.setPixel(x, y, shade);
    }
  }
}

function renderSingleTile(
  kind: TileKind,
  config: TilemapConfig,
): IndexedPixelBuffer {
  const scale = config.pixelScale;
  const lw = Math.max(8, Math.ceil(config.tileWidth / scale));
  const lh = Math.max(4, Math.ceil(config.tileHeight / scale));
  const lCellH = Math.max(lh, Math.ceil(config.cellHeight / scale));
  const lElev = Math.max(2, Math.ceil(config.blockElevation / scale));

  const buf = new IndexedPixelBuffer(lw, lCellH);
  const m = computeDiamondMetrics(lw, lh, lCellH);
  const cx = lw / 2;
  const cy = m.baseTopY + lh / 2;

  switch (kind) {
    case 'ground': {
      drawFlatDiamond(buf, m, 1, config.showOutlines, (x, y) => {
        if (config.ditherShading && bayer2x2(x, y) === 0 && hash2d(x, y, 3) > 0.78) {
          return 0;
        }
        return 1;
      });
      break;
    }

    case 'grass': {
      drawFlatDiamond(buf, m, 0, config.showOutlines, (x, y) => {
        const h = hash2d(x, y, 11);
        if (config.ditherShading && h > 0.76) return 1;
        if (h < 0.08 && y > m.baseTopY + 2 && y < m.lCellH - 3) {
          return 2;
        }
        return 0;
      });
      // Tiny grass tufts
      for (let i = 0; i < 6; i++) {
        const tx = Math.round(cx + (hash2d(i, 1, 29) - 0.5) * lw * 0.48);
        const ty = Math.round(cy + (hash2d(i, 2, 29) - 0.5) * lh * 0.42);
        if (ty >= m.baseTopY + 2 && ty < m.lCellH - 2 && m.mask[ty * lw + tx]) {
          buf.setPixel(tx, ty, 2);
          buf.setPixel(tx, ty - 1, 2);
          buf.setPixel(tx + 1, ty - 1, 1);
        }
      }
      break;
    }

    case 'stonePath': {
      drawFlatDiamond(buf, m, 1, config.showOutlines, (x, y) => {
        const nx = (x + 0.5 - cx) / (lw / 2);
        const ny = (y + 0.5 - cy) / (lh / 2);
        const u = Math.floor(((nx + ny) * 0.5 + 0.5) * 4);
        const v = Math.floor(((ny - nx) * 0.5 + 0.5) * 4);
        const fu = (((nx + ny) * 0.5 + 0.5) * 4) % 1;
        const fv = (((ny - nx) * 0.5 + 0.5) * 4) % 1;
        if (fu < 0.14 || fv < 0.14) return 2;
        return (u + v) % 2 === 0 ? 0 : 1;
      });
      break;
    }

    case 'water': {
      // Recessed basin rim + water surface
      drawFlatDiamond(buf, m, 2, config.showOutlines, (x, y) => {
        const dx = Math.abs(x + 0.5 - cx) / (lw / 2);
        const dy = Math.abs(y + 0.5 - cy) / (lh / 2);
        const dist = dx + dy;
        if (dist > 0.84) return 1; // bank lip
        if (dist > 0.74) return 3; // inner shadow drop
        const ripple = Math.sin(x * 0.5 + y * 0.8) > 0.82;
        if (ripple) return 0;
        if (config.ditherShading && bayer2x2(x, y) === 1) return 2;
        return 1;
      });
      break;
    }

    case 'raisedBlock': {
      drawExtrudedBlock(buf, m, lElev, config.showOutlines, config.ditherShading, 0);
      break;
    }

    case 'halfSlab': {
      drawExtrudedBlock(
        buf,
        m,
        Math.max(2, Math.round(lElev * 0.5)),
        config.showOutlines,
        config.ditherShading,
        0,
      );
      break;
    }

    case 'rampN':
      drawRampTile(buf, m, 'N', lElev, config.showOutlines, config.ditherShading);
      break;
    case 'rampE':
      drawRampTile(buf, m, 'E', lElev, config.showOutlines, config.ditherShading);
      break;
    case 'rampS':
      drawRampTile(buf, m, 'S', lElev, config.showOutlines, config.ditherShading);
      break;
    case 'rampW':
      drawRampTile(buf, m, 'W', lElev, config.showOutlines, config.ditherShading);
      break;

    case 'pillar': {
      drawFlatDiamond(buf, m, 1, config.showOutlines);
      const maxH = Math.min(m.baseTopY, Math.round(lElev * 1.65));
      drawExtrudedBlock(
        buf,
        m,
        maxH,
        config.showOutlines,
        config.ditherShading,
        Math.max(3, Math.round(lw * 0.2)),
      );
      break;
    }

    case 'crate': {
      drawFlatDiamond(buf, m, 2, false);
      const crateH = Math.min(m.baseTopY, Math.round(lElev * 0.85));
      const crateInset = Math.max(2, Math.round(lw * 0.14));
      drawExtrudedBlock(buf, m, crateH, true, config.ditherShading, crateInset);
      // Cross-brace lines on crate faces
      const midX = Math.floor(cx);
      const botMid = m.botY[midX];
      if (botMid !== -1) {
        const leftCornerX = Math.round(crateInset + 2);
        const rightCornerX = Math.round(lw - crateInset - 3);
        const topLeftY = m.botY[leftCornerX] !== -1 ? m.botY[leftCornerX] - crateH : botMid - crateH;
        const topRightY = m.botY[rightCornerX] !== -1 ? m.botY[rightCornerX] - crateH : botMid - crateH;
        buf.drawLine(leftCornerX + 1, topLeftY + 1, midX - 1, botMid - 1, 3);
        buf.drawLine(midX + 1, botMid - 1, rightCornerX - 1, topRightY + 1, 3);
      }
      break;
    }

    case 'arch': {
      drawFlatDiamond(buf, m, 1, config.showOutlines);
      const pillarH = Math.min(m.baseTopY, Math.round(lElev * 1.5));
      const pillarInset = Math.max(2, Math.round(lw * 0.08));
      drawExtrudedBlock(buf, m, pillarH, config.showOutlines, config.ditherShading, pillarInset);
      // Carve doorway cutout in the center front face
      const doorW = Math.max(3, Math.round(lw * 0.18));
      const doorH = Math.max(4, Math.round(pillarH * 0.72));
      const midX = Math.floor(cx);
      const botMid = m.botY[midX];
      if (botMid !== -1) {
        for (let dx = -doorW; dx <= doorW; dx++) {
          const x = midX + dx;
          const colBot = m.botY[x];
          if (colBot === -1) continue;
          const archRound = Math.round((dx * dx) / Math.max(1, doorW));
          const topDoor = colBot - Math.max(2, doorH - archRound);
          for (let y = topDoor; y <= colBot; y++) {
            buf.setPixel(x, y, 3);
          }
        }
      }
      break;
    }

    case 'cursor': {
      for (let y = m.baseTopY; y < m.lCellH; y++) {
        for (let x = 0; x < lw; x++) {
          if (m.mask[y * lw + x] === 0) continue;
          const dx = Math.abs(x + 0.5 - cx) / (lw / 2);
          const dy = Math.abs(y + 0.5 - cy) / (lh / 2);
          const dist = dx + dy;
          if (dist > 0.85) {
            buf.setPixel(x, y, dist > 0.94 ? 3 : 0);
          } else if (dist > 0.78 && (x + y) % 2 === 0) {
            buf.setPixel(x, y, 1);
          }
        }
      }
      break;
    }
  }

  return buf;
}

export function generateTilemapAtlas(
  config: TilemapConfig,
  palette: PaletteTheme,
): GeneratedAtlas {
  const tiles =
    config.selectedTiles.length > 0 ? config.selectedTiles : (['ground'] as TileKind[]);
  const cols = Math.max(1, Math.min(config.columns, tiles.length));
  const rows = Math.ceil(tiles.length / cols);
  const pad = Math.max(0, config.padding);
  const cellW = Math.max(16, Math.round(config.tileWidth));
  const cellH = Math.max(8, Math.round(config.cellHeight));

  const atlasW = cols * cellW + (cols + 1) * pad;
  const atlasH = rows * cellH + (rows + 1) * pad;
  const rgba = new Uint8ClampedArray(atlasW * atlasH * 4);
  const rgbPalette = palette.shades.map(hexToRgb) as [
    RGBColor,
    RGBColor,
    RGBColor,
    RGBColor,
  ];

  const frames: AtlasFrameSpec[] = [];

  tiles.forEach((kind, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const destX = pad + col * (cellW + pad);
    const destY = pad + row * (cellH + pad);

    const tileBuf = renderSingleTile(kind, config);
    tileBuf.blitToRgba(
      rgba,
      atlasW,
      atlasH,
      destX,
      destY,
      cellW,
      cellH,
      config.pixelScale,
      rgbPalette,
    );

    const def = ALL_TILE_DEFINITIONS.find((t) => t.id === kind);
    frames.push({
      id: kind,
      name: def ? def.label : kind,
      x: destX,
      y: destY,
      width: cellW,
      height: cellH,
      row,
      col,
    });
  });

  const canvas = createCanvasFromRgba(rgba, atlasW, atlasH);
  // Standard isometric tile anchor: center horizontally, bottom-center of diamond vertically
  const originX = Math.round(cellW / 2);
  const originY = Math.round(cellH - config.tileHeight / 2);

  return {
    canvas,
    width: atlasW,
    height: atlasH,
    cellWidth: cellW,
    cellHeight: cellH,
    columns: cols,
    rows,
    padding: pad,
    frames,
    originX,
    originY,
  };
}
