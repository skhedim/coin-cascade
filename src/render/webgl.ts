/** Vérifie WebGL2 avant de charger Three.js, pour afficher un message lisible. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
