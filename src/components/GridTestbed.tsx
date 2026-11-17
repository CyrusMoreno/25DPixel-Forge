import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, RotateCcw, Swords, Zap } from 'lucide-react';
import {
  GeneratedAtlas,
  IsoDirection,
  SPRITE_ACTION_LABELS,
  SpriteAction,
  TileKind,
  TilemapConfig,
} from '../types/studio';

interface GridTestbedProps {
  tileAtlas: GeneratedAtlas;
  spriteAtlas: GeneratedAtlas;
  tileConfig: TilemapConfig;
}

const GRID_SIZE = 6;

function createStarterMap(): Array<Array<TileKind | null>> {
  const map: Array<Array<TileKind | null>> = Array.from(
    { length: GRID_SIZE },
    () => Array<TileKind | null>(GRID_SIZE).fill('ground'),
  );
  map[0][0] = 'pillar';
  map[0][1] = 'raisedBlock';
  map[0][2] = 'arch';
  map[0][3] = 'raisedBlock';
  map[1][0] = 'grass';
  map[2][0] = 'grass';
  map[1][2] = 'stonePath';
  map[2][2] = 'stonePath';
  map[3][2] = 'stonePath';
  map[3][3] = 'stonePath';
  map[4][3] = 'water';
  map[4][4] = 'water';
  map[2][4] = 'crate';
  map[1][4] = 'rampS';
  return map;
}

function getIsoDirectionFromDelta(dx: number, dy: number): IsoDirection {
  // Grid coords: +gx goes screen bottom-right (SE), +gy goes screen bottom-left (SW)
  // Screen vector: sx = dx - dy, sy = dx + dy
  const sx = dx - dy;
  const sy = dx + dy;
  if (sx === 0 && sy > 0) return 'S';
  if (sx < 0 && sy > 0) return 'SW';
  if (sx < 0 && sy === 0) return 'W';
  if (sx < 0 && sy < 0) return 'NW';
  if (sx === 0 && sy < 0) return 'N';
  if (sx > 0 && sy < 0) return 'NE';
  if (sx > 0 && sy === 0) return 'E';
  return 'SE';
}

export function GridTestbed({
  tileAtlas,
  spriteAtlas,
  tileConfig,
}: GridTestbedProps) {
  const [gridMap, setGridMap] = useState<Array<Array<TileKind | null>>>(() =>
    createStarterMap(),
  );
  const [brush, setBrush] = useState<TileKind | 'erase'>('raisedBlock');
  const [playerPos, setPlayerPos] = useState<{ gx: number; gy: number }>({
    gx: 2.5,
    gy: 2.5,
  });
  const [playerDir, setPlayerDir] = useState<IsoDirection>('S');
  const [playerAction, setPlayerAction] = useState<SpriteAction>('idle');
  const [animTick, setAnimTick] = useState(0);
  const [hoverCell, setHoverCell] = useState<{ gx: number; gy: number } | null>(
    null,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  const tw = tileConfig.tileWidth;
  const th = tileConfig.tileHeight;
  const cellH = tileConfig.cellHeight;

  const canvasW = Math.max(640, GRID_SIZE * tw + 80);
  const canvasH = Math.max(460, GRID_SIZE * th + cellH + 80);
  const originScreenX = canvasW / 2;
  const originScreenY = cellH + 24;

  // Tile lookup map
  const tileFrameMap = useMemo(() => {
    const map = new Map<string, (typeof tileAtlas.frames)[0]>();
    tileAtlas.frames.forEach((f) => map.set(f.id, f));
    return map;
  }, [tileAtlas.frames]);

  // Ensure brush stays valid if tiles change
  useEffect(() => {
    if (brush !== 'erase' && !tileFrameMap.has(brush) && tileAtlas.frames[0]) {
      setBrush(tileAtlas.frames[0].id as TileKind);
    }
  }, [brush, tileFrameMap, tileAtlas.frames]);

  // Keyboard movement loop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        ) &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
      }
      keysPressed.current.add(e.code);
      if (e.code === 'Space') setPlayerAction('attack');
      if (e.code === 'KeyH') setPlayerAction('hurt');
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      if (e.code === 'Space' || e.code === 'KeyH') {
        setPlayerAction('idle');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setAnimTick((t) => t + 1);

      const keys = keysPressed.current;
      let screenDx = 0;
      let screenDy = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) screenDy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) screenDy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) screenDx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) screenDx += 1;

      if (screenDx !== 0 || screenDy !== 0) {
        // Convert screen direction to isometric grid delta
        const gxDelta = (screenDx + screenDy) * 0.085;
        const gyDelta = (screenDy - screenDx) * 0.085;

        setPlayerPos((prev) => ({
          gx: Math.max(0.2, Math.min(GRID_SIZE - 0.2, prev.gx + gxDelta)),
          gy: Math.max(0.2, Math.min(GRID_SIZE - 0.2, prev.gy + gyDelta)),
        }));
        setPlayerDir(getIsoDirectionFromDelta(gxDelta, gyDelta));
        if (!keys.has('Space') && !keys.has('KeyH')) {
          setPlayerAction('walk');
        }
      } else if (!keys.has('Space') && !keys.has('KeyH')) {
        setPlayerAction((curr) => (curr === 'walk' ? 'idle' : curr));
      }
    }, 85);

    return () => window.clearInterval(stepTimer);
  }, []);

  // Render isometric stage with proper painter's-algorithm Y-sorting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Subtle wireframe grid floor
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const cx = originScreenX + (gx - gy) * (tw / 2);
        const topY = originScreenY + (gx + gy) * (th / 2);
        ctx.beginPath();
        ctx.moveTo(cx, topY);
        ctx.lineTo(cx + tw / 2, topY + th / 2);
        ctx.lineTo(cx, topY + th);
        ctx.lineTo(cx - tw / 2, topY + th / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Painter's depth draw list: tiles + sprite
    const drawOps: Array<{ depth: number; draw: () => void }> = [];

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const kind = gridMap[gx][gy];
        if (!kind) continue;
        const frame =
          tileFrameMap.get(kind) ?? tileAtlas.frames[0];
        if (!frame) continue;

        const screenX = Math.round(originScreenX + (gx - gy) * (tw / 2) - tw / 2);
        const screenY = Math.round(
          originScreenY + (gx + gy) * (th / 2) - (cellH - th),
        );

        const isFlat =
          kind === 'ground' ||
          kind === 'grass' ||
          kind === 'stonePath' ||
          kind === 'water' ||
          kind === 'cursor';

        drawOps.push({
          depth: isFlat ? gx + gy - 100 : gx + gy + 0.5,
          draw: () => {
            ctx.drawImage(
              tileAtlas.canvas,
              frame.x,
              frame.y,
              frame.width,
              frame.height,
              screenX,
              screenY,
              frame.width,
              frame.height,
            );
          },
        });
      }
    }

    // Hover diamond highlight
    if (hoverCell) {
      const { gx, gy } = hoverCell;
      const cx = originScreenX + (gx - gy) * (tw / 2);
      const topY = originScreenY + (gx + gy) * (th / 2);
      drawOps.push({
        depth: -50,
        draw: () => {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, topY);
          ctx.lineTo(cx + tw / 2, topY + th / 2);
          ctx.lineTo(cx, topY + th);
          ctx.lineTo(cx - tw / 2, topY + th / 2);
          ctx.closePath();
          ctx.stroke();
        },
      });
    }

    // Player/Monster Sprite
    const matchingFrames = spriteAtlas.frames.filter(
      (f) => f.direction === playerDir && f.action === playerAction,
    );
    const fallbackFrames = spriteAtlas.frames.filter(
      (f) => f.direction === playerDir,
    );
    const activeFrames =
      matchingFrames.length > 0
        ? matchingFrames
        : fallbackFrames.length > 0
          ? fallbackFrames
          : spriteAtlas.frames;

    if (activeFrames.length > 0) {
      const frame = activeFrames[animTick % activeFrames.length];
      const footScreenX =
        originScreenX + (playerPos.gx - playerPos.gy) * (tw / 2);
      const footScreenY =
        originScreenY + (playerPos.gx + playerPos.gy) * (th / 2) + th / 2;

      drawOps.push({
        depth: playerPos.gx + playerPos.gy,
        draw: () => {
          ctx.drawImage(
            spriteAtlas.canvas,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            Math.round(footScreenX - spriteAtlas.originX),
            Math.round(footScreenY - spriteAtlas.originY),
            frame.width,
            frame.height,
          );
        },
      });
    }

    drawOps.sort((a, b) => a.depth - b.depth);
    drawOps.forEach((op) => op.draw());
  }, [
    canvasW,
    canvasH,
    originScreenX,
    originScreenY,
    tw,
    th,
    cellH,
    gridMap,
    tileFrameMap,
    tileAtlas,
    spriteAtlas,
    hoverCell,
    playerDir,
    playerAction,
    playerPos,
    animTick,
  ]);

  const screenToGrid = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): { gx: number; gy: number } | null => {
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const sx = (clientX - rect.left) * scaleX - originScreenX;
    const sy = (clientY - rect.top) * scaleY - originScreenY;

    const gx = Math.floor((sx / (tw / 2) + sy / (th / 2)) / 2);
    const gy = Math.floor((sy / (th / 2) - sx / (tw / 2)) / 2);
    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      return { gx, gy };
    }
    return null;
  };

  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = screenToGrid(
      e.clientX,
      e.clientY,
      e.currentTarget.getBoundingClientRect(),
    );
    if (!cell) return;
    setGridMap((prev) =>
      prev.map((row, rIdx) =>
        rIdx === cell.gx
          ? row.map((val, cIdx) =>
              cIdx === cell.gy ? (brush === 'erase' ? null : brush) : val,
            )
          : row,
      ),
    );
  };

  const handleStageMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setHoverCell(
      screenToGrid(
        e.clientX,
        e.clientY,
        e.currentTarget.getBoundingClientRect(),
      ),
    );
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-slate-950 overflow-hidden">
      {/* Testbed Toolbar */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-medium text-slate-400 shrink-0">
            Paint Tile:
          </span>
          {tileAtlas.frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => setBrush(frame.id as TileKind)}
              className={`px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brush === frame.id
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {frame.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBrush('erase')}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brush === 'erase'
                ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eraser className="w-3 h-3" />
            <span>Erase</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setGridMap(createStarterMap())}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setGridMap(
                Array.from({ length: GRID_SIZE }, () =>
                  Array<TileKind | null>(GRID_SIZE).fill('ground'),
                ),
              )
            }
            className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded cursor-pointer"
          >
            Flat Floor
          </button>
        </div>
      </div>

      {/* Interactive Stage */}
      <div className="flex-1 min-h-0 overflow-auto p-6 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleStageClick}
          onMouseMove={handleStageMove}
          onMouseLeave={() => setHoverCell(null)}
          className="pixelated checker-dark border border-slate-800 rounded max-w-full h-auto cursor-crosshair"
        />
      </div>

      {/* Bottom Controls Hint Bar */}
      <div className="h-11 px-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4 text-xs shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3 text-slate-400 whitespace-nowrap">
          <span>
            Move: <strong className="text-slate-200 font-mono">WASD / Arrows</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Click diamonds to paint tiles
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-emerald-400">
            Facing {playerDir} · {SPRITE_ACTION_LABELS[playerAction]}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onMouseDown={() => setPlayerAction('attack')}
            onMouseUp={() => setPlayerAction('idle')}
            onMouseLeave={() =>
              setPlayerAction((a) => (a === 'attack' ? 'idle' : a))
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Attack (Space)</span>
          </button>
          <button
            type="button"
            onMouseDown={() => setPlayerAction('hurt')}
            onMouseUp={() => setPlayerAction('idle')}
            onMouseLeave={() =>
              setPlayerAction((a) => (a === 'hurt' ? 'idle' : a))
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Hurt (H)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
