import {
  AtlasFrameSpec,
  GeneratedAtlas,
  ISO_DIRECTIONS,
  IsoDirection,
  PaletteTheme,
  SPRITE_ACTION_LABELS,
  SpriteAction,
  SpriteArchetype,
  SpriteConfig,
} from '../types/studio';
import {
  IndexedPixelBuffer,
  RGBColor,
  ShadeIndex,
  createCanvasFromRgba,
  hexToRgb,
} from './pixelBuffer';

interface Vec3 {
  x: number; // right
  y: number; // forward
  z: number; // up
}

interface RigPrimitive {
  kind: 'sphere' | 'capsule' | 'hatCone' | 'eyes' | 'wings';
  pos: Vec3;
  pos2?: Vec3;
  rx: number;
  ry: number;
  rz: number;
  baseShade: ShadeIndex;
  highlightShade?: ShadeIndex;
  shadowShade?: ShadeIndex;
  alwaysTop?: boolean;
}

const DIRECTION_VECTORS: Record<IsoDirection, { fx: number; fy: number }> = {
  S: { fx: 0, fy: 1 },
  SW: { fx: -0.7071, fy: 0.7071 },
  W: { fx: -1, fy: 0 },
  NW: { fx: -0.7071, fy: -0.7071 },
  N: { fx: 0, fy: -1 },
  NE: { fx: 0.7071, fy: -0.7071 },
  E: { fx: 1, fy: 0 },
  SE: { fx: 0.7071, fy: 0.7071 },
};

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

interface PoseState {
  bodyZ: number;
  bodyTiltY: number;
  squashX: number;
  squashZ: number;
  leftLegY: number;
  leftLegZ: number;
  rightLegY: number;
  rightLegZ: number;
  leftArmY: number;
  leftArmZ: number;
  rightArmY: number;
  rightArmZ: number;
  weaponExtend: number;
  weaponLift: number;
  hurtFlash: boolean;
}

function computePoseState(
  action: SpriteAction,
  frameIdx: number,
  totalFrames: number,
): PoseState {
  const phase = totalFrames > 1 ? frameIdx / totalFrames : 0;
  const angle = phase * Math.PI * 2;

  const base: PoseState = {
    bodyZ: 0,
    bodyTiltY: 0,
    squashX: 1,
    squashZ: 1,
    leftLegY: 0,
    leftLegZ: 0,
    rightLegY: 0,
    rightLegZ: 0,
    leftArmY: 0,
    leftArmZ: 0,
    rightArmY: 0,
    rightArmZ: 0,
    weaponExtend: 0,
    weaponLift: 0,
    hurtFlash: false,
  };

  if (action === 'idle') {
    const bob = Math.sin(angle) * 0.5 + 0.5;
    base.bodyZ = bob * 0.08;
    base.squashX = 1 + (1 - bob) * 0.06;
    base.squashZ = 1 - (1 - bob) * 0.05;
    base.rightArmZ = bob * 0.06;
    base.leftArmZ = bob * 0.04;
  } else if (action === 'walk') {
    const stride = Math.sin(angle);
    const liftL = Math.max(0, Math.cos(angle));
    const liftR = Math.max(0, -Math.cos(angle));
    base.bodyZ = Math.abs(stride) * 0.1;
    base.bodyTiltY = 0.08;
    base.leftLegY = stride * 0.28;
    base.leftLegZ = liftL * 0.16;
    base.rightLegY = -stride * 0.28;
    base.rightLegZ = liftR * 0.16;
    base.leftArmY = -stride * 0.24;
    base.rightArmY = stride * 0.24;
  } else if (action === 'attack') {
    // 0: windup, 0.25..0.5: lunge & strike, 0.75: recover
    if (phase < 0.28) {
      base.bodyTiltY = -0.15;
      base.rightArmY = -0.22;
      base.rightArmZ = 0.22;
      base.weaponLift = 0.35;
      base.weaponExtend = -0.1;
    } else if (phase < 0.65) {
      base.bodyTiltY = 0.28;
      base.bodyZ = -0.05;
      base.rightArmY = 0.38;
      base.rightArmZ = -0.05;
      base.leftArmY = -0.18;
      base.weaponExtend = 0.45;
      base.weaponLift = -0.08;
      base.rightLegY = 0.2;
      base.leftLegY = -0.15;
    } else {
      base.bodyTiltY = 0.08;
      base.rightArmY = 0.12;
      base.weaponExtend = 0.12;
    }
  } else if (action === 'hurt') {
    const recoil = frameIdx % 2 === 0 ? 1 : 0.45;
    base.bodyTiltY = -0.26 * recoil;
    base.bodyZ = 0.06 * recoil;
    base.leftArmY = -0.18 * recoil;
    base.leftArmZ = 0.24 * recoil;
    base.rightArmY = -0.18 * recoil;
    base.rightArmZ = 0.24 * recoil;
    base.hurtFlash = frameIdx % 2 === 0;
  }

  return base;
}

function buildArchetypeRig(
  archetype: SpriteArchetype,
  pose: PoseState,
  seed: number,
): RigPrimitive[] {
  const prims: RigPrimitive[] = [];
  const variation = seededNoise(seed) * 0.08;
  const bz = pose.bodyZ;
  const ty = pose.bodyTiltY;

  if (archetype === 'slime') {
    const sx = pose.squashX;
    const sz = pose.squashZ;
    // Main jelly dome
    prims.push({
      kind: 'sphere',
      pos: { x: 0, y: ty * 0.6, z: 0.42 * sz + bz },
      rx: 0.48 * sx,
      ry: 0.44 * sx,
      rz: 0.4 * sz,
      baseShade: pose.hurtFlash ? 0 : 1,
      highlightShade: 0,
      shadowShade: 2,
    });
    // Specular core / inner nucleus
    prims.push({
      kind: 'sphere',
      pos: { x: -0.08, y: ty * 0.6 + 0.05, z: 0.46 * sz + bz },
      rx: 0.16,
      ry: 0.16,
      rz: 0.14,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 0,
    });
    prims.push({
      kind: 'eyes',
      pos: { x: 0, y: ty * 0.6 + 0.36 * sx, z: 0.4 * sz + bz },
      rx: 0.16,
      ry: 0.05,
      rz: 0.06,
      baseShade: 3,
      alwaysTop: true,
    });
    return prims;
  }

  if (archetype === 'wisp') {
    const hover = 0.38 + bz + Math.sin(pose.rightArmY * 4) * 0.05;
    // Trailing spirit tail
    prims.push({
      kind: 'capsule',
      pos: { x: 0, y: -0.06, z: hover - 0.05 },
      pos2: { x: 0, y: ty * -0.4 - 0.12, z: 0.14 },
      rx: 0.16,
      ry: 0.16,
      rz: 0.16,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
    // Floating head/orb
    prims.push({
      kind: 'sphere',
      pos: { x: 0, y: ty * 0.5, z: hover + 0.34 },
      rx: 0.3 * pose.squashX,
      ry: 0.3 * pose.squashX,
      rz: 0.32 * pose.squashZ,
      baseShade: pose.hurtFlash ? 0 : 1,
      highlightShade: 0,
      shadowShade: 2,
    });
    // Orbiting twin sparks
    prims.push({
      kind: 'sphere',
      pos: { x: 0.38, y: pose.rightArmY + 0.1, z: hover + 0.25 + pose.rightArmZ },
      rx: 0.09,
      ry: 0.09,
      rz: 0.09,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 1,
    });
    prims.push({
      kind: 'sphere',
      pos: { x: -0.38, y: pose.leftArmY - 0.1, z: hover + 0.25 + pose.leftArmZ },
      rx: 0.09,
      ry: 0.09,
      rz: 0.09,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 1,
    });
    prims.push({
      kind: 'eyes',
      pos: { x: 0, y: ty * 0.5 + 0.26, z: hover + 0.34 },
      rx: 0.12,
      ry: 0.05,
      rz: 0.05,
      baseShade: 3,
      alwaysTop: true,
    });
    return prims;
  }

  // Humanoid / Biped base proportions
  const isGolem = archetype === 'golem';
  const isImp = archetype === 'imp';
  const isSkeleton = archetype === 'skeleton';

  const bodyWidth = isGolem ? 0.38 : isImp ? 0.22 : 0.26 + variation;
  const headSize = isGolem ? 0.23 : isImp ? 0.25 : 0.26;
  const legH = isGolem ? 0.34 : isImp ? 0.26 : 0.34;
  const torsoH = isGolem ? 0.46 : isImp ? 0.32 : 0.4;
  const hipZ = legH + bz;
  const shoulderZ = hipZ + torsoH * 0.85;
  const headZ = hipZ + torsoH + headSize * 0.72;

  // Feet & Legs
  const legSpread = isGolem ? 0.18 : 0.12;
  const legThick = isGolem ? 0.13 : isSkeleton ? 0.07 : 0.095;
  prims.push({
    kind: 'capsule',
    pos: { x: -legSpread, y: pose.leftLegY * 0.5, z: hipZ },
    pos2: { x: -legSpread, y: pose.leftLegY, z: 0.08 + pose.leftLegZ },
    rx: legThick,
    ry: legThick,
    rz: legThick,
    baseShade: isSkeleton ? 0 : 2,
    highlightShade: isSkeleton ? 0 : 1,
    shadowShade: 3,
  });
  prims.push({
    kind: 'capsule',
    pos: { x: legSpread, y: pose.rightLegY * 0.5, z: hipZ },
    pos2: { x: legSpread, y: pose.rightLegY, z: 0.08 + pose.rightLegZ },
    rx: legThick,
    ry: legThick,
    rz: legThick,
    baseShade: isSkeleton ? 0 : 2,
    highlightShade: isSkeleton ? 0 : 1,
    shadowShade: 3,
  });

  // Robe skirt for Mage
  if (archetype === 'mage') {
    prims.push({
      kind: 'hatCone',
      pos: { x: 0, y: ty * 0.3, z: hipZ + 0.28 },
      pos2: { x: 0, y: 0, z: 0.06 },
      rx: 0.28,
      ry: 0.26,
      rz: 0.28,
      baseShade: pose.hurtFlash ? 0 : 2,
      highlightShade: 1,
      shadowShade: 3,
    });
  }

  // Torso
  prims.push({
    kind: 'sphere',
    pos: { x: 0, y: ty * 0.5, z: hipZ + torsoH * 0.5 },
    rx: bodyWidth,
    ry: bodyWidth * 0.78,
    rz: torsoH * 0.62,
    baseShade: pose.hurtFlash ? 0 : isSkeleton ? 0 : archetype === 'knight' ? 1 : 1,
    highlightShade: 0,
    shadowShade: 2,
  });

  // Cape / Backpack / Wings
  if (archetype === 'ranger' || archetype === 'adventurer') {
    prims.push({
      kind: 'capsule',
      pos: { x: 0, y: -bodyWidth * 0.72 + ty * 0.2, z: shoulderZ - 0.04 },
      pos2: { x: 0, y: -bodyWidth * 0.9 - ty * 0.2, z: hipZ - 0.05 },
      rx: bodyWidth * 0.72,
      ry: 0.07,
      rz: 0.08,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
  } else if (isImp) {
    prims.push({
      kind: 'wings',
      pos: { x: 0, y: -0.16, z: shoulderZ - 0.02 },
      rx: 0.38,
      ry: 0.12,
      rz: 0.22,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
  }

  // Arms
  const armSpread = bodyWidth + (isGolem ? 0.09 : 0.06);
  const armThick = isGolem ? 0.13 : isSkeleton ? 0.065 : 0.08;
  prims.push({
    kind: 'capsule',
    pos: { x: -armSpread, y: ty * 0.5, z: shoulderZ },
    pos2: {
      x: -armSpread - 0.04,
      y: ty * 0.6 + pose.leftArmY,
      z: shoulderZ - 0.26 + pose.leftArmZ,
    },
    rx: armThick,
    ry: armThick,
    rz: armThick,
    baseShade: isSkeleton ? 0 : 1,
    highlightShade: 0,
    shadowShade: 2,
  });

  const rightHand: Vec3 = {
    x: armSpread + 0.04,
    y: ty * 0.6 + pose.rightArmY + 0.08,
    z: shoulderZ - 0.24 + pose.rightArmZ,
  };
  prims.push({
    kind: 'capsule',
    pos: { x: armSpread, y: ty * 0.5, z: shoulderZ },
    pos2: rightHand,
    rx: armThick,
    ry: armThick,
    rz: armThick,
    baseShade: isSkeleton ? 0 : 1,
    highlightShade: 0,
    shadowShade: 2,
  });

  // Equipment / Weapons
  if (archetype === 'adventurer' || archetype === 'knight' || archetype === 'skeleton') {
    // Sword / Blade
    prims.push({
      kind: 'capsule',
      pos: rightHand,
      pos2: {
        x: rightHand.x + 0.02,
        y: rightHand.y + 0.36 + pose.weaponExtend,
        z: rightHand.z + 0.22 + pose.weaponLift,
      },
      rx: 0.055,
      ry: 0.055,
      rz: 0.055,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 1,
    });
  }

  if (archetype === 'knight') {
    // Shield on left arm
    prims.push({
      kind: 'sphere',
      pos: {
        x: -armSpread - 0.08,
        y: ty * 0.7 + pose.leftArmY + 0.12,
        z: shoulderZ - 0.16 + pose.leftArmZ,
      },
      rx: 0.08,
      ry: 0.18,
      rz: 0.22,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 2,
    });
  }

  if (archetype === 'mage') {
    const staffTop: Vec3 = {
      x: rightHand.x + 0.04,
      y: rightHand.y + 0.14 + pose.weaponExtend * 0.7,
      z: rightHand.z + 0.48 + pose.weaponLift * 0.4,
    };
    prims.push({
      kind: 'capsule',
      pos: { x: rightHand.x, y: rightHand.y, z: 0.06 },
      pos2: staffTop,
      rx: 0.045,
      ry: 0.045,
      rz: 0.045,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
    prims.push({
      kind: 'sphere',
      pos: staffTop,
      rx: 0.095,
      ry: 0.095,
      rz: 0.095,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 0,
    });
  }

  if (archetype === 'ranger') {
    // Bow on left hand
    const lhY = ty * 0.6 + pose.leftArmY + 0.16;
    const lhZ = shoulderZ - 0.16 + pose.leftArmZ;
    prims.push({
      kind: 'capsule',
      pos: { x: -armSpread - 0.05, y: lhY + 0.04, z: lhZ + 0.26 },
      pos2: { x: -armSpread - 0.05, y: lhY + 0.04, z: lhZ - 0.24 },
      rx: 0.045,
      ry: 0.045,
      rz: 0.045,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
  }

  if (archetype === 'worker' || archetype === 'imp') {
    const tip: Vec3 = {
      x: rightHand.x,
      y: rightHand.y + 0.28 + pose.weaponExtend,
      z: rightHand.z + 0.28 + pose.weaponLift,
    };
    prims.push({
      kind: 'capsule',
      pos: rightHand,
      pos2: tip,
      rx: 0.045,
      ry: 0.045,
      rz: 0.045,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
    prims.push({
      kind: 'sphere',
      pos: tip,
      rx: 0.12,
      ry: 0.14,
      rz: 0.1,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 2,
    });
  }

  // Head
  prims.push({
    kind: 'sphere',
    pos: { x: 0, y: ty * 0.7, z: headZ },
    rx: headSize,
    ry: headSize * 0.92,
    rz: headSize * 0.94,
    baseShade: pose.hurtFlash ? 0 : isSkeleton ? 0 : isGolem ? 2 : 0,
    highlightShade: 0,
    shadowShade: isGolem ? 3 : 1,
  });

  // Headgear / Horns / Hat
  if (archetype === 'mage') {
    // Wide brim + cone hat
    prims.push({
      kind: 'sphere',
      pos: { x: 0, y: ty * 0.7, z: headZ + headSize * 0.55 },
      rx: headSize * 1.45,
      ry: headSize * 1.45,
      rz: 0.07,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
    prims.push({
      kind: 'hatCone',
      pos: { x: 0, y: ty * 0.7 - 0.04, z: headZ + headSize * 1.65 },
      pos2: { x: 0, y: ty * 0.7, z: headZ + headSize * 0.55 },
      rx: headSize * 0.9,
      ry: headSize * 0.9,
      rz: headSize * 0.9,
      baseShade: 2,
      highlightShade: 1,
      shadowShade: 3,
    });
  } else if (archetype === 'knight' || archetype === 'worker') {
    // Helmet dome crest
    prims.push({
      kind: 'sphere',
      pos: { x: 0, y: ty * 0.7, z: headZ + headSize * 0.35 },
      rx: headSize * 1.05,
      ry: headSize * 1.02,
      rz: headSize * 0.65,
      baseShade: 1,
      highlightShade: 0,
      shadowShade: 2,
    });
  } else if (isImp) {
    // Horns
    prims.push({
      kind: 'capsule',
      pos: { x: -headSize * 0.65, y: ty * 0.7, z: headZ + headSize * 0.5 },
      pos2: { x: -headSize * 1.1, y: ty * 0.7 - 0.08, z: headZ + headSize * 1.2 },
      rx: 0.055,
      ry: 0.055,
      rz: 0.055,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 2,
    });
    prims.push({
      kind: 'capsule',
      pos: { x: headSize * 0.65, y: ty * 0.7, z: headZ + headSize * 0.5 },
      pos2: { x: headSize * 1.1, y: ty * 0.7 - 0.08, z: headZ + headSize * 1.2 },
      rx: 0.055,
      ry: 0.055,
      rz: 0.055,
      baseShade: 0,
      highlightShade: 0,
      shadowShade: 2,
    });
  }

  // Eyes / Visor on front of head
  prims.push({
    kind: 'eyes',
    pos: { x: 0, y: ty * 0.7 + headSize * 0.85, z: headZ + 0.01 },
    rx: headSize * 0.44,
    ry: 0.05,
    rz: 0.05,
    baseShade: isGolem ? 0 : 3,
    alwaysTop: true,
  });

  return prims;
}

function projectPoint(
  p: Vec3,
  dir: IsoDirection,
  centerX: number,
  footY: number,
  unitScale: number,
): { sx: number; sy: number; depth: number } {
  const { fx, fy } = DIRECTION_VECTORS[dir];
  const rx = -fy;
  const ry = fx;

  const gx = p.x * rx + p.y * fx;
  const gy = p.x * ry + p.y * fy;

  const sx = centerX + gx * unitScale;
  const sy = footY + gy * unitScale * 0.52 - p.z * unitScale * 0.92;
  const depth = gy + p.z * 0.14;
  return { sx, sy, depth };
}

function renderSpriteFrame(
  config: SpriteConfig,
  dir: IsoDirection,
  action: SpriteAction,
  frameIdx: number,
  totalFrames: number,
): IndexedPixelBuffer {
  const scale = config.pixelScale;
  const lw = Math.max(12, Math.ceil(config.frameWidth / scale));
  const lh = Math.max(12, Math.ceil(config.frameHeight / scale));

  const buf = new IndexedPixelBuffer(lw, lh);
  const protectedMask = new Uint8Array(lw * lh);

  const unitScale = Math.min(lw, lh) * 0.44 * config.proportionScale;
  const centerX = lw / 2;
  const footY = lh * 0.82;

  // Optional ground shadow ellipse (marked protected so outline pass ignores it)
  if (config.shadowDot) {
    const shadowRx = Math.max(3, unitScale * 0.42);
    const shadowRy = Math.max(1.5, shadowRx * 0.5);
    buf.fillEllipse(centerX, footY + 1, shadowRx, shadowRy, (x, y) => {
      if ((x + y) % 2 === 0) {
        if (y >= 0 && y < lh && x >= 0 && x < lw) {
          protectedMask[y * lw + x] = 1;
        }
        return 2;
      }
      return -1;
    });
  }

  const pose = computePoseState(action, frameIdx, totalFrames);
  const prims = buildArchetypeRig(config.archetype, pose, config.seed);

  const projected = prims.map((prim) => {
    const p1 = projectPoint(prim.pos, dir, centerX, footY, unitScale);
    const p2 = prim.pos2
      ? projectPoint(prim.pos2, dir, centerX, footY, unitScale)
      : p1;
    const avgDepth = prim.alwaysTop ? p1.depth + 0.25 : (p1.depth + p2.depth) * 0.5;
    return { prim, p1, p2, depth: avgDepth };
  });

  projected.sort((a, b) => a.depth - b.depth);

  const { fy } = DIRECTION_VECTORS[dir];

  for (const item of projected) {
    const { prim, p1, p2 } = item;

    if (prim.kind === 'eyes') {
      // Only draw eyes when facing somewhat toward the camera (fy > -0.2)
      if (fy < -0.25) continue;
      const leftEye = projectPoint(
        { x: -prim.rx, y: prim.pos.y, z: prim.pos.z },
        dir,
        centerX,
        footY,
        unitScale,
      );
      const rightEye = projectPoint(
        { x: prim.rx, y: prim.pos.y, z: prim.pos.z },
        dir,
        centerX,
        footY,
        unitScale,
      );
      const eyeR = Math.max(0.8, unitScale * 0.055);
      buf.fillEllipse(leftEye.sx, leftEye.sy, eyeR, eyeR * 1.15, () => prim.baseShade);
      buf.fillEllipse(rightEye.sx, rightEye.sy, eyeR, eyeR * 1.15, () => prim.baseShade);
      continue;
    }

    if (prim.kind === 'wings') {
      const leftTip = projectPoint(
        { x: -prim.rx, y: prim.pos.y - 0.14, z: prim.pos.z + 0.14 },
        dir,
        centerX,
        footY,
        unitScale,
      );
      const rightTip = projectPoint(
        { x: prim.rx, y: prim.pos.y - 0.14, z: prim.pos.z + 0.14 },
        dir,
        centerX,
        footY,
        unitScale,
      );
      const rootLow = projectPoint(
        { x: 0, y: prim.pos.y, z: prim.pos.z - 0.12 },
        dir,
        centerX,
        footY,
        unitScale,
      );
      buf.fillPolygon(
        [
          [p1.sx, p1.sy],
          [leftTip.sx, leftTip.sy],
          [rootLow.sx, rootLow.sy],
        ],
        () => prim.baseShade,
      );
      buf.fillPolygon(
        [
          [p1.sx, p1.sy],
          [rightTip.sx, rightTip.sy],
          [rootLow.sx, rootLow.sy],
        ],
        () => prim.shadowShade ?? 2,
      );
      continue;
    }

    if (prim.kind === 'hatCone') {
      const top = p1;
      const base = p2;
      const halfW = Math.max(2, prim.rx * unitScale);
      buf.fillPolygon(
        [
          [top.sx, top.sy],
          [base.sx - halfW, base.sy],
          [base.sx + halfW, base.sy],
        ],
        (x) => (x < base.sx ? (prim.highlightShade ?? 1) : prim.baseShade),
      );
      continue;
    }

    if (prim.kind === 'capsule') {
      const rad = Math.max(1, prim.rx * unitScale);
      const dist = Math.hypot(p2.sx - p1.sx, p2.sy - p1.sy);
      const steps = Math.max(2, Math.ceil(dist * 1.5));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = p1.sx + (p2.sx - p1.sx) * t;
        const cy = p1.sy + (p2.sy - p1.sy) * t;
        buf.fillEllipse(cx, cy, rad, rad, (_x, _y, nx, ny) => {
          const light = nx * 0.55 + ny * 0.7;
          if (light < -0.25 && prim.highlightShade !== undefined) {
            return prim.highlightShade;
          }
          if (light > 0.35 && prim.shadowShade !== undefined) {
            return prim.shadowShade;
          }
          return prim.baseShade;
        });
      }
      continue;
    }

    // Sphere / Ellipsoid
    const rx = Math.max(1.5, Math.max(prim.rx, prim.ry) * unitScale);
    const ry = Math.max(1.5, prim.rz * unitScale);
    buf.fillEllipse(p1.sx, p1.sy, rx, ry, (_x, _y, nx, ny) => {
      const light = nx * 0.55 + ny * 0.72;
      if (light < -0.28 && prim.highlightShade !== undefined) {
        return prim.highlightShade;
      }
      if (light > 0.36 && prim.shadowShade !== undefined) {
        return prim.shadowShade;
      }
      return prim.baseShade;
    });
  }

  // Clear protected shadow pixels where character body overlaps
  for (let i = 0; i < buf.data.length; i++) {
    if (protectedMask[i] === 1 && buf.data[i] !== 2) {
      protectedMask[i] = 0;
    }
  }

  if (config.outline) {
    buf.applyOutline(3, protectedMask);
  }

  return buf;
}

export function generateSpritesheetAtlas(
  config: SpriteConfig,
  palette: PaletteTheme,
): GeneratedAtlas {
  const activeActions = (['idle', 'walk', 'attack', 'hurt'] as SpriteAction[]).filter(
    (act) => config.enabledActions[act],
  );
  const actionsToBuild: SpriteAction[] =
    activeActions.length > 0 ? activeActions : ['idle'];

  const cols = actionsToBuild.reduce(
    (acc, act) => acc + Math.max(1, config.frameCounts[act]),
    0,
  );
  const rows = ISO_DIRECTIONS.length; // Always all 8 directions (one row per direction)
  const pad = Math.max(0, config.padding);
  const cellW = Math.max(16, Math.round(config.frameWidth));
  const cellH = Math.max(16, Math.round(config.frameHeight));

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

  ISO_DIRECTIONS.forEach((dir, rowIdx) => {
    let colIdx = 0;
    for (const action of actionsToBuild) {
      const total = Math.max(1, config.frameCounts[action]);
      for (let f = 0; f < total; f++) {
        const destX = pad + colIdx * (cellW + pad);
        const destY = pad + rowIdx * (cellH + pad);

        const frameBuf = renderSpriteFrame(config, dir, action, f, total);
        frameBuf.blitToRgba(
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

        frames.push({
          id: `${config.archetype}_${dir}_${action}_${f}`,
          name: `${dir} · ${SPRITE_ACTION_LABELS[action]} #${f + 1}`,
          x: destX,
          y: destY,
          width: cellW,
          height: cellH,
          row: rowIdx,
          col: colIdx,
          direction: dir,
          action,
          frameIndex: f,
        });

        colIdx++;
      }
    }
  });

  const canvas = createCanvasFromRgba(rgba, atlasW, atlasH);
  // Bottom-center anchor at feet (82% down the sprite cell) for crisp isometric Y-sorting
  const originX = Math.round(cellW / 2);
  const originY = Math.round(cellH * 0.82);

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
