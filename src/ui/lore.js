import { GameState, updateState } from '../systems/state.js';

let loreOverlayBound = false;

function getLoreOverlay() {
  let overlay = document.getElementById('lore-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lore-overlay';
    overlay.innerHTML = `
      <div id="lore-panel">
        <div id="lore-label">LORE NOTE</div>
        <div id="lore-title"></div>
        <div id="lore-body"></div>
        <div id="lore-close">[ ESC ] Close</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  return overlay;
}

function handleLoreKeydown(event) {
  if (
    !isLoreOverlayOpen()
    || (event.key !== 'Escape' && event.key !== 'Tab' && event.key !== 'Enter')
  ) {
    return;
  }

  event.preventDefault();
  closeLoreNote();
}

// Initializes the lore note reading overlay.
function initLoreOverlay() {
  const overlay = getLoreOverlay();

  if (!loreOverlayBound) {
    loreOverlayBound = true;
    window.addEventListener('keydown', handleLoreKeydown);
  }

  return overlay;
}

// Opens a collected lore note and locks normal gameplay input while reading.
function openLoreNote(note) {
  const overlay = initLoreOverlay();
  const title = document.getElementById('lore-title');
  const body = document.getElementById('lore-body');

  if (title) {
    title.textContent = note.title;
  }

  if (body) {
    body.textContent = note.body;
  }

  overlay.classList.add('active');
  updateState({ isInspecting: true });
}

// Closes the lore note overlay and restores normal gameplay input.
function closeLoreNote() {
  const overlay = document.getElementById('lore-overlay');

  overlay?.classList.remove('active');

  if (GameState.isInspecting) {
    updateState({ isInspecting: false });
  }
}

// Returns whether the lore note overlay is currently visible.
function isLoreOverlayOpen() {
  return Boolean(document.getElementById('lore-overlay')?.classList.contains('active'));
}

export {
  closeLoreNote,
  initLoreOverlay,
  isLoreOverlayOpen,
  openLoreNote,
};
