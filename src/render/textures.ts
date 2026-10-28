import * as THREE from 'three';

// Textures procédurales dessinées sur canvas : fallbacks des faces de pièces
// (`procedural-coin-face-ring-emblem`, `procedural-gold-coin-star-emblem`) et matières du décor.
// Chaque face produit une carte couleur et une carte données (G = rugosité, B = métal).

export const PALETTE = {
  background: '#080d1b',
  hull: '#14243d',
  panel: '#1c3551',
  gold: '#f6bd54',
  cyan: '#54e5ec',
  magenta: '#ed69c1',
  text: '#eef5ff',
  textDim: '#b4c7d8',
};

type Ctx = CanvasRenderingContext2D;

function canvas(size: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

/** Rugosité (0..1) et métal (0..1) encodés comme dans les cartes glTF. */
function dataStyle(roughness: number, metalness: number): string {
  return `rgb(255, ${Math.round(roughness * 255)}, ${Math.round(metalness * 255)})`;
}

export interface FacePainter {
  /** Dessine sur la carte couleur (`data` = false) ou la carte rugosité/métal (`data` = true). */
  (ctx: Ctx, size: number, data: boolean): void;
}

export interface FaceTextures {
  map: THREE.CanvasTexture;
  data: THREE.CanvasTexture;
}

export function paintFace(painter: FacePainter, size = 256): FaceTextures {
  const [c1, ctx1] = canvas(size);
  const [c2, ctx2] = canvas(size);
  painter(ctx1, size, false);
  painter(ctx2, size, true);
  const map = new THREE.CanvasTexture(c1);
  map.colorSpace = THREE.SRGBColorSpace;
  const data = new THREE.CanvasTexture(c2);
  data.colorSpace = THREE.NoColorSpace;
  for (const t of [map, data]) {
    t.anisotropy = 4;
    t.generateMipmaps = true;
  }
  return { map, data };
}

/** Le disque utile occupe 88 % du carré, comme le contrat de `coin.face.*` du manifeste. */
const DISC = 0.44;

function ring(ctx: Ctx, s: number, r0: number, r1: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, r1 * s, 0, Math.PI * 2);
  ctx.arc(s / 2, s / 2, r0 * s, 0, Math.PI * 2, true);
  ctx.fillStyle = fill;
  ctx.fill();
}

function disc(ctx: Ctx, s: number, r: number, fill: string | CanvasGradient, cx = 0.5, cy = 0.5): void {
  ctx.beginPath();
  ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function metalGradient(ctx: Ctx, s: number, light: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(s * 0.38, s * 0.34, s * 0.02, s * 0.5, s * 0.5, s * 0.5);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

function guilloche(ctx: Ctx, s: number, color: string, count: number, r0: number, r1: number): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s / 256);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(s / 2 + Math.cos(a) * r0 * s, s / 2 + Math.sin(a) * r0 * s);
    ctx.lineTo(s / 2 + Math.cos(a) * r1 * s, s / 2 + Math.sin(a) * r1 * s);
    ctx.stroke();
  }
  ctx.restore();
}

function starPath(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Pièce classique : métal champagne, anneau émaillé cyan, emblème de trois pièces en cascade. */
export const classicFace: FacePainter = (ctx, s, data) => {
  disc(ctx, s, DISC + 0.06, data ? dataStyle(0.34, 1) : metalGradient(ctx, s, '#f4efe2', '#a9a395'));
  if (!data) guilloche(ctx, s, 'rgba(90, 80, 60, 0.18)', 96, 0.08, DISC);
  ring(ctx, s, DISC * 0.78, DISC * 0.92, data ? dataStyle(0.28, 0) : '#1fb8c4');
  ring(ctx, s, DISC * 0.92, DISC, data ? dataStyle(0.3, 1) : '#d8cfb6');
  const cascade = [
    [0.4, 0.4],
    [0.5, 0.5],
    [0.6, 0.6],
  ];
  for (const [x, y] of cascade) {
    disc(ctx, s, 0.105, data ? dataStyle(0.22, 1) : '#7a5a1c', x!, y!);
    disc(ctx, s, 0.09, data ? dataStyle(0.22, 1) : metalGradient(ctx, s, '#ffe7a6', '#d39a2e'), x!, y!);
  }
};

/**
 * Pièce dorée : or saturé et étoile claire bordée de magenta. Métal partiellement diffus,
 * pour qu'elle reste plus lumineuse que la pièce classique même quand l'environnement
 * reflété est sombre (la couleur ne porte pas seule l'information : l'étoile la distingue).
 */
export const goldFace: FacePainter = (ctx, s, data) => {
  disc(ctx, s, DISC + 0.06, data ? dataStyle(0.3, 0.55) : metalGradient(ctx, s, '#ffe58f', '#e8960f'));
  if (!data) guilloche(ctx, s, 'rgba(140, 70, 0, 0.25)', 120, 0.1, DISC);
  ring(ctx, s, DISC * 0.84, DISC * 0.95, data ? dataStyle(0.25, 0) : PALETTE.magenta);
  starPath(ctx, s / 2, s / 2, s * 0.32, s * 0.14);
  ctx.fillStyle = data ? dataStyle(0.2, 0.4) : '#9a2f7a';
  ctx.fill();
  starPath(ctx, s / 2, s / 2 - s * 0.006, s * 0.285, s * 0.12);
  ctx.fillStyle = data ? dataStyle(0.18, 0.5) : metalGradient(ctx, s, '#ffffff', '#ffe7a6');
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i + 0.5) * ((Math.PI * 2) / 5);
    disc(ctx, s, 0.024, data ? dataStyle(0.25, 0) : PALETTE.magenta, 0.5 + Math.cos(a) * 0.33, 0.5 + Math.sin(a) * 0.33);
  }
};

/** Jeton étoile (Fever) : émail magenta, étoile d'or. */
export const starFace: FacePainter = (ctx, s, data) => {
  disc(ctx, s, DISC + 0.06, data ? dataStyle(0.3, 0) : metalGradient(ctx, s, '#ff9bd9', '#a12a78'));
  ring(ctx, s, DISC * 0.88, DISC, data ? dataStyle(0.22, 1) : PALETTE.gold);
  starPath(ctx, s / 2, s / 2, s * 0.32, s * 0.14);
  ctx.fillStyle = data ? dataStyle(0.15, 1) : metalGradient(ctx, s, '#fff6cf', '#f0a92c');
  ctx.fill();
};

/** Jeton roue : secteurs cyan/or, moyeu central. */
export const wheelFace: FacePainter = (ctx, s, data) => {
  disc(ctx, s, DISC + 0.06, data ? dataStyle(0.3, 1) : '#0f1d33');
  const n = 8;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(s / 2, s / 2);
    ctx.arc(s / 2, s / 2, s * DISC * 0.88, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = data ? dataStyle(i % 2 ? 0.3 : 0.2, i % 2 ? 0 : 1) : i % 2 ? '#25c6d1' : '#f2b640';
    ctx.fill();
  }
  ring(ctx, s, DISC * 0.88, DISC, data ? dataStyle(0.25, 1) : '#e8edf3');
  disc(ctx, s, 0.09, data ? dataStyle(0.2, 1) : '#e8edf3');
  disc(ctx, s, 0.045, data ? dataStyle(0.3, 0) : PALETTE.magenta);
};

/** Jetons pouvoir : fond marine, pictogramme et anneau de la couleur du pouvoir. */
export function powerFace(kind: 'barriers' | 'superPush' | 'shockwave'): FacePainter {
  const accent = kind === 'barriers' ? PALETTE.cyan : kind === 'superPush' ? PALETTE.gold : PALETTE.magenta;
  return (ctx, s, data) => {
    disc(ctx, s, DISC + 0.06, data ? dataStyle(0.35, 0) : '#13284a');
    ring(ctx, s, DISC * 0.84, DISC, data ? dataStyle(0.22, 1) : accent);
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.fillStyle = ctx.strokeStyle = data ? dataStyle(0.2, 1) : accent;
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = 'round';
    if (kind === 'barriers') {
      for (const x of [-0.17, 0.17]) {
        ctx.beginPath();
        ctx.moveTo(x * s, -0.2 * s);
        ctx.lineTo(x * s, 0.2 * s);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'superPush') {
      for (const y of [0.08, -0.1]) {
        ctx.beginPath();
        ctx.moveTo(-0.17 * s, (y + 0.1) * s);
        ctx.lineTo(0, y * s - 0.04 * s);
        ctx.lineTo(0.17 * s, (y + 0.1) * s);
        ctx.stroke();
      }
    } else {
      for (const r of [0.07, 0.15, 0.23]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * s, 0, Math.PI * 2);
        ctx.lineWidth = s * (0.05 - r * 0.1);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
}

/** Métal brossé sombre des plateaux, répétable. */
export function deckTexture(base: string, line: string, size = 512): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Stries fines déterministes (pas de flux aléatoire de gameplay).
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.03 + rand() * 0.06;
    ctx.lineWidth = 1;
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rand() - 0.5) * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Bandes de chevrons pour la face avant du pousseur et les avertissements de perte. */
export function chevronTexture(a: string, b: string, size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = b;
  const w = size / 4;
  for (let x = -size; x < size * 2; x += w * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w + size / 2, size / 2);
    ctx.lineTo(x + w, size);
    ctx.lineTo(x, size);
    ctx.lineTo(x + size / 2, size / 2);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Fallback `procedural-cyan-gold-panel-trim` du décal de mur de fond (rapport 8:3,
 * même cadrage que docs/art/templates/back-wall-decal-uv.svg) : cadre doré, filets cyan,
 * trois pièces en cascade au centre. Fond transparent : le panneau marine reste visible.
 */
export function backWallTrim(width = 1024): THREE.CanvasTexture {
  const height = Math.round((width * 3) / 8);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  const u = width / 1024;
  ctx.lineCap = 'round';
  // Cadre doré intérieur (au-dessus de la bande basse souvent masquée par les pièces).
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 5 * u;
  ctx.strokeRect(18 * u, 14 * u, width - 36 * u, height - 80 * u);
  ctx.strokeStyle = 'rgba(84, 229, 236, 0.85)';
  ctx.lineWidth = 3 * u;
  ctx.strokeRect(30 * u, 26 * u, width - 60 * u, height - 104 * u);
  // Arcs cyan rayonnant depuis le centre.
  const cx = width / 2;
  const cy = height * 0.42;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 120 * u * i, 34 * u * i, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = `rgba(84, 229, 236, ${0.55 - i * 0.1})`;
    ctx.lineWidth = 2.5 * u;
    ctx.stroke();
  }
  // Trois pièces en cascade (rappel de l'emblème).
  for (const [dx, dy] of [[-56, -26], [0, 0], [56, 26]] as const) {
    const g = ctx.createRadialGradient(cx + (dx - 10) * u, cy + (dy - 12) * u, 4 * u, cx + dx * u, cy + dy * u, 40 * u);
    g.addColorStop(0, '#fff3cf');
    g.addColorStop(1, '#c98d1d');
    ctx.beginPath();
    ctx.arc(cx + dx * u, cy + dy * u, 36 * u, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = '#7a5a1c';
    ctx.stroke();
  }
  // Chevrons latéraux dorés.
  ctx.fillStyle = PALETTE.gold;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = cx + side * (230 + k * 46) * u;
      ctx.beginPath();
      ctx.moveTo(x, cy - 18 * u);
      ctx.lineTo(x + side * 20 * u, cy);
      ctx.lineTo(x, cy + 18 * u);
      ctx.lineTo(x + side * 8 * u, cy);
      ctx.closePath();
      ctx.globalAlpha = 0.9 - k * 0.25;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
