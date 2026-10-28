import './styles.css';
import configText from '../config/game.yaml?raw';
import { buildConfig, loadOverrides, saveOverrides } from './config/overrides.ts';
import { parseConfigYaml } from './config/parse.ts';
import { ConfigError, type GameConfig } from './config/schema.ts';
import { webglAvailable } from './render/webgl.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function progress(fraction: number, text: string): void {
  $('loading-text').textContent = text;
  $('loading-bar').style.width = `${Math.round(fraction * 100)}%`;
}

function fatal(title: string, text: string, details?: string): void {
  $('loading').hidden = true;
  $('fatal').hidden = false;
  $('fatal-title').textContent = title;
  $('fatal-text').textContent = text;
  const pre = $('fatal-details');
  pre.hidden = !details;
  pre.textContent = details ?? '';
  $('fatal-reload').onclick = () => location.reload();
}

async function boot(): Promise<void> {
  progress(0.08, 'Vérification de WebGL 2…');
  if (!webglAvailable()) {
    fatal(
      'WebGL 2 indisponible',
      "Ce navigateur ou cet appareil ne fournit pas WebGL 2, nécessaire à la scène 3D. Activez l'accélération matérielle ou essayez un navigateur récent (Chrome, Firefox, Safari, Edge).",
    );
    return;
  }

  progress(0.18, 'Lecture de la configuration…');
  let config: GameConfig;
  let published: GameConfig;
  try {
    published = parseConfigYaml(configText);
  } catch (error) {
    const details = error instanceof ConfigError ? error.details : String(error);
    fatal('Configuration invalide', 'Le fichier config/game.yaml ne respecte pas le schéma. Le jeu ne démarre pas avec des valeurs incohérentes.', details);
    return;
  }
  // Réglages opérateur locaux : un ensemble invalide est écarté, la configuration publiée reste active.
  let overrides = loadOverrides();
  let overrideError: string | null = null;
  try {
    config = buildConfig(configText, overrides);
  } catch (error) {
    overrideError = error instanceof ConfigError ? `${error.message} : ${error.details.split('\n')[0]}` : String(error);
    overrides = null;
    saveOverrides(null);
    config = published;
  }

  progress(0.32, 'Chargement du moteur physique…');
  const { default: RAPIER } = await import('@dimforge/rapier3d-compat');
  progress(0.5, 'Initialisation du moteur physique…');
  await RAPIER.init();

  progress(0.66, 'Chargement du rendu 3D…');
  const { App } = await import('./app.ts');
  progress(0.8, 'Construction de la machine et mise en place des pièces…');
  // Laisse le navigateur peindre la progression avant la stabilisation physique.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const app = new App(RAPIER, config, $('app'), { overrides, error: overrideError, published });
  app.configText = configText;
  progress(0.9, 'Lecture de la sauvegarde locale…');
  await app.init();
  progress(1, 'Prêt');
  app.start();
  $('loading').hidden = true;
  Object.assign(window, { coinCascade: app });
}

boot().catch((error: unknown) => {
  console.error(error);
  fatal('Erreur au démarrage', "Une erreur inattendue a empêché le lancement du jeu. Les détails ci-dessous aideront au diagnostic.", error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error));
});
