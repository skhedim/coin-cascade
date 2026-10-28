// Pictogrammes SVG en ligne : fallbacks `svg-*` des illustrations bonus du manifeste,
// lisibles à petite taille et colorés par `currentColor`.

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>'),
  diag: svg('<path d="M3 17l5-6 4 4 5-8 4 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // svg-star-flame
  star: svg('<path d="M12 2.5l2.6 6 6.4.6-4.9 4.3 1.5 6.3L12 16.4 6.4 19.7l1.5-6.3L3 9.1l6.4-.6z" fill="currentColor"/>'),
  wheel: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>'),
  // svg-coin-trail
  free: svg('<circle cx="15" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 9h6M3 12h5M2 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  // svg-gold-coin-sparkle
  golden: svg('<circle cx="11" cy="13" r="7" fill="currentColor" opacity=".9"/><path d="M11 9.5l1.1 2.4 2.6.3-2 1.7.6 2.6-2.3-1.4-2.3 1.4.6-2.6-2-1.7 2.6-.3z" fill="#2a1a00"/><path d="M19 2.5v4M17 4.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  // svg-side-shields
  barriers: svg('<path d="M4 4v16M20 4v16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'),
  // svg-pusher-arrows
  superPush: svg('<path d="M5 13l7-6 7 6M5 19l7-6 7 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  // svg-radial-wave
  shockwave: svg('<circle cx="12" cy="12" r="2.5" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/>'),
  // svg-falling-coins
  rain: svg('<circle cx="7" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="10" r="3" fill="currentColor"/><circle cx="10" cy="17" r="3" fill="currentColor"/>'),
  chest: svg('<rect x="3" y="10" width="18" height="10" rx="1.5" fill="currentColor"/><path d="M3 10a9 5 0 0118 0" fill="currentColor" opacity=".8"/><rect x="10.5" y="11.5" width="3" height="4" rx=".6" fill="#2a1a00"/>'),
};
