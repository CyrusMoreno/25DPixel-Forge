export type ShadeIndex = 0 | 1 | 2 | 3; // 0=Highlight, 1=Midtone, 2=Shadow, 3=Deep/Outline

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  const num = parseInt(clean.padEnd(6, '0').slice(0, 6), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Indexed integer pixel buffer with strict binary alpha (-1 = transparent, 0..3 = shade index).
 * Prevents any sub-pixel anti-aliasing fringe so exported PNGs are cleanly editable in pixel software.
 */
export class IndexedPixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Int8Array;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.data = new Int8Array(this.width * this.height);
    this.data.fill(-1);
  }

  setPixel(x: number, y: number, shade: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    this.data[iy * this.width + ix] = shade;
  }

  getPixel(x: number, y: number): number {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return -1;
    return this.data[iy * this.width + ix];
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, shade: ShadeIndex): void {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);

    const dx = Math.abs(ix1 - ix0);
    const dy = -Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this.setPixel(ix0, iy0, shade);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    shadeFn: (x: number, y: number, nx: number, ny: number) => number,
  ): void {
    const rxi = Math.max(0.5, rx);
    const ryi = Math.max(0.5, ry);
    const minX = Math.max(0, Math.floor(cx - rxi - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rxi + 1));
    const minY = Math.max(0, Math.floor(cy - ryi - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + ryi + 1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const nx = (x + 0.5 - cx) / rxi;
        const ny = (y + 0.5 - cy) / ryi;
        if (nx * nx + ny * ny <= 1.0) {
          const s = shadeFn(x, y, nx, ny);
          if (s >= 0) {
            this.data[y * this.width + x] = s;
          }
        }
      }
    }
  }

  fillRect(
    x0: number,
    y0: number,
    w: number,
    h: number,
    shadeFn: (x: number, y: number) => number,
  ): void {
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(this.width - 1, Math.floor(x0 + w - 1));
    const minY = Math.max(0, Math.floor(y0));
    const maxY = Math.min(this.height - 1, Math.floor(y0 + h - 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const s = shadeFn(x, y);
        if (s >= 0) {
          this.data[y * this.width + x] = s;
        }
      }
    }
  }

  fillPolygon(
    points: Array<[number, number]>,
    shadeFn: (x: number, y: number) => number,
  ): void {
    if (points.length < 3) return;
    let minX = this.width - 1;
    let maxX = 0;
    let minY = this.height - 1;
    let maxY = 0;
    for (const [px, py] of points) {
      if (px < minX) minX = Math.floor(px);
      if (px > maxX) maxX = Math.ceil(px);
      if (py < minY) minY = Math.floor(py);
      if (py > maxY) maxY = Math.ceil(py);
    }
    minX = Math.max(0, minX);
    maxX = Math.min(this.width - 1, maxX);
    minY = Math.max(0, minY);
    maxY = Math.min(this.height - 1, maxY);

    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const xi = points[i][0];
          const yi = points[i][1];
          const xj = points[j][0];
          const yj = points[j][1];
          const intersect =
            yi > py !== yj > py &&
            px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
          if (intersect) inside = !inside;
        }
        if (inside) {
          const s = shadeFn(x, y);
          if (s >= 0) {
            this.data[y * this.width + x] = s;
          }
        }
      }
    }
  }

  /**
   * Adds a 1px crisp dark silhouette outline (shade 3) on transparent pixels adjacent (4-neighbor)
   * to opaque pixels, ignoring specified protected pixels (e.g. shadow dots).
   */
  applyOutline(outlineShade: ShadeIndex = 3, protectedMask?: Uint8Array): void {
    const copy = new Int8Array(this.data);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        if (copy[idx] !== -1) continue;
        if (protectedMask && protectedMask[idx] === 1) continue;

        const hasOpaqueNeighbor =
          (x > 0 && copy[idx - 1] !== -1 && (!protectedMask || protectedMask[idx - 1] === 0)) ||
          (x < this.width - 1 && copy[idx + 1] !== -1 && (!protectedMask || protectedMask[idx + 1] === 0)) ||
          (y > 0 && copy[idx - this.width] !== -1 && (!protectedMask || protectedMask[idx - this.width] === 0)) ||
          (y < this.height - 1 && copy[idx + this.width] !== -1 && (!protectedMask || protectedMask[idx + this.width] === 0));

        if (hasOpaqueNeighbor) {
          this.data[idx] = outlineShade;
        }
      }
    }
  }

  /**
   * Upscale this logical buffer by an exact integer factor onto a target RGBA ImageData
   * at destination (destX, destY) inside a target canvas ImageData of size (targetW, targetH).
   */
  blitToRgba(
    rgba: Uint8ClampedArray,
    targetW: number,
    targetH: number,
    destX: number,
    destY: number,
    cellW: number,
    cellH: number,
    scale: number,
    palette: [RGBColor, RGBColor, RGBColor, RGBColor],
  ): void {
    for (let py = 0; py < cellH; py++) {
      const ly = Math.floor(py / scale);
      if (ly >= this.height) continue;
      const outY = destY + py;
      if (outY < 0 || outY >= targetH) continue;

      for (let px = 0; px < cellW; px++) {
        const lx = Math.floor(px / scale);
        if (lx >= this.width) continue;
        const shade = this.data[ly * this.width + lx];
        if (shade < 0 || shade > 3) continue;

        const outX = destX + px;
        if (outX < 0 || outX >= targetW) continue;

        const color = palette[shade];
        const offset = (outY * targetW + outX) * 4;
        rgba[offset] = color.r;
        rgba[offset + 1] = color.g;
        rgba[offset + 2] = color.b;
        rgba[offset + 3] = 255;
      }
    }
  }
}

export function createCanvasFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
}
