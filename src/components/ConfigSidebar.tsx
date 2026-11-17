import { AlertTriangle, Shuffle, SlidersHorizontal } from 'lucide-react';
import {
  ALL_ARCHETYPES,
  ALL_TILE_DEFINITIONS,
  PaletteTheme,
  PixelScale,
  RETRO_PALETTES,
  SPRITE_ACTION_LABELS,
  SpriteAction,
  SpriteConfig,
  StudioMode,
  TileKind,
  TilemapConfig,
} from '../types/studio';
import { downloadGplPalette } from '../engine/exportBuilder';

interface ConfigSidebarProps {
  activeMode: StudioMode;
  tileConfig: TilemapConfig;
  onTileConfigChange: (next: TilemapConfig) => void;
  spriteConfig: SpriteConfig;
  onSpriteConfigChange: (next: SpriteConfig) => void;
  palette: PaletteTheme;
  onPaletteChange: (next: PaletteTheme) => void;
}

const TILE_DIM_PRESETS = [
  { label: '128×64 HD', w: 128, h: 64, cellH: 128, elev: 32 },
  { label: '64×32 Classic', w: 64, h: 32, cellH: 64, elev: 16 },
  { label: '32×16 Retro', w: 32, h: 16, cellH: 32, elev: 8 },
  { label: '64×64 1:1', w: 64, h: 64, cellH: 96, elev: 24 },
];

const SPRITE_DIM_PRESETS = [
  { label: '128×128', w: 128, h: 128 },
  { label: '96×96', w: 96, h: 96 },
  { label: '64×64', w: 64, h: 64 },
  { label: '48×64', w: 48, h: 64 },
];

const SHADE_NAMES = ['Highlight', 'Midtone', 'Shadow', 'Outline'] as const;

export function ConfigSidebar({
  activeMode,
  tileConfig,
  onTileConfigChange,
  spriteConfig,
  onSpriteConfigChange,
  palette,
  onPaletteChange,
}: ConfigSidebarProps) {
  const showTileControls = activeMode === 'tilemap' || activeMode === 'testbed';
  const showSpriteControls = activeMode === 'spritesheet' || activeMode === 'testbed';

  const clampNum = (val: string, min: number, max: number, fallback: number) => {
    const parsed = parseInt(val, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };

  const tileClippingWarning =
    tileConfig.cellHeight < tileConfig.tileHeight + tileConfig.blockElevation;

  const toggleTileKind = (id: TileKind) => {
    const exists = tileConfig.selectedTiles.includes(id);
    if (exists && tileConfig.selectedTiles.length <= 1) return;
    const next = exists
      ? tileConfig.selectedTiles.filter((t) => t !== id)
      : [...tileConfig.selectedTiles, id];
    onTileConfigChange({ ...tileConfig, selectedTiles: next });
  };

  const applyTileBundle = (bundle: 'all' | 'basic' | 'slopes') => {
    if (bundle === 'all') {
      onTileConfigChange({
        ...tileConfig,
        selectedTiles: ALL_TILE_DEFINITIONS.map((t) => t.id),
      });
    } else if (bundle === 'basic') {
      onTileConfigChange({
        ...tileConfig,
        selectedTiles: ['ground', 'grass', 'stonePath', 'water', 'raisedBlock', 'halfSlab', 'crate', 'cursor'],
      });
    } else {
      onTileConfigChange({
        ...tileConfig,
        selectedTiles: ['ground', 'raisedBlock', 'rampN', 'rampE', 'rampS', 'rampW', 'pillar', 'arch'],
      });
    }
  };

  const filteredArchetypes = ALL_ARCHETYPES.filter(
    (a) => a.category === spriteConfig.category,
  );

  const handleCategorySwitch = (category: 'character' | 'monster') => {
    const firstMatch = ALL_ARCHETYPES.find((a) => a.category === category);
    onSpriteConfigChange({
      ...spriteConfig,
      category,
      archetype: firstMatch ? firstMatch.id : spriteConfig.archetype,
    });
  };

  const updateShade = (index: 0 | 1 | 2 | 3, hex: string) => {
    const nextShades: [string, string, string, string] = [...palette.shades] as [
      string,
      string,
      string,
      string,
    ];
    nextShades[index] = hex;
    onPaletteChange({
      id: 'custom',
      name: 'Custom Mono',
      shades: nextShades,
    });
  };

  return (
    <aside className="w-full lg:w-[304px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 overflow-y-auto">
      <div className="divide-y divide-slate-800">
        {/* Section 1: Tilemap Controls */}
        {showTileControls && (
          <section className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Tile Grid Dimensions
              </h2>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {tileConfig.tileWidth}×{tileConfig.tileHeight}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {TILE_DIM_PRESETS.map((preset) => {
                const isSelected =
                  tileConfig.tileWidth === preset.w &&
                  tileConfig.tileHeight === preset.h;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onTileConfigChange({
                        ...tileConfig,
                        tileWidth: preset.w,
                        tileHeight: preset.h,
                        cellHeight: preset.cellH,
                        blockElevation: preset.elev,
                      })
                    }
                    className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="block text-xs text-slate-400">Tile Width (px)</span>
                <input
                  type="number"
                  min={16}
                  max={512}
                  step={2}
                  value={tileConfig.tileWidth}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      tileWidth: clampNum(e.target.value, 16, 512, 128),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-xs text-slate-400">Diamond H (px)</span>
                <input
                  type="number"
                  min={8}
                  max={256}
                  step={2}
                  value={tileConfig.tileHeight}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      tileHeight: clampNum(e.target.value, 8, 256, 64),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-xs text-slate-400">Cell Height (px)</span>
                <input
                  type="number"
                  min={tileConfig.tileHeight}
                  max={512}
                  step={2}
                  value={tileConfig.cellHeight}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      cellHeight: clampNum(
                        e.target.value,
                        tileConfig.tileHeight,
                        512,
                        128,
                      ),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-xs text-slate-400">Block Elev (px)</span>
                <input
                  type="number"
                  min={4}
                  max={256}
                  step={2}
                  value={tileConfig.blockElevation}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      blockElevation: clampNum(e.target.value, 4, 256, 32),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            {tileClippingWarning && (
              <div className="p-2.5 rounded border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 space-y-1.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Cell height ({tileConfig.cellHeight}px) is smaller than diamond + extrusion.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onTileConfigChange({
                      ...tileConfig,
                      cellHeight:
                        tileConfig.tileHeight + Math.round(tileConfig.blockElevation * 1.65),
                    })
                  }
                  className="text-xs font-medium text-amber-300 underline hover:text-amber-200 cursor-pointer"
                >
                  Auto-fit Cell Height
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <span className="block text-xs text-slate-400">Pixel Chunk Scale</span>
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded">
                  {([1, 2, 4] as PixelScale[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        onTileConfigChange({ ...tileConfig, pixelScale: s })
                      }
                      className={`py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                        tileConfig.pixelScale === s
                          ? 'bg-slate-800 text-emerald-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>

              <label className="space-y-1">
                <span className="block text-xs text-slate-400">Columns</span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={tileConfig.columns}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      columns: clampNum(e.target.value, 1, 14, 4),
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tileConfig.showOutlines}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      showOutlines: e.target.checked,
                    })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>1px Outlines</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tileConfig.ditherShading}
                  onChange={(e) =>
                    onTileConfigChange({
                      ...tileConfig,
                      ditherShading: e.target.checked,
                    })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Bayer Dither</span>
              </label>
            </div>

            {activeMode === 'tilemap' && (
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    Included Tiles ({tileConfig.selectedTiles.length})
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => applyTileBundle('all')}
                      className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTileBundle('basic')}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Basic
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTileBundle('slopes')}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Ramps
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_TILE_DEFINITIONS.map((tile) => {
                    const checked = tileConfig.selectedTiles.includes(tile.id);
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => toggleTileKind(tile.id)}
                        className={`px-2 py-1 text-left text-xs rounded border transition-colors truncate cursor-pointer ${
                          checked
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                            : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {tile.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Section 2: 8-Dir Sprite Controls */}
        {showSpriteControls && (
          <section className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                8-Dir Sprite Generator
              </h2>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {spriteConfig.frameWidth}×{spriteConfig.frameHeight}
              </span>
            </div>

            {/* Category + Archetype */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
                {(['character', 'monster'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySwitch(cat)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors capitalize cursor-pointer ${
                      spriteConfig.category === cat
                        ? 'bg-slate-800 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'character' ? 'Characters' : 'Monsters'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {filteredArchetypes.map((arch) => {
                  const active = spriteConfig.archetype === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() =>
                        onSpriteConfigChange({
                          ...spriteConfig,
                          archetype: arch.id,
                        })
                      }
                      className={`px-2 py-1.5 text-xs rounded border transition-colors truncate cursor-pointer ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-medium'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {arch.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sprite Frame Size */}
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1">
                {SPRITE_DIM_PRESETS.map((preset) => {
                  const isSelected =
                    spriteConfig.frameWidth === preset.w &&
                    spriteConfig.frameHeight === preset.h;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        onSpriteConfigChange({
                          ...spriteConfig,
                          frameWidth: preset.w,
                          frameHeight: preset.h,
                        })
                      }
                      className={`py-1 text-[11px] font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="block text-xs text-slate-400">Frame W</span>
                  <input
                    type="number"
                    min={16}
                    max={256}
                    step={2}
                    value={spriteConfig.frameWidth}
                    onChange={(e) =>
                      onSpriteConfigChange({
                        ...spriteConfig,
                        frameWidth: clampNum(e.target.value, 16, 256, 96),
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-xs text-slate-400">Frame H</span>
                  <input
                    type="number"
                    min={16}
                    max={256}
                    step={2}
                    value={spriteConfig.frameHeight}
                    onChange={(e) =>
                      onSpriteConfigChange({
                        ...spriteConfig,
                        frameHeight: clampNum(e.target.value, 16, 256, 96),
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <div className="space-y-1">
                  <span className="block text-xs text-slate-400">Chunk</span>
                  <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-slate-950 border border-slate-800 rounded h-[30px]">
                    {([1, 2, 4] as PixelScale[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          onSpriteConfigChange({ ...spriteConfig, pixelScale: s })
                        }
                        className={`text-[11px] font-mono rounded cursor-pointer ${
                          spriteConfig.pixelScale === s
                            ? 'bg-slate-800 text-emerald-300 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Animations */}
            {activeMode === 'spritesheet' && (
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <span className="block text-xs font-medium text-slate-300">
                  8-Dir Action Animations
                </span>
                <div className="space-y-1.5">
                  {(['idle', 'walk', 'attack', 'hurt'] as SpriteAction[]).map((act) => {
                    const enabled = spriteConfig.enabledActions[act];
                    return (
                      <div
                        key={act}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              onSpriteConfigChange({
                                ...spriteConfig,
                                enabledActions: {
                                  ...spriteConfig.enabledActions,
                                  [act]: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>{SPRITE_ACTION_LABELS[act]}</span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Frames</span>
                          <input
                            type="number"
                            min={1}
                            max={8}
                            disabled={!enabled}
                            value={spriteConfig.frameCounts[act]}
                            onChange={(e) =>
                              onSpriteConfigChange({
                                ...spriteConfig,
                                frameCounts: {
                                  ...spriteConfig.frameCounts,
                                  [act]: clampNum(e.target.value, 1, 8, 4),
                                },
                              })
                            }
                            className="w-12 px-1.5 py-0.5 text-center font-mono tabular-nums bg-slate-950 border border-slate-700 rounded text-slate-100 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Style & Seed */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Proportions ({Math.round(spriteConfig.proportionScale * 100)}%)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onSpriteConfigChange({
                      ...spriteConfig,
                      seed: Math.floor(Math.random() * 9999) + 1,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Seed #{spriteConfig.seed}</span>
                </button>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.2}
                step={0.05}
                value={spriteConfig.proportionScale}
                onChange={(e) =>
                  onSpriteConfigChange({
                    ...spriteConfig,
                    proportionScale: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spriteConfig.outline}
                    onChange={(e) =>
                      onSpriteConfigChange({
                        ...spriteConfig,
                        outline: e.target.checked,
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>1px Outline</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spriteConfig.shadowDot}
                    onChange={(e) =>
                      onSpriteConfigChange({
                        ...spriteConfig,
                        shadowDot: e.target.checked,
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Ground Shadow</span>
                </label>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Retro Monochrome & Game Boy Palettes */}
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Retro Palette</span>
            </h2>
            <button
              type="button"
              onClick={() => downloadGplPalette(palette)}
              className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              Export .gpl
            </button>
          </div>

          <select
            aria-label="Retro palette preset"
            value={palette.id}
            onChange={(e) => {
              const found = RETRO_PALETTES.find((p) => p.id === e.target.value);
              if (found) onPaletteChange(found);
            }}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            {RETRO_PALETTES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {palette.id === 'custom' && (
              <option value="custom">Custom Mono</option>
            )}
          </select>

          <div className="grid grid-cols-4 gap-2">
            {palette.shades.map((hex, idx) => (
              <label
                key={idx}
                className="flex flex-col items-center gap-1 cursor-pointer group"
              >
                <div className="relative w-full h-7 rounded border border-slate-700 overflow-hidden group-hover:border-slate-500">
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: hex }}
                  />
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) =>
                      updateShade(idx as 0 | 1 | 2 | 3, e.target.value)
                    }
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    aria-label={`${SHADE_NAMES[idx]} color`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 truncate max-w-full">
                  {SHADE_NAMES[idx]}
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
