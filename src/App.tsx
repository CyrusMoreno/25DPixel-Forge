import { useMemo, useState } from 'react';
import { ConfigSidebar } from './components/ConfigSidebar';
import { EngineSpecPanel } from './components/EngineSpecPanel';
import { GridTestbed } from './components/GridTestbed';
import { PixelViewport } from './components/PixelViewport';
import { TopBar } from './components/TopBar';
import { downloadAtlasPng } from './engine/exportBuilder';
import { generateSpritesheetAtlas } from './engine/spriteRasterizer';
import { generateTilemapAtlas } from './engine/tileRasterizer';
import {
  ALL_TILE_DEFINITIONS,
  AtlasFrameSpec,
  EngineTarget,
  PaletteTheme,
  RETRO_PALETTES,
  SpriteConfig,
  StudioMode,
  TilemapConfig,
} from './types/studio';

export default function App() {
  const [activeMode, setActiveMode] = useState<StudioMode>('tilemap');
  const [engine, setEngine] = useState<EngineTarget>('godot');
  const [palette, setPalette] = useState<PaletteTheme>(RETRO_PALETTES[0]);

  const [tileConfig, setTileConfig] = useState<TilemapConfig>({
    tileWidth: 128,
    tileHeight: 64,
    cellHeight: 128,
    blockElevation: 32,
    pixelScale: 2,
    columns: 4,
    padding: 0,
    showOutlines: true,
    ditherShading: true,
    selectedTiles: ALL_TILE_DEFINITIONS.map((t) => t.id),
  });

  const [spriteConfig, setSpriteConfig] = useState<SpriteConfig>({
    category: 'character',
    archetype: 'adventurer',
    frameWidth: 96,
    frameHeight: 96,
    pixelScale: 2,
    padding: 0,
    outline: true,
    shadowDot: true,
    proportionScale: 1,
    seed: 101,
    enabledActions: {
      idle: true,
      walk: true,
      attack: true,
      hurt: true,
    },
    frameCounts: {
      idle: 2,
      walk: 4,
      attack: 4,
      hurt: 2,
    },
  });

  const [selectedTileFrame, setSelectedTileFrame] =
    useState<AtlasFrameSpec | null>(null);
  const [selectedSpriteFrame, setSelectedSpriteFrame] =
    useState<AtlasFrameSpec | null>(null);

  const tileAtlas = useMemo(
    () => generateTilemapAtlas(tileConfig, palette),
    [tileConfig, palette],
  );

  const spriteAtlas = useMemo(
    () => generateSpritesheetAtlas(spriteConfig, palette),
    [spriteConfig, palette],
  );

  const activeAtlas = activeMode === 'spritesheet' ? spriteAtlas : tileAtlas;
  const activeAssetPrefix =
    activeMode === 'spritesheet'
      ? `${spriteConfig.archetype}_8dir_${spriteConfig.frameWidth}x${spriteConfig.frameHeight}`
      : `iso_tilemap_${tileConfig.tileWidth}x${tileConfig.tileHeight}`;

  const handlePrimaryExport = () => {
    downloadAtlasPng(activeAtlas, `${activeAssetPrefix}.png`);
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden lg:overflow-hidden">
      <TopBar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        onExportPng={handlePrimaryExport}
        exportLabel={
          activeMode === 'spritesheet'
            ? 'Export Spritesheet PNG'
            : 'Export Tilemap PNG'
        }
      />

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <ConfigSidebar
          activeMode={activeMode}
          tileConfig={tileConfig}
          onTileConfigChange={(next) => {
            setTileConfig(next);
            setSelectedTileFrame(null);
          }}
          spriteConfig={spriteConfig}
          onSpriteConfigChange={(next) => {
            setSpriteConfig(next);
            setSelectedSpriteFrame(null);
          }}
          palette={palette}
          onPaletteChange={setPalette}
        />

        {activeMode === 'testbed' ? (
          <GridTestbed
            tileAtlas={tileAtlas}
            spriteAtlas={spriteAtlas}
            tileConfig={tileConfig}
          />
        ) : (
          <PixelViewport
            mode={activeMode}
            atlas={activeAtlas}
            tileDiamondHeight={
              activeMode === 'tilemap' ? tileConfig.tileHeight : undefined
            }
            selectedFrame={
              activeMode === 'spritesheet'
                ? selectedSpriteFrame
                : selectedTileFrame
            }
            onSelectFrame={
              activeMode === 'spritesheet'
                ? setSelectedSpriteFrame
                : setSelectedTileFrame
            }
          />
        )}

        <EngineSpecPanel
          engine={engine}
          onEngineChange={setEngine}
          mode={activeMode === 'testbed' ? 'tilemap' : activeMode}
          atlas={activeAtlas}
          tileConfig={tileConfig}
          palette={palette}
          assetPrefix={activeAssetPrefix}
        />
      </main>
    </div>
  );
}
