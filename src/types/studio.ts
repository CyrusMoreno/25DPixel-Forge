export type StudioMode = 'tilemap' | 'spritesheet' | 'testbed';

export type EngineTarget = 'godot' | 'gamemaker' | 'agk';

export type PixelScale = 1 | 2 | 4;

export interface PaletteTheme {
  id: string;
  name: string;
  /** [Highlight, Midtone, Shadow, Deep/Outline] */
  shades: [string, string, string, string];
}

export const RETRO_PALETTES: PaletteTheme[] = [
  {
    id: 'dmg-olive',
    name: 'DMG-01 Olive',
    shades: ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'],
  },
  {
    id: 'gb-pocket',
    name: 'Game Boy Pocket',
    shades: ['#c4cfa1', '#8b956d', '#4d533c', '#1f1f1f'],
  },
  {
    id: 'ink-paper',
    name: '1-Bit Ink & Paper',
    shades: ['#f8fafc', '#cbd5e1', '#475569', '#0f172a'],
  },
  {
    id: 'amber-crt',
    name: 'Amber Phosphor',
    shades: ['#fde68a', '#f59e0b', '#92400e', '#261103'],
  },
  {
    id: 'slate-mono',
    name: 'Cool Slate Mono',
    shades: ['#e2e8f0', '#94a3b8', '#475569', '#0f172a'],
  },
  {
    id: 'crimson-mono',
    name: 'Virtual Crimson',
    shades: ['#fecdd3', '#f43f5e', '#881337', '#24040e'],
  },
];

export type TileKind =
  | 'ground'
  | 'grass'
  | 'stonePath'
  | 'water'
  | 'raisedBlock'
  | 'halfSlab'
  | 'rampN'
  | 'rampE'
  | 'rampS'
  | 'rampW'
  | 'pillar'
  | 'crate'
  | 'arch'
  | 'cursor';

export interface TileDefinition {
  id: TileKind;
  label: string;
  shortLabel: string;
}

export const ALL_TILE_DEFINITIONS: TileDefinition[] = [
  { id: 'ground', label: 'Flat Ground', shortLabel: 'Ground' },
  { id: 'grass', label: 'Textured Turf', shortLabel: 'Turf' },
  { id: 'stonePath', label: 'Stone Paver', shortLabel: 'Path' },
  { id: 'water', label: 'Water Basin', shortLabel: 'Water' },
  { id: 'raisedBlock', label: 'Raised Block', shortLabel: 'Block' },
  { id: 'halfSlab', label: 'Half Step', shortLabel: 'Slab' },
  { id: 'rampN', label: 'Ramp North', shortLabel: 'Ramp N' },
  { id: 'rampE', label: 'Ramp East', shortLabel: 'Ramp E' },
  { id: 'rampS', label: 'Ramp South', shortLabel: 'Ramp S' },
  { id: 'rampW', label: 'Ramp West', shortLabel: 'Ramp W' },
  { id: 'pillar', label: 'Wall Pillar', shortLabel: 'Pillar' },
  { id: 'crate', label: 'Supply Crate', shortLabel: 'Crate' },
  { id: 'arch', label: 'Door Arch', shortLabel: 'Arch' },
  { id: 'cursor', label: 'Grid Cursor', shortLabel: 'Cursor' },
];

export interface TilemapConfig {
  tileWidth: number;
  tileHeight: number;
  cellHeight: number;
  blockElevation: number;
  pixelScale: PixelScale;
  columns: number;
  padding: number;
  showOutlines: boolean;
  ditherShading: boolean;
  selectedTiles: TileKind[];
}

export type IsoDirection = 'S' | 'SW' | 'W' | 'NW' | 'N' | 'NE' | 'E' | 'SE';

export const ISO_DIRECTIONS: IsoDirection[] = [
  'S',
  'SW',
  'W',
  'NW',
  'N',
  'NE',
  'E',
  'SE',
];

export type SpriteAction = 'idle' | 'walk' | 'attack' | 'hurt';

export const SPRITE_ACTION_LABELS: Record<SpriteAction, string> = {
  idle: 'Idle',
  walk: 'Walk',
  attack: 'Attack',
  hurt: 'Hurt',
};

export type EntityCategory = 'character' | 'monster';

export type CharacterArchetype =
  | 'adventurer'
  | 'knight'
  | 'mage'
  | 'ranger'
  | 'worker';

export type MonsterArchetype =
  | 'slime'
  | 'skeleton'
  | 'imp'
  | 'golem'
  | 'wisp';

export type SpriteArchetype = CharacterArchetype | MonsterArchetype;

export interface ArchetypeDefinition {
  id: SpriteArchetype;
  category: EntityCategory;
  label: string;
}

export const ALL_ARCHETYPES: ArchetypeDefinition[] = [
  { id: 'adventurer', category: 'character', label: 'Adventurer' },
  { id: 'knight', category: 'character', label: 'Knight' },
  { id: 'mage', category: 'character', label: 'Mage' },
  { id: 'ranger', category: 'character', label: 'Ranger' },
  { id: 'worker', category: 'character', label: 'Builder' },
  { id: 'slime', category: 'monster', label: 'Slime' },
  { id: 'skeleton', category: 'monster', label: 'Skeleton' },
  { id: 'imp', category: 'monster', label: 'Imp' },
  { id: 'golem', category: 'monster', label: 'Golem' },
  { id: 'wisp', category: 'monster', label: 'Wisp' },
];

export interface SpriteConfig {
  category: EntityCategory;
  archetype: SpriteArchetype;
  frameWidth: number;
  frameHeight: number;
  pixelScale: PixelScale;
  padding: number;
  outline: boolean;
  shadowDot: boolean;
  proportionScale: number; // 0.8 to 1.2
  seed: number;
  enabledActions: Record<SpriteAction, boolean>;
  frameCounts: Record<SpriteAction, number>;
}

export interface AtlasFrameSpec {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
  direction?: IsoDirection;
  action?: SpriteAction;
  frameIndex?: number;
}

export interface GeneratedAtlas {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  padding: number;
  frames: AtlasFrameSpec[];
  originX: number;
  originY: number;
}
