export interface InputActions {
  /** Cible de la goulotte en X monde depuis une position écran. */
  aimScreen(clientX: number, clientY: number): void;
  /** Cible de la goulotte en fraction [0, 1] de sa course (zone tactile). */
  aimFraction(f: number): void;
  /** Déplacement continu au clavier : -1, 0 ou 1. */
  aimNudge(direction: number): void;
  setFire(held: boolean): void;
  togglePause(): void;
  /** Vrai quand un menu ou une présentation bloque les tirs. */
  blocked(): boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Ordinateur : souris pour viser, clic ou espace pour tirer (maintien = cadence),
 * flèches pour viser, Échap pour la pause. Tactile : glisser sur la zone de visée
 * ou la scène, bouton de tir distinct.
 */
export function bindInput(canvas: HTMLCanvasElement, aimZone: HTMLElement, fireButton: HTMLButtonElement, actions: InputActions): () => void {
  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];
  const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts);
    listeners.push([target, type, fn as EventListener, opts]);
  };
  let mouseFire = false;
  let keyFire = false;
  let buttonFire = false;
  const updateFire = () => {
    const held = (mouseFire || keyFire || buttonFire) && !actions.blocked();
    actions.setFire(held);
    fireButton.classList.toggle('pressed', buttonFire);
  };

  // Scène : souris = visée + tir ; doigt = visée seulement (pas de tir accidentel).
  on<PointerEvent>(canvas, 'pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) actions.aimScreen(e.clientX, e.clientY);
  });
  on<PointerEvent>(canvas, 'pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    actions.aimScreen(e.clientX, e.clientY);
    if (e.pointerType === 'mouse' && e.button === 0 && !actions.blocked()) {
      mouseFire = true;
      canvas.setPointerCapture(e.pointerId);
      updateFire();
    }
  });
  const mouseUp = () => {
    mouseFire = false;
    updateFire();
  };
  on(canvas, 'pointerup', mouseUp);
  on(canvas, 'pointercancel', mouseUp);
  on(canvas, 'lostpointercapture', mouseUp);
  on(canvas, 'contextmenu', (e) => e.preventDefault());

  // Zone de visée tactile.
  const aimFromZone = (e: PointerEvent) => {
    const r = aimZone.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left - 24) / Math.max(1, r.width - 48)));
    actions.aimFraction(f);
  };
  on<PointerEvent>(aimZone, 'pointerdown', (e) => {
    aimZone.setPointerCapture(e.pointerId);
    aimFromZone(e);
  });
  on<PointerEvent>(aimZone, 'pointermove', (e) => {
    if (e.buttons || e.pointerType !== 'mouse') aimFromZone(e);
  });

  // Bouton de tir : maintien = répétition à cadence bornée.
  on<PointerEvent>(fireButton, 'pointerdown', (e) => {
    e.preventDefault();
    fireButton.setPointerCapture(e.pointerId);
    buttonFire = true;
    updateFire();
  });
  const buttonUp = () => {
    buttonFire = false;
    updateFire();
  };
  on(fireButton, 'pointerup', buttonUp);
  on(fireButton, 'pointercancel', buttonUp);
  on(fireButton, 'lostpointercapture', buttonUp);
  on<KeyboardEvent>(fireButton, 'keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  // Clavier global, ignoré dans les champs de saisie.
  const arrows = new Set<string>();
  on<KeyboardEvent>(window, 'keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Escape') {
      actions.togglePause();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      arrows.add(e.key);
      actions.aimNudge((arrows.has('ArrowRight') ? 1 : 0) - (arrows.has('ArrowLeft') ? 1 : 0));
      e.preventDefault();
    } else if (e.key === ' ' || e.code === 'Space') {
      if (e.target instanceof HTMLButtonElement && e.target !== fireButton) return;
      keyFire = true;
      updateFire();
      e.preventDefault();
    }
  });
  on<KeyboardEvent>(window, 'keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      arrows.delete(e.key);
      actions.aimNudge((arrows.has('ArrowRight') ? 1 : 0) - (arrows.has('ArrowLeft') ? 1 : 0));
    } else if (e.key === ' ' || e.code === 'Space') {
      keyFire = false;
      updateFire();
    }
  });
  on(window, 'blur', () => {
    arrows.clear();
    actions.aimNudge(0);
    mouseFire = keyFire = buttonFire = false;
    updateFire();
  });

  return () => {
    for (const [t, type, fn, opts] of listeners) t.removeEventListener(type, fn, opts);
  };
}
