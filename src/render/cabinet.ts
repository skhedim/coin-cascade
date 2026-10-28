import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { reportAssetFailure, resolveAsset } from '../assets/manifest.ts';
import { chuteFrame, type MachineGeometry } from '../physics/geometry.ts';
import { backWallTrim, chevronTexture, deckTexture, PALETTE } from './textures.ts';

export interface CabinetParts {
  root: THREE.Group;
  pusher: THREE.Group;
  chute: THREE.Group;
  barriers: THREE.Mesh[];
  /** Matériaux émissifs animés (Fever, collecte…). */
  leds: { cyan: THREE.MeshBasicMaterial; magenta: THREE.MeshBasicMaterial; gold: THREE.MeshBasicMaterial };
  barrierMaterial: THREE.MeshStandardMaterial;
  /** Matériaux recolorés par les thèmes. */
  hull: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
}

/** Borne construite en géométrie procédurale, cotes issues de la physique. */
export function buildCabinet(g: MachineGeometry): CabinetParts {
  const root = new THREE.Group();
  root.name = 'cabinet';

  const hull = new THREE.MeshStandardMaterial({ color: PALETTE.hull, metalness: 0.55, roughness: 0.42 });
  const panel = new THREE.MeshStandardMaterial({ color: PALETTE.panel, metalness: 0.5, roughness: 0.38 });
  const gold = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.24 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dbe6f2', metalness: 1, roughness: 0.16 });
  const pit = new THREE.MeshStandardMaterial({ color: '#05070f', metalness: 0.2, roughness: 0.9 });
  const lowerDeckTex = deckTexture('#1a3150', '#8fb4d9');
  lowerDeckTex.repeat.set(2, 2);
  const lowerDeck = new THREE.MeshStandardMaterial({ map: lowerDeckTex, metalness: 0.7, roughness: 0.4 });
  const upperDeckTex = deckTexture('#2a466b', '#b9d6f2');
  upperDeckTex.repeat.set(2, 1);
  const upperDeck = new THREE.MeshStandardMaterial({ map: upperDeckTex, metalness: 0.75, roughness: 0.32 });
  const chevrons = chevronTexture('#132a4a', '#b8862c');
  chevrons.repeat.set(12, 1);
  const pusherFace = new THREE.MeshStandardMaterial({ map: chevrons, metalness: 0.75, roughness: 0.3 });
  const warn = chevronTexture('#12081a', '#7a2a62');
  warn.repeat.set(1, 6);
  const leds = {
    cyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.4) }),
    magenta: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.magenta).multiplyScalar(1.3) }),
    gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.gold).multiplyScalar(1.3) }),
  };
  const pitGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.magenta).multiplyScalar(0.35) });
  const trayGlow = new THREE.MeshStandardMaterial({ color: '#3a2a0c', metalness: 0.8, roughness: 0.35, emissive: '#f6bd54', emissiveIntensity: 0.18 });

  const box = (min: THREE.Vector3Like, max: THREE.Vector3Like, material: THREE.Material | THREE.Material[], parent: THREE.Object3D = root, radius = 0) => {
    const size = new THREE.Vector3(max.x - min.x, max.y - min.y, max.z - min.z);
    const geo = radius > 0 ? new RoundedBoxGeometry(size.x, size.y, size.z, 2, Math.min(radius, size.x / 2, size.y / 2, size.z / 2)) : new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set((max.x + min.x) / 2, (max.y + min.y) / 2, (max.z + min.z) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const dh = g.deckHalfWidth;
  const oh = g.outerHalfWidth;
  const top = g.upperY + g.wallHeight;
  const farBack = g.backZ - 0.3;
  const front = g.frontZ;

  // Plateau bas, rebord de collecte doré et bande lumineuse cyan.
  box({ x: -dh, y: g.lowerY - 0.05, z: g.pusher.retractedZ - 0.05 }, { x: dh, y: g.lowerY, z: front }, [hull, hull, lowerDeck, hull, gold, hull]);
  box({ x: -dh, y: g.lowerY - 0.016, z: front }, { x: dh, y: g.lowerY - 0.002, z: front + 0.008 }, gold, root, 0.004);
  box({ x: -dh, y: g.lowerY - 0.03, z: front + 0.001 }, { x: dh, y: g.lowerY - 0.022, z: front + 0.006 }, leds.cyan);

  // Bac de collecte : fond doré lumineux, façade de la borne.
  box({ x: -oh, y: g.lowerY - 0.3, z: front }, { x: oh, y: g.lowerY - 0.26, z: front + 0.24 }, trayGlow);
  box({ x: -oh, y: g.lowerY - 0.262, z: front + 0.2 }, { x: oh, y: g.lowerY - 0.255, z: front + 0.21 }, leds.gold);
  box({ x: -oh - 0.06, y: g.lowerY - 0.75, z: front + 0.24 }, { x: oh + 0.06, y: g.lowerY - 0.035, z: front + 0.32 }, panel, root, 0.01);
  box({ x: -oh - 0.06, y: g.lowerY - 0.045, z: front + 0.235 }, { x: oh + 0.06, y: g.lowerY - 0.03, z: front + 0.33 }, chrome, root, 0.006);
  box({ x: -oh, y: g.lowerY - 0.09, z: front + 0.236 }, { x: oh, y: g.lowerY - 0.082, z: front + 0.24 }, leds.cyan);

  for (const s of [-1, 1]) {
    const lo = (a: number, b: number) => Math.min(s * a, s * b);
    const hi = (a: number, b: number) => Math.max(s * a, s * b);
    // Parois extérieures avec liseré chromé et bande cyan.
    box({ x: lo(oh, oh + 0.06), y: g.lowerY - 0.75, z: farBack }, { x: hi(oh, oh + 0.06), y: top, z: front + 0.32 }, hull, root, 0.012);
    box({ x: lo(oh - 0.002, oh + 0.064), y: top, z: farBack }, { x: hi(oh - 0.002, oh + 0.064), y: top + 0.014, z: front + 0.33 }, chrome, root, 0.006);
    box({ x: lo(oh - 0.004, oh), y: top - 0.03, z: farBack }, { x: hi(oh - 0.004, oh), y: top - 0.02, z: front + 0.3 }, leds.cyan);
    // Gouttière de perte : fosse sombre, fond magenta, avertissement en chevrons.
    box({ x: lo(dh, oh), y: g.lowerY - 0.2, z: g.sideOpenZ }, { x: hi(dh, oh), y: g.lowerY - 0.19, z: front + 0.24 }, pitGlow);
    box({ x: lo(oh - 0.012, oh - 0.004), y: g.lowerY - 0.19, z: g.sideOpenZ }, { x: hi(oh - 0.012, oh - 0.004), y: g.lowerY - 0.184, z: front }, leds.magenta);
    const warnMat = new THREE.MeshStandardMaterial({ map: warn, metalness: 0.3, roughness: 0.6, emissive: '#2a0820', emissiveIntensity: 0.4 });
    box({ x: lo(dh - 0.004, dh), y: g.lowerY - 0.19, z: g.sideOpenZ }, { x: hi(dh - 0.004, dh), y: g.lowerY - 0.001, z: front }, warnMat);
    box({ x: lo(oh - 0.004, oh), y: g.lowerY - 0.19, z: g.sideOpenZ }, { x: hi(oh - 0.004, oh), y: g.lowerY + 0.02, z: front + 0.24 }, pit);
    // Joues basses (avant la gouttière) et joues hautes au-dessus du plateau supérieur.
    box({ x: lo(dh, oh), y: g.lowerY - 0.12, z: g.pusher.retractedZ }, { x: hi(dh, oh), y: g.upperY, z: g.sideOpenZ }, panel, root, 0.006);
    box({ x: lo(dh, oh), y: g.upperY, z: g.sideOpenZ - 0.012 }, { x: hi(dh, oh), y: g.upperY + 0.01, z: g.sideOpenZ }, gold);
    const reach = g.pusher.retractedZ + g.pusher.maxStroke + 0.01;
    box({ x: lo(dh, oh), y: g.upperY + 0.002, z: farBack }, { x: hi(dh, oh), y: top, z: reach }, panel, root, 0.008);
    box({ x: lo(dh - 0.002, oh), y: g.upperY + 0.06, z: reach - 0.01 }, { x: hi(dh - 0.002, oh), y: g.upperY + 0.068, z: reach + 0.002 }, gold);
  }

  // Mur de fond racleur et barre dorée en pied.
  box({ x: -oh, y: g.upperY + 0.002, z: g.backZ - 0.06 }, { x: oh, y: top, z: g.backZ }, panel);
  box({ x: -dh, y: g.upperY + 0.004, z: g.backZ - 0.004 }, { x: dh, y: g.upperY + 0.02, z: g.backZ + 0.004 }, gold, root, 0.004);
  // Décal du mur de fond (`cabinet.front-decal`, rapport 8:3) : image livrée ou ornement procédural.
  const decalWidth = 2 * dh;
  const decalHeight = (decalWidth * 3) / 8;
  const decalMaterial = new THREE.MeshStandardMaterial({ map: backWallTrim(), transparent: true, alphaTest: 0.02, metalness: 0.55, roughness: 0.42 });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(decalWidth, decalHeight), decalMaterial);
  decal.position.set(0, top - decalHeight / 2, g.backZ + 0.0008);
  decal.receiveShadow = true;
  root.add(decal);
  const decalAsset = resolveAsset('cabinet.front-decal');
  if (decalAsset.kind === 'file') {
    new THREE.TextureLoader().load(
      decalAsset.url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        decalMaterial.map = t;
        decalMaterial.needsUpdate = true;
      },
      undefined,
      () => reportAssetFailure('cabinet.front-decal', 'chargement impossible'),
    );
  }
  // Fronton au-dessus du mur : accueillera la roue (J4).
  box({ x: -oh - 0.06, y: top, z: g.backZ - 0.3 }, { x: oh + 0.06, y: top + 0.34, z: g.backZ + 0.02 }, hull, root, 0.02);
  box({ x: -oh + 0.02, y: top + 0.03, z: g.backZ + 0.02 }, { x: oh - 0.02, y: top + 0.31, z: g.backZ + 0.03 }, panel, root, 0.01);
  box({ x: -oh, y: top + 0.012, z: g.backZ + 0.018 }, { x: oh, y: top + 0.022, z: g.backZ + 0.034 }, leds.magenta);

  // Pousseur : le groupe se déplace en Z, origine sur sa face avant.
  const pusher = new THREE.Group();
  pusher.name = 'pusher';
  const ph = g.upperY - g.lowerY - 0.001;
  box({ x: -dh, y: g.lowerY + 0.001, z: -g.pusher.depth }, { x: dh, y: g.upperY, z: 0 }, [hull, hull, upperDeck, hull, pusherFace, hull], pusher);
  box({ x: -dh, y: g.upperY - 0.012, z: -0.006 }, { x: dh, y: g.upperY + 0.0005, z: 0.003 }, gold, pusher, 0.004);
  box({ x: -dh, y: g.lowerY + ph * 0.18, z: 0 }, { x: dh, y: g.lowerY + ph * 0.18 + 0.006, z: 0.004 }, leds.cyan, pusher);
  root.add(pusher);

  // Goulotte : plancher acrylique teinté, rails chromés, trémie en haut.
  const chute = new THREE.Group();
  chute.name = 'chute';
  const c = g.chute;
  const f = chuteFrame(g);
  const slope = new THREE.Group();
  slope.position.set(0, (f.top.y + f.exit.y) / 2, (f.top.z + f.exit.z) / 2);
  slope.rotation.x = f.tilt;
  const acrylic = new THREE.MeshPhysicalMaterial({ color: '#7fe8ff', metalness: 0, roughness: 0.12, transparent: true, opacity: 0.38, clearcoat: 1 });
  const outer = c.halfWidth + c.railThickness;
  box({ x: -outer, y: -c.floorThickness, z: -c.length / 2 }, { x: outer, y: 0, z: c.length / 2 }, acrylic, slope).castShadow = false;
  for (const s of [-1, 1]) {
    box({ x: s * c.halfWidth - (s < 0 ? c.railThickness : 0), y: 0, z: -c.length / 2 }, { x: s * c.halfWidth + (s > 0 ? c.railThickness : 0), y: c.railHeight, z: c.length / 2 }, chrome, slope, 0.003);
  }
  // Repère lumineux de visée à la sortie de la goulotte (côté mur de fond).
  box({ x: -outer, y: -c.floorThickness - 0.004, z: -c.length / 2 }, { x: outer, y: -c.floorThickness, z: -c.length / 2 + 0.012 }, leds.gold, slope);
  chute.add(slope);
  const hopper = box(
    { x: -outer - 0.01, y: f.top.y - 0.01, z: f.top.z - 0.02 },
    { x: outer + 0.01, y: f.top.y + 0.07, z: f.top.z + 0.05 },
    [chrome, chrome, gold, hull, panel, hull],
    chute,
    0.008,
  );
  hopper.castShadow = true;
  root.add(chute);

  // Barrières latérales (bonus) : plaques cyan translucides qui montent des gouttières.
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.cyan, emissive: PALETTE.cyan, emissiveIntensity: 0.8, transparent: true, opacity: 0.65 });
  const barriers: THREE.Mesh[] = [];
  const height = g.barrier.raisedTop - (g.lowerY - 0.26);
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(g.barrier.thickness, height, g.frontZ - g.pusher.retractedZ);
    const mesh = new THREE.Mesh(geo, barrierMaterial);
    mesh.position.set(s * (dh + g.barrier.thickness / 2), g.barrier.loweredTop - height / 2, (g.frontZ + g.pusher.retractedZ) / 2);
    mesh.visible = false;
    root.add(mesh);
    barriers.push(mesh);
  }

  // Socle sombre limité à l'emprise de la borne (le fond de page reste visible autour).
  box({ x: -oh - 0.3, y: g.lowerY - 0.8, z: farBack - 0.2 }, { x: oh + 0.3, y: g.lowerY - 0.76, z: front + 0.6 }, new THREE.MeshStandardMaterial({ color: '#070b16', roughness: 1 })).receiveShadow = true;

  return { root, pusher, chute, barriers, leds, barrierMaterial, hull, panel };
}

/** Applique la pose cinématique interpolée de la simulation. */
export function updateCabinet(parts: CabinetParts, g: MachineGeometry, k: { pusherZ: number; chuteX: number; barrier: number }): void {
  parts.pusher.position.z = k.pusherZ;
  parts.chute.position.x = k.chuteX;
  const height = g.barrier.raisedTop - (g.lowerY - 0.26);
  const topY = g.barrier.loweredTop + (g.barrier.raisedTop - g.barrier.loweredTop) * k.barrier;
  for (const b of parts.barriers) {
    b.position.y = topY - height / 2;
    b.visible = k.barrier > 0.001;
  }
}
