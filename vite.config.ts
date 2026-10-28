import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { parseConfigYaml } from './src/config/parse.ts';

/** Refuse un build dont config/game.yaml ne respecte pas le schéma. */
function validateGameConfig(): Plugin {
  return {
    name: 'coin-cascade:validate-config',
    buildStart() {
      const file = new URL('./config/game.yaml', import.meta.url);
      this.addWatchFile(file.pathname);
      try {
        parseConfigYaml(readFileSync(file, 'utf8'));
      } catch (error) {
        const details = error instanceof Error && 'details' in error ? String(error.details) : String(error);
        this.error(`config/game.yaml invalide :\n${details}`);
      }
    },
  };
}

export default defineConfig({
  // Base relative : le même dist/ fonctionne à la racine d'un domaine et sous /coin-cascade/.
  // Pour une base absolue : `npx vite build --base=/coin-cascade/`.
  base: './',
  plugins: [validateGameConfig()],
  build: {
    // Fichiers hachés séparés de public/assets (images Codex, non hachées).
    assetsDir: 'bundle',
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  server: {
    host: true, // accessible depuis le navigateur Windows via WSL2 et le réseau local
    port: 5180,
  },
  preview: {
    host: true,
    port: 4180,
  },
});
