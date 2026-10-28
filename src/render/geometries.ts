import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Pièce : deux faces planes texturables (groupe 0) et un listel/tranche
 * métallique (groupe 1). Axe de révolution Y, comme le collider Rapier.
 *
 * Convention UV des faces (contrat `coin.face.*`) : le disque inscrit dans les
 * 88 % centraux de l'image couvre le disque plat de la face, soit `faceRatio`
 * du rayon de la pièce. Face supérieure vue de dessus : haut de l'image vers −Z.
 * La face inférieure reçoit la même image en miroir.
 */
export function createCoinGeometry(radius: number, thickness: number, faceRatio = 0.86, segments = 40): THREE.BufferGeometry {
  const h = thickness / 2;
  const rf = radius * faceRatio;
  const recess = Math.min(0.0012, h * 0.18);
  const bevel = Math.min(0.0022, h * 0.3);

  const faces: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    const face = new THREE.CircleGeometry(rf, segments);
    // CircleGeometry est dans le plan XY, UV centrées en 0.5 de rayon 0.5 : ramener au disque de 88 %.
    const uv = face.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * 0.88, 0.5 + (uv.getY(i) - 0.5) * 0.88);
    face.rotateX(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    face.translate(0, side * (h - recess), 0);
    faces.push(face);
  }

  // Profil du listel et de la tranche, du bord de la face supérieure à celui de la face inférieure.
  const profile = [
    new THREE.Vector2(rf, h - recess),
    new THREE.Vector2(rf + radius * 0.025, h),
    new THREE.Vector2(radius - bevel, h),
    new THREE.Vector2(radius - bevel * 0.3, h - bevel * 0.3),
    new THREE.Vector2(radius, h - bevel),
    new THREE.Vector2(radius, -h + bevel),
    new THREE.Vector2(radius - bevel * 0.3, -h + bevel * 0.3),
    new THREE.Vector2(radius - bevel, -h),
    new THREE.Vector2(rf + radius * 0.025, -h),
    new THREE.Vector2(rf, -h + recess),
  ];
  // LatheGeometry tourne de +Z vers +X ; le sens des points donne des normales sortantes.
  const rim = new THREE.LatheGeometry(profile.reverse(), segments);

  const merged = mergeGeometries([mergeGeometries(faces), rim], true);
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Gemme taillée à plat : table octogonale, couronne et pavillon facettés,
 * contenue dans l'enveloppe de la pièce (même collider).
 */
export function createGemGeometry(radius: number, thickness: number): THREE.BufferGeometry {
  const h = thickness / 2;
  const n = 8;
  const rings: [number, number, number][] = [
    // [rayon, hauteur, décalage angulaire]
    [radius * 0.5, h, 0],
    [radius * 0.95, h * 0.25, 0.5],
    [radius * 0.95, -h * 0.25, 0.5],
    [radius * 0.35, -h, 0],
  ];
  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const pt = (ring: number, i: number) => {
    const [r, y, off] = rings[ring]!;
    const a = ((i + off) / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };
  const top = new THREE.Vector3(0, h, 0);
  const bottom = new THREE.Vector3(0, -h, 0);
  for (let i = 0; i < n; i++) {
    pushTri(top, pt(0, i + 1), pt(0, i));
    for (let k = 0; k < rings.length - 1; k++) {
      const a = pt(k, i);
      const b = pt(k, i + 1);
      const c = pt(k + 1, i);
      const d = pt(k + 1, i + 1);
      pushTri(a, b, c);
      pushTri(b, d, c);
    }
    pushTri(bottom, pt(3, i), pt(3, i + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals(); // triangles non indexés : normales plates, facettes nettes
  return g;
}

/** Coffre : caisse, couvercle bombé, cerclages et serrure, en couleurs de sommets. */
export function createChestGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (geo: THREE.BufferGeometry, color: string) => {
    const c = new THREE.Color(color);
    const n = geo.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo.index ? geo.toNonIndexed() : geo;
  };
  const bodyH = height * 0.62;
  const lidH = height - bodyH;
  const body = new THREE.BoxGeometry(width, bodyH, depth);
  body.translate(0, -height / 2 + bodyH / 2, 0);
  parts.push(paint(body, '#7a3d1f'));
  const lid = new THREE.CylinderGeometry(depth / 2, depth / 2, width, 20, 1, false, 0, Math.PI);
  lid.rotateZ(Math.PI / 2);
  lid.rotateX(-Math.PI / 2);
  lid.scale(1, (lidH / (depth / 2)) * 1, 1);
  lid.translate(0, -height / 2 + bodyH, 0);
  parts.push(paint(lid, '#8e4824'));
  for (const x of [-width * 0.32, width * 0.32]) {
    const band = new THREE.BoxGeometry(width * 0.09, bodyH * 1.02, depth * 1.04);
    band.translate(x, -height / 2 + bodyH / 2, 0);
    parts.push(paint(band, '#f6bd54'));
    const lidBand = new THREE.CylinderGeometry(depth * 0.52, depth * 0.52, width * 0.09, 20, 1, false, 0, Math.PI);
    lidBand.rotateZ(Math.PI / 2);
    lidBand.rotateX(-Math.PI / 2);
    lidBand.scale(1, lidH / (depth / 2), 1);
    lidBand.translate(x, -height / 2 + bodyH, 0);
    parts.push(paint(lidBand, '#f6bd54'));
  }
  const lock = new THREE.BoxGeometry(width * 0.16, bodyH * 0.38, depth * 0.06);
  lock.translate(0, -height / 2 + bodyH * 0.72, depth / 2 + depth * 0.02);
  parts.push(paint(lock, '#ffe7a6'));
  const gem = new THREE.OctahedronGeometry(width * 0.045);
  gem.translate(0, -height / 2 + bodyH * 0.72, depth / 2 + depth * 0.06);
  parts.push(paint(gem, '#54e5ec'));
  // Les normales d'origine (lissées sur le couvercle) sont conservées par la fusion.
  return mergeGeometries(
    parts.map((p) => {
      p.deleteAttribute('uv');
      return p;
    }),
  );
}
