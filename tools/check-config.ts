// Valide config/game.yaml et affiche l'identifiant de règles : `npm run check:config [-- chemin.yaml]`
import { readFileSync } from 'node:fs';
import { computeRulesId, parseConfigYaml } from '../src/config/parse.ts';
import { ConfigError } from '../src/config/schema.ts';

const file = process.argv[2] ?? new URL('../config/game.yaml', import.meta.url).pathname;
try {
  const config = parseConfigYaml(readFileSync(file, 'utf8'));
  console.log(`✓ ${file} valide — règles ${computeRulesId(config)}, ${config.machine.initialObjects} objets initiaux, plafond ${config.simulation.maxPhysicalObjects}.`);
} catch (error) {
  console.error(`✗ ${file} invalide`);
  console.error(error instanceof ConfigError ? error.details : String(error));
  process.exit(1);
}
