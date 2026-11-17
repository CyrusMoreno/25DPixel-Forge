import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  Grid,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AtlasFrameSpec,
  GeneratedAtlas,
  ISO_DIRECTIONS,
  IsoDirection,
  SPRITE_ACTION_LABELS,
  SpriteAction,
  StudioMode,
} from '../types/studio';
import { downloadSingleCellPng } from '../engine/exportBuilder';

interface PixelViewportProps {
  mode: StudioMode;
  atlas: GeneratedAtlas;
  tileDiamondHeight?: number;
  selectedFrame: AtlasFrameSpec | null;
  onSelectFrame: (frame: AtlasFrameSpec | null) => void;
}

const ZOOM_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6];

export function PixelViewport({
  mode,
  atlas,
  tileDiamondHeight,
  selectedFrame,
  onSelectFrame,
}: PixelViewportProps) {
  const [zoom, setZoom] = useState<number>(mode === 'tilemap' ? 1.5 : 1);
  const [checkerTheme, setCheckerTheme] = useState<'dark' | 'light'>('dark');
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [hoveredFrame, setHoveredFrame] = useState<AtlasFrameSpec | null>(null);

  // Turntable state for 8-direction spritesheet mode
  const [turntableDir, setTurntableDir] = useState<IsoDirection>('S');
  const [turntableAction, setTurntableAction] = useState<SpriteAction>('walk');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(8);
  const [animTick, setAnimTick] = useState<number>(0);

  const sheetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const turntableCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync turntable action if user toggled off the current action in the sidebar
  const availableActions = useMemo(() => {
    const set = new Set<SpriteAction>();
    atlas.frames.forEach((f) => {
      if (f.action) set.add(f.action);
    });
    return Array.from(set);
  }, [atlas.frames]);

  useEffect(() => {
    if (
      mode === 'spritesheet' &&
      availableActions.length > 0 &&
      !availableActions.includes(turntableAction)
    ) {
      setTurntableAction(availableActions[0]);
    }
  }, [mode, availableActions, turntableAction]);

  // Animation loop for live 8-dir turntable
  useEffect(() => {
    if (mode !== 'spritesheet' || !isPlaying) return;
    const intervalMs = Math.max(40, Math.round(1000 / fps));
    const timer = window.setInterval(() => {
      setAnimTick((t) => t + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [mode, isPlaying, fps]);

  const turntableFrames = useMemo(() => {
    return atlas.frames.filter(
      (f) => f.direction === turntableDir && f.action === turntableAction,
    );
  }, [atlas.frames, turntableDir, turntableAction]);

  const currentTurntableFrame =
    turntableFrames.length > 0
      ? turntableFrames[animTick % turntableFrames.length]
      : atlas.frames[0];

  // Paint full atlas onto display canvas
  useEffect(() => {
    const canvas = sheetCanvasRef.current;
    if (!canvas) return;
    canvas.width = atlas.width;
    canvas.height = atlas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, atlas.width, atlas.height);
    ctx.drawImage(atlas.canvas, 0, 0);
  }, [atlas]);

  // Paint current turntable frame onto preview canvas
  useEffect(() => {
    if (mode !== 'spritesheet' || !currentTurntableFrame) return;
    const canvas = turntableCanvasRef.current;
    if (!canvas) return;
    canvas.width = atlas.cellWidth;
    canvas.height = atlas.cellHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      atlas.canvas,
      currentTurntableFrame.x,
      currentTurntableFrame.y,
      currentTurntableFrame.width,
      currentTurntableFrame.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [mode, atlas, currentTurntableFrame]);

  const activeFrame = selectedFrame ?? hoveredFrame ?? atlas.frames[0] ?? null;

  const stepZoom = (delta: number) => {
    if (delta > 0) {
      const next = ZOOM_STEPS.find((z) => z > zoom);
      if (next) setZoom(next);
    } else {
      const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoom);
      if (prev) setZoom(prev);
    }
  };

  const handleCanvasPointer = (
    e: React.MouseEvent<HTMLCanvasElement>,
    commitSelection: boolean,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoom;
    const py = (e.clientY - rect.top) / zoom;

    const hit =
      atlas.frames.find(
        (f) => px >= f.x && px < f.x + f.width && py >= f.y && py < f.y + f.height,
      ) ?? null;

    if (commitSelection) {
      onSelectFrame(hit && selectedFrame?.id === hit.id ? null : hit);
    } else {
      setHoveredFrame(hit);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-slate-950 overflow-hidden">
      {/* Viewport Toolbar */}
      <div className="h-11 px-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
          <span className="text-slate-200 font-medium">
            {atlas.width}×{atlas.height} px
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {atlas.columns}×{atlas.rows} grid
          </span>
          <span aria-hidden="true">·</span>
          <span>{atlas.frames.length} cells</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              setCheckerTheme((t) => (t === 'dark' ? 'light' : 'dark'))
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded cursor-pointer whitespace-nowrap"
            title="Toggle alpha checkerboard contrast"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{checkerTheme === 'dark' ? 'Dark Alpha' : 'Light Alpha'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGridOverlay((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border cursor-pointer whitespace-nowrap ${
              showGridOverlay
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid Overlay</span>
          </button>

          <div className="flex items-center border border-slate-700 rounded bg-slate-900">
            <button
              type="button"
              onClick={() => stepZoom(-1)}
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-slate-200 min-w-[48px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => stepZoom(1)}
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setZoom(mode === 'tilemap' ? 1.5 : 1)}
            className="p-1.5 text-slate-400 hover:text-slate-100 border border-slate-800 rounded cursor-pointer"
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Optional Live 8-Dir Turntable + Full Atlas Canvas */}
      <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-hidden">
        {mode === 'spritesheet' && (
          <div className="xl:w-[272px] shrink-0 border-b xl:border-b-0 xl:border-r border-slate-800 bg-slate-900/30 p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                8-Dir Turntable Preview
              </span>
              <span className="font-mono text-xs text-emerald-400 tabular-nums">
                {turntableDir} · {SPRITE_ACTION_LABELS[turntableAction]}
              </span>
            </div>

            <div className="flex items-center justify-center">
              <div
                className={`relative border border-slate-700 rounded overflow-hidden flex items-center justify-center ${
                  checkerTheme === 'dark' ? 'checker-dark' : 'checker-light'
                }`}
                style={{ width: 176, height: 176 }}
              >
                <canvas
                  ref={turntableCanvasRef}
                  className="pixelated"
                  style={{
                    width: Math.min(160, atlas.cellWidth * 2),
                    height: Math.min(160, atlas.cellHeight * 2),
                    objectFit: 'contain',
                  }}
                />
                {showGridOverlay && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-full h-px bg-emerald-400/20" />
                  </div>
                )}
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono tabular-nums">{fps} FPS</span>
                <input
                  type="range"
                  min={2}
                  max={16}
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value, 10))}
                  className="w-20 accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Action Tabs */}
            <div className="grid grid-cols-4 gap-1">
              {availableActions.map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => {
                    setTurntableAction(act);
                    setAnimTick(0);
                  }}
                  className={`py-1 text-xs rounded border transition-colors cursor-pointer ${
                    turntableAction === act
                      ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-medium'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {SPRITE_ACTION_LABELS[act]}
                </button>
              ))}
            </div>

            {/* 8-Way Compass Selector */}
            <div className="space-y-1.5">
              <span className="block text-xs text-slate-400">
                Isometric Facing (8 Directions)
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'] as Array<
                  IsoDirection | null
                >).map((dir, i) => {
                  if (!dir) {
                    return (
                      <div
                        key={`center-${i}`}
                        className="flex items-center justify-center text-[10px] font-mono text-slate-500 border border-slate-800/60 rounded bg-slate-950/40"
                      >
                        8-WAY
                      </div>
                    );
                  }
                  const active = turntableDir === dir;
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setTurntableDir(dir)}
                      className={`py-1.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {dir}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Row order: {ISO_DIRECTIONS.join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Pixel Atlas Canvas */}
        <div className="flex-1 min-w-0 min-h-0 overflow-auto p-6 flex items-start justify-center">
          <div
            className={`relative border border-slate-700 shadow-lg shrink-0 ${
              checkerTheme === 'dark' ? 'checker-dark' : 'checker-light'
            }`}
            style={{
              width: atlas.width * zoom,
              height: atlas.height * zoom,
            }}
          >
            <canvas
              ref={sheetCanvasRef}
              onMouseMove={(e) => handleCanvasPointer(e, false)}
              onMouseLeave={() => setHoveredFrame(null)}
              onClick={(e) => handleCanvasPointer(e, true)}
              className="block pixelated cursor-crosshair"
              style={{
                width: atlas.width * zoom,
                height: atlas.height * zoom,
              }}
            />

            {/* Crisp SVG Overlay for cell bounds & diamond anchors */}
            {showGridOverlay && (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                width={atlas.width * zoom}
                height={atlas.height * zoom}
                viewBox={`0 0 ${atlas.width} ${atlas.height}`}
              >
                {atlas.frames.map((f) => {
                  const isSelected = selectedFrame?.id === f.id;
                  const isHovered = hoveredFrame?.id === f.id;
                  return (
                    <g key={f.id}>
                      <rect
                        x={f.x}
                        y={f.y}
                        width={f.width}
                        height={f.height}
                        fill="none"
                        stroke={
                          isSelected
                            ? '#22c55e'
                            : isHovered
                              ? '#38bdf8'
                              : 'rgba(148, 163, 184, 0.28)'
                        }
                        strokeWidth={isSelected || isHovered ? 1.5 / zoom : 0.75 / zoom}
                      />
                      {mode === 'tilemap' && tileDiamondHeight && (
                        <polygon
                          points={`${f.x + f.width / 2},${f.y + f.height - tileDiamondHeight} ${f.x + f.width},${f.y + f.height - tileDiamondHeight / 2} ${f.x + f.width / 2},${f.y + f.height} ${f.x},${f.y + f.height - tileDiamondHeight / 2}`}
                          fill="none"
                          stroke="rgba(34, 197, 94, 0.32)"
                          strokeDasharray={`${2 / zoom} ${2 / zoom}`}
                          strokeWidth={0.75 / zoom}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Cell Inspector Strip */}
      <div className="h-10 px-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4 text-xs shrink-0">
        {activeFrame ? (
          <>
            <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300 truncate">
              <span className="font-sans font-medium text-slate-100">
                {activeFrame.name}
              </span>
              <span className="text-slate-500">·</span>
              <span>
                x:{activeFrame.x} y:{activeFrame.y}
              </span>
              <span className="text-slate-500">·</span>
              <span>
                {activeFrame.width}×{activeFrame.height} px
              </span>
              <span className="text-slate-500">·</span>
              <span>
                Row {activeFrame.row}, Col {activeFrame.col}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                downloadSingleCellPng(
                  atlas,
                  activeFrame.x,
                  activeFrame.y,
                  activeFrame.width,
                  activeFrame.height,
                  `${activeFrame.id}.png`,
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Cell PNG</span>
            </button>
          </>
        ) : (
          <span className="text-slate-500">
            Hover or click any tile/frame in the atlas to inspect coordinates or export individually.
          </span>
        )}
      </div>
    </div>
  );
}
