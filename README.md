# IsoPixel Forge — Procedural Isometric Tilemap & 8-Direction Spritesheet Studio

A client-side procedural pixel-art asset studio that generates crisp, transparent-background PNG tilemaps and 8-direction animated character/monster spritesheets at exact user-defined pixel dimensions, tailored for immediate import into GameMaker, Godot, and AGK Studio and easy further editing in external pixel-art software.

## User Review & Critical Decisions

> [!IMPORTANT]
> All Phase 1 architectural and creative choices have been confirmed and lock in the studio's core behavior:
> - **Pure Procedural Pixel Engine**: 100% deterministic, zero-AI client-side pixel rasterizer using integer-coordinate Bresenham/scanline rendering so every pixel stays sharp and editable without anti-aliasing blur.
> - **HD Isometric Default (`128x64` px)**: Launches configured for `128x64` px isometric tile diamonds (with unlocked custom width, diamond height, and block cell height inputs, plus `64x32`, `32x16`, and `64x64` presets).
> - **8-Direction Full Action Spritesheets**: Generates all 8 isometric facings (`S`, `SW`, `W`, `NW`, `N`, `NE`, `E`, `SE`) across `Idle`, `Walk`, `Attack`, and `Hurt` animations for both hero characters and monsters.
> - **Retro Monochrome & Game Boy Starter Themes**: Preloaded with authentic 4-shade palettes (DMG-01 Olive, Pocket Grayscale, 1-Bit Ink & Paper, Amber CRT, Slate Mono) and editable color ramps.

---

## 1. Overview & Core Concept

- **What It Does**: Provides an instant, non-destructive pixel workstation where game developers configure exact tile and sprite pixel dimensions, choose basic character/monster archetypes or terrain block sets, preview animations and tile snapping live, and export transparent PNG sheets alongside engine-specific import manifests.
- **Target Audience**: Solo indie developers and programmers using GameMaker, Godot, or AGK Studio who are not pixel artists and need clean, low-detail structural "starter" assets they can drop straight into their game engine or refine in Aseprite/LibreSprite.
- **Key Value**: Eliminates isometric projection math errors, blurry downscaled edges, and misaligned spritesheet grids by rasterizing directly at target pixel resolutions with transparent alpha channels and exact origin metadata.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Workspace Mode Switching**: Users toggle cleanly between three focused studio views via the primary workspace bar:
   - **Tilemap Atlas**: Configure tile width (`128px` default), diamond height (`64px` default), total cell height (to accommodate extruded walls/blocks without clipping), pixel chunk scale (`1px`, `2px`, `4px`), and tile set selection (Ground, Grass/Dithered Top, Stone Path, Water Basin, Raised Block, Half Slab, 4-way Ramps, Pillar, Crate, Archway, Corner, Cursor Diamond).
   - **8-Dir Spritesheet**: Select entity category (**Character**: Adventurer, Knight, Mage, Ranger, Worker; **Monster**: Slime, Skeleton, Imp, Golem, Wisp), set exact sprite cell `Width x Height` (default `128x128` or `64x64`), adjust silhouette proportions, seed, outline toggle, and preview either the full 8-direction × action spritesheet grid or an interactive single-frame turntable player.
   - **Isometric Grid Testbed**: Paint and test the generated tiles and move/animate the generated 8-direction character/monster on a live `128x64` (or custom) isometric diamond stage to verify proportions, Y-sorting, and anchor alignment before exporting.
2. **Retro Palette Customization**: Switch between curated 4-shade Retro Monochrome & Game Boy palettes (`DMG-01 Olive`, `Pocket Gray`, `1-Bit Ink`, `Amber Phosphor`, `Cool Slate`) or click any of the 4 shade swatches (Highlight, Midtone, Shadow, Outline/Deep) to recolor the entire sheet live.
3. **Engine-Ready Export**:
   - Click **Export PNG** to download a true `RGBA` transparent-background PNG at exact pixel dimensions (`0` alpha outside pixels, no checkerboard baked in).
   - Inspect or copy/download the **Engine Import Guide & Manifest** tailored to **GameMaker**, **Godot 4**, or **AGK Studio** (including anchor/origin coordinates, cell counts, and `subimages.txt` / JSON atlas metadata, plus `.gpl` palette download for external pixel editors).

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian dark-slate developer workstation inspired by hardware pixel editors and handheld devkits — restrained, crisp hairline borders, zero visual fluff.
- **Color Palette & Mood**:
  - *Canvas & Surfaces (90% neutral)*: Deep charcoal-slate background (`#0F172A`), structural panel surfaces (`#1E293B`) with subtle 1px hairline borders (`#334155`), high-legibility cool light text (`#F8FAFC` / `#94A3B8`).
  - *Accent (10% budget)*: Crisp Game Boy Phosphor/Teal-Green (`#22C55E` / `#16A34A`) reserved strictly for primary export actions, active segmented tabs, and focus rings; semantic amber (`#D97706`) strictly for dimension/clipping warnings (e.g., if block height exceeds cell height).
  - *Transparency Viewport*: Toggleable dark/light pixel checkerboard backdrop strictly inside the asset canvas preview so transparent edges are unmistakable.
- **Typography & Hierarchy**:
  - *Display / Headings*: `Plus Jakarta Sans` (SemiBold 600, `text-wrap: balance`).
  - *Body / Controls*: `DM Sans` (13px–14px compact studio controls).
  - *Numeric Telemetry & Specs*: `JetBrains Mono` with `tabular-nums` on every width, height, frame index, FPS, and origin coordinate input.
- **Component Styling & Layout**:
  - **Top Bar Contract**: Single-row header with wordmark on the left (`IsoPixel Forge`), 3 clean mode links in the center (`Tilemap Atlas`, `Spritesheet Studio`, `Grid Testbed`), and 1 primary CTA on the right (`Export PNG`).
  - **Studio Split Layout**: Left configuration rail (`280px` fixed width) with clean hairline-separated parameter groups; dominant central pixel viewport with zoom controls (`100%`–`800%`), pan/reset, checkerboard toggle, and isometric guide overlay toggle; compact right/bottom Engine Spec drawer for GameMaker/Godot/AGK Studio import values.
  - **Zero-Pill & Anti-Slop Discipline**: No pill badges on metadata (use clean `128×64 px · 8 Dir · 14 Frames` inline tabular text), no nested cards inside cards, no thick left borders, and no decorative status dots.

### Interactive Feedback & Motion

- **Instant Canvas Synthesis**: Adjusting any width, height, palette color, or proportion slider re-rasterizes the offscreen integer pixel buffer in `< 16ms` with zero loading spinners.
- **Turntable Scrubbing**: Play/pause toggle, FPS selector (`4–16 FPS`), 8-way compass selector, and individual action row filter (`Idle`, `Walk`, `Attack`, `Hurt`) settle within `150ms` transitions.
- **Clipping Guardrail**: Inline validation banner warns cleanly if user-entered sprite or tile dimensions are too small (`< 16px`) or if tile extrusion height exceeds total cell height, offering a one-click auto-fit adjustment.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Integer Scanline & Volumetric Pixel Rasterizer over Vector/Anti-Aliased Canvas Drawing**
  - *Chosen Approach*: Draw all isometric diamonds, extruded blocks, and 8-direction articulated pixel silhouettes onto an integer pixel grid (`Uint8ClampedArray` / `ImageData`) using deterministic Bresenham lines, integer polygon fills, and pixel-level Bayer/checker dithering.
  - *Why*: Standard HTML5 `ctx.lineTo` / `ctx.fill` applies sub-pixel anti-aliasing, producing semi-transparent fringe pixels that corrupt palette swaps and frustrate manual editing in pixel-art editors. Integer rasterization guarantees 100% crisp, palette-indexed pixels (`alpha = 0` or `alpha = 255`) ready for Aseprite, GameMaker, or Godot.
  - *Alternatives Considered*: SVG-to-Canvas rasterization (rejected due to anti-aliased edges and blurred low-res scaling).

- **Decision 2: Parametric 3D-to-Isometric Rig for 8-Direction Character & Monster Sprites**
  - *Chosen Approach*: Define each character/monster archetype as a simple articulated voxel/ellipsoid rig (head, torso, left/right limbs, equipment/monster appendage) projected mathematically along the 8 isometric yaw angles (`0°` to `315°` in `45°` increments) with keyframed pose offsets for `Idle`, `Walk`, `Attack`, and `Hurt`.
  - *Why*: Drawing 8 directions × 14 animation frames (`112` unique sprites per sheet) manually as static bitmaps would restrict custom `Width x Height` scaling and break directional consistency. A parametric rig scales cleanly to any sprite cell size (`32x32`, `64x64`, `128x128`, or arbitrary rectangles) while keeping silhouettes deliberately simple and readable for later hand-editing.
  - *Alternatives Considered*: Fixed pre-authored 16x16 bitmap templates (rejected because non-uniform or HD sizes like `128x64` and `96x128` would distort or look overly blocky).

- **Decision 3: Multi-Engine Import Spec Generator (GameMaker, Godot, AGK Studio)**
  - *Chosen Approach*: Dynamically compute exact cell bounds, grid counts, bottom-center isometric pivot offsets, and downloadable manifests (`.json` atlas metadata + AGK `subimages.txt` + `.gpl` palette) synchronized with the current PNG export.
  - *Why*: Directly solves the hardest friction point when moving assets into GameMaker, Godot, or AGK Studio—knowing exact frame dimensions, strip rows, and origin coordinates for isometric Y-sorting.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Top Bar & Studio Shell                          │
│  [IsoPixel Forge]   [Tilemap | Spritesheet | Testbed]   [Export PNG CTA] │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────────┐ ┌───────────────────┐ ┌──────────────────────────────┐
│  Config Sidebar   │ │  Pixel Viewport   │ │   Engine Spec & Export Panel │
│ ───────────────── │ │ ───────────────── │ │ ──────────────────────────── │
│ • Grid Dimensions │ │ • Nearest-Neighbor│ │ • GameMaker Origin & Grid    │
│ • Tile / Archetype│ │   Zoom & Pan      │ │ • Godot TileSet / Anim Props │
│ • 8-Dir & Actions │ │ • Alpha Checker / │ │ • AGK Studio subimages.txt   │
│ • Retro Palettes  │ │   Iso Guide Lines │ │ • PNG / JSON / GPL Downloads │
│   & Swatch Editor │ │ • Live Turntable  │ │                              │
└─────────┬─────────┘ └─────────▲─────────┘ └──────────────▲───────────────┘
          │                     │                          │
          ▼                     │                          │
┌───────────────────────────────┴──────────────────────────┴───────────────┐
│                   Pure Procedural Pixel Rasterizer Engine                │
│ ──────────────────────────────────────────────────────────────────────── │
│  • PixelBuffer (Int32 / RGBA ImageData, strict binary alpha, 0 AA blur)  │
│  • IsoTileRasterizer (128x64 default & custom WxH diamonds, ramps, props)│
│  • Rig8DirRasterizer (8-angle isometric rig -> Idle/Walk/Attack/Hurt)    │
│  • SheetPacker & ManifestBuilder (PNG Blob, AGK subimages.txt, JSON, GPL)│
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **StudioConfig**:
  - `activeMode`: `'tilemap' | 'spritesheet' | 'testbed'`
  - `palette`: `{ id, name, shades: [string, string, string, string] }` (Highlight, Midtone, Shadow, Deep/Outline)
- **TilemapConfig**:
  - `tileWidth`: number (default `128`, min `16`, max `512`)
  - `tileHeight`: number (default `64`, min `8`, max `256`)
  - `cellHeight`: number (default `128`, accommodates vertical extrusion above the diamond base)
  - `blockElevation`: number (default `32`, height of raised blocks/walls)
  - `pixelScale`: `1 | 2 | 4` (logical pixel density for easier editing)
  - `columns`: number (default `4`)
  - `padding`: number (default `0`, optional `1px–8px` spacing between cells)
  - `showOutlines`: boolean, `ditherShading`: boolean
  - `selectedTiles`: array of tile primitive IDs (`ground`, `grass`, `water`, `stonePath`, `raisedBlock`, `halfSlab`, `rampN`, `rampE`, `rampS`, `rampW`, `pillar`, `crate`, `arch`, `cursor`)
- **SpriteConfig**:
  - `category`: `'character' | 'monster'`
  - `archetype`: `'adventurer' | 'knight' | 'mage' | 'ranger' | 'worker' | 'slime' | 'skeleton' | 'imp' | 'golem' | 'wisp'`
  - `frameWidth`: number (default `96`), `frameHeight`: number (default `96`)
  - `pixelScale`: `1 | 2 | 4`
  - `directions`: 8 isometric directions (`S`, `SW`, `W`, `NW`, `N`, `NE`, `E`, `SE`)
  - `actions`: `{ idle: 2, walk: 4, attack: 4, hurt: 2 }` (toggleable per action)
  - `outline`: boolean, `shadowDot`: boolean, `seed`: number
- **EngineTarget**: `'gamemaker' | 'godot' | 'agk'` (persisted in local state, drives live import guide and manifest generation).

### Interactive Component & State Mapping

- **Dimension & Ratio Controls**: Numeric inputs + quick preset buttons (`128×64 HD`, `64×32 Classic`, `32×16 Retro`, `64×64 1:1`) update `TilemapConfig` or `SpriteConfig`, triggering deterministic re-rasterization of offscreen `ImageData` and recomputing cell origin coordinates and atlas dimensions immediately.
- **Palette Switcher & Swatch Editor**: Selecting a retro theme (`DMG-01 Olive`, `Game Boy Pocket`, `1-Bit Ink`, `Amber CRT`, `Slate Mono`) or editing any of the 4 hex swatches updates `palette.shades`, re-indexing all pixel buffers cleanly without altering geometry.
- **Spritesheet Preview & Turntable**: Clicking any direction on the 8-way compass or any action tab (`Idle`, `Walk`, `Attack`, `Hurt`) switches the live animated preview while keeping the full sheet toggleable; hovering or clicking a cell in the atlas highlights its exact `(x, y, w, h)` frame bounds and `subimages.txt` entry.
- **Grid Testbed**: Allows clicking cells on an interactive isometric diamond grid to stamp generated tiles from the current atlas and moving/triggering `Idle`/`Walk`/`Attack`/`Hurt` on the generated 8-direction character/monster with WASD/Arrow keys or on-screen directional controls.
- **Export Pipeline**:
  - `Export PNG`: Uses `canvas.toBlob('image/png')` on the raw unscaled, transparent-background offscreen canvas so downloaded PNGs match exact `atlasWidth × atlasHeight` pixels with zero background fill.
  - `Export Manifest / Palette`: Generates engine-ready `subimages.txt` (AGK Studio), `.json` tile/sprite manifest (Godot / GameMaker), and `.gpl` palette file via client-side Blob downloads.
