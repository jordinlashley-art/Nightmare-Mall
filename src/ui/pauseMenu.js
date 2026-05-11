import { GameState, updateState } from '../systems/state.js';
import { resetKeyboardState } from '../systems/input.js';
import { resetDemon } from '../world/demon.js';
import { initMainMenu, playEntryAnimation } from './mainMenu.js';
import { closeInspectOverlay } from './overlay.js';

const PAUSE_OPTIONS_COUNT = 3;
const QUIT_OPTIONS_COUNT = 2;
const ENTRY_DURATION_MS = 300;
const EXIT_DURATION_MS = 200;
const QUIT_FADE_DURATION_MS = 500;

let selectedIndex = 0;
let activeSubscreen = null;
let navigationBound = false;
let exitTimeoutId = null;
let quitTimeoutId = null;
let isQuittingToMenu = false;

function getPauseMenu() {
  return document.getElementById('pause-menu');
}

function getPauseContent() {
  return document.getElementById('pause-content');
}

function getHUD() {
  return document.getElementById('hud');
}

function getGameCanvas() {
  return document.querySelector('canvas');
}

function requestGamePointerLock() {
  const canvas = getGameCanvas();

  if (canvas && document.pointerLockElement !== canvas) {
    const lockRequest = canvas.requestPointerLock();

    if (lockRequest?.catch) {
      lockRequest.catch(() => {});
    }
  }
}

function isMainMenuVisible() {
  const mainMenu = document.getElementById('main-menu');

  return Boolean(mainMenu && !mainMenu.classList.contains('hidden'));
}

function isPlantSequenceActive() {
  return Boolean(document.getElementById('plant-ui')?.classList.contains('active'));
}

function canOpenPauseMenu() {
  return !isQuittingToMenu && !isMainMenuVisible() && !isPlantSequenceActive();
}

function getActiveOptions() {
  if (activeSubscreen === 'quit-confirm') {
    return [...document.querySelectorAll('#quit-confirm-actions .pause-option')];
  }

  if (activeSubscreen) {
    return [];
  }

  return [...document.querySelectorAll('#pause-nav .pause-option')];
}

function clearPauseTimers() {
  if (exitTimeoutId) {
    window.clearTimeout(exitTimeoutId);
    exitTimeoutId = null;
  }

  if (quitTimeoutId) {
    window.clearTimeout(quitTimeoutId);
    quitTimeoutId = null;
  }
}

function setElementFade(element, opacity, duration) {
  if (!element) {
    return;
  }

  element.style.transition = `opacity ${duration}ms ease`;
  element.style.opacity = String(opacity);
}

function playContentAnimation(scale, opacity, duration, easing) {
  const content = getPauseContent();

  if (!content) {
    return;
  }

  content.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
  content.style.transform = `scale(${scale})`;
  content.style.opacity = String(opacity);
}

function primeContentAnimation(scale, opacity) {
  const content = getPauseContent();

  if (!content) {
    return;
  }

  content.style.transition = 'none';
  content.style.transform = `scale(${scale})`;
  content.style.opacity = String(opacity);
  void content.offsetWidth;
}

function updatePauseSelection() {
  const activeOptions = getActiveOptions();

  document.querySelectorAll('#pause-menu .pause-option').forEach((option) => {
    option.classList.remove('selected', 'dimmed');
  });

  activeOptions.forEach((option, index) => {
    const isSelected = index === selectedIndex;

    option.classList.toggle('selected', isSelected);
    option.classList.toggle('dimmed', !isSelected);
  });
}

function closePauseSubscreen() {
  const nav = document.getElementById('pause-nav');

  document.querySelectorAll('.pause-subscreen').forEach((subscreen) => {
    subscreen.classList.remove('active');
  });

  nav?.classList.remove('hidden');
  activeSubscreen = null;
  selectedIndex = 0;
  updatePauseSelection();
}

function openPauseSubscreen(id) {
  const nav = document.getElementById('pause-nav');
  const subscreen = document.getElementById(`pause-${id}`);

  if (!subscreen) {
    return;
  }

  document.querySelectorAll('.pause-subscreen').forEach((screen) => {
    screen.classList.remove('active');
  });

  nav?.classList.add('hidden');
  subscreen.classList.add('active');
  activeSubscreen = id;
  selectedIndex = 0;
  updatePauseSelection();
}

function resetGameStateForMenu() {
  updateState({
    fear: 0,
    isHidden: false,
    detectionLevel: 0,
    inventory: [],
    activeSlot: 0,
    objective: null,
    isAlive: true,
    explosivesPlanted: false,
    isPaused: false,
    isInspecting: false,
    demonProximity: {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
    },
  });
}

function confirmQuit() {
  const pauseMenu = getPauseMenu();
  const hud = getHUD();
  const canvas = getGameCanvas();

  isQuittingToMenu = true;
  updateState({ isPaused: false });
  resetKeyboardState();
  setElementFade(pauseMenu, 0, QUIT_FADE_DURATION_MS);
  setElementFade(canvas, 0, QUIT_FADE_DURATION_MS);
  setElementFade(hud, 0, QUIT_FADE_DURATION_MS);

  quitTimeoutId = window.setTimeout(() => {
    pauseMenu?.classList.remove('active');
    closePauseSubscreen();

    if (pauseMenu) {
      pauseMenu.style.transition = '';
      pauseMenu.style.opacity = '1';
    }

    resetGameStateForMenu();
    resetDemon();
    initMainMenu();
    playEntryAnimation();
    setElementFade(canvas, 1, 0);
    setElementFade(hud, 1, 0);
    selectedIndex = 0;
    isQuittingToMenu = false;
    quitTimeoutId = null;
  }, QUIT_FADE_DURATION_MS);
}

function triggerPauseOption() {
  const selectedOption = getActiveOptions()[selectedIndex];
  const option = selectedOption?.dataset.option;

  if (option === 'resume') {
    closePauseMenu();
  } else if (option === 'howto') {
    openPauseSubscreen('howto');
  } else if (option === 'quit') {
    openPauseSubscreen('quit-confirm');
  } else if (option === 'quit-yes') {
    confirmQuit();
  } else if (option === 'quit-no') {
    closePauseSubscreen();
  }
}

function moveSelection(direction) {
  const optionCount = activeSubscreen === 'quit-confirm' ? QUIT_OPTIONS_COUNT : PAUSE_OPTIONS_COUNT;

  selectedIndex = (selectedIndex + direction + optionCount) % optionCount;
  updatePauseSelection();
}

function handleOptionPointerSelect(option) {
  const options = getActiveOptions();
  const optionIndex = options.indexOf(option);

  if (optionIndex === -1) {
    return;
  }

  selectedIndex = optionIndex;
  updatePauseSelection();
}

function handleKeydown(event) {
  if (event.repeat) {
    return;
  }

  if (event.key === 'Escape' && GameState.isInspecting && !GameState.isPaused) {
    event.preventDefault();
    closeInspectOverlay();
    return;
  }

  if (event.key === 'Escape' && !GameState.isPaused) {
    if (!canOpenPauseMenu()) {
      return;
    }

    event.preventDefault();
    openPauseMenu();
    return;
  }

  if (!GameState.isPaused) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();

    if (activeSubscreen) {
      closePauseSubscreen();
    } else {
      closePauseMenu();
    }
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    if (activeSubscreen === 'howto') {
      return;
    }

    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    if (activeSubscreen === 'howto') {
      return;
    }

    event.preventDefault();
    moveSelection(1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    triggerPauseOption();
  }
}

// Injects the pause menu overlay shell into the document body.
function initPauseMenu() {
  let pauseMenu = getPauseMenu();

  if (pauseMenu) {
    return pauseMenu;
  }

  pauseMenu = document.createElement('div');
  pauseMenu.id = 'pause-menu';
  pauseMenu.innerHTML = `
    <div id="pause-scanlines"></div>
    <div id="pause-overlay"></div>

    <div id="pause-content">
      <div id="pause-title">PAUSED</div>

      <div id="pause-nav">
        <div class="pause-option selected" data-option="resume">
          <span class="option-bracket">[</span>
          <span class="option-text">RESUME</span>
          <span class="option-bracket">]</span>
        </div>
        <div class="pause-option" data-option="howto">
          <span class="option-bracket">[</span>
          <span class="option-text">HOW TO PLAY</span>
          <span class="option-bracket">]</span>
        </div>
        <div class="pause-option" data-option="quit">
          <span class="option-bracket">[</span>
          <span class="option-text">QUIT</span>
          <span class="option-bracket">]</span>
        </div>
      </div>

      <div id="pause-howto" class="pause-subscreen">
        <div class="subscreen-title">HOW TO PLAY</div>
        <div class="subscreen-content">
          <div class="howto-row">
            <span class="howto-key">W A S D</span>
            <span class="howto-desc">Move</span>
          </div>
          <div class="howto-row">
            <span class="howto-key">MOUSE</span>
            <span class="howto-desc">Look around</span>
          </div>
          <div class="howto-row">
            <span class="howto-key">E</span>
            <span class="howto-desc">Interact / Pick up</span>
          </div>
          <div class="howto-row">
            <span class="howto-key">TAB</span>
            <span class="howto-desc">Inspect item</span>
          </div>
          <div class="howto-row">
            <span class="howto-key">1 2 3 4</span>
            <span class="howto-desc">Select item slot</span>
          </div>
          <div class="howto-row">
            <span class="howto-key">ESC</span>
            <span class="howto-desc">Pause</span>
          </div>
          <div class="howto-divider"></div>
          <div class="howto-objective">
            Find the explosive. Plant it at the portal.
            Get out before it closes.
            Do not get caught.
          </div>
        </div>
        <div class="subscreen-back">[ ESC ] Back</div>
      </div>

      <div id="pause-quit-confirm" class="pause-subscreen">
        <div id="quit-confirm-text">QUIT TO MENU?</div>
        <div id="quit-confirm-sub">All progress will be lost.</div>
        <div id="quit-confirm-actions">
          <div class="pause-option selected" data-option="quit-yes">
            <span class="option-bracket">[</span>
            <span class="option-text">YES</span>
            <span class="option-bracket">]</span>
          </div>
          <div class="pause-option" data-option="quit-no">
            <span class="option-bracket">[</span>
            <span class="option-text">NO</span>
            <span class="option-bracket">]</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(pauseMenu);
  return pauseMenu;
}

// Opens the pause menu and dims gameplay HUD elements behind it.
function openPauseMenu() {
  const pauseMenu = initPauseMenu();
  const hud = getHUD();

  if (GameState.isPaused || !canOpenPauseMenu()) {
    return;
  }

  if (GameState.isInspecting) {
    closeInspectOverlay();
  }

  clearPauseTimers();
  updateState({ isPaused: true });
  resetKeyboardState();
  pauseMenu.classList.add('active');
  pauseMenu.style.opacity = '1';
  pauseMenu.style.transition = '';
  selectedIndex = 0;
  closePauseSubscreen();
  updatePauseSelection();

  if (hud) {
    hud.style.opacity = '0.3';
  }

  primeContentAnimation(0.96, 0);
  window.requestAnimationFrame(() => {
    playContentAnimation(1, 1, ENTRY_DURATION_MS, 'ease-out');
  });
}

// Closes the pause menu and restores normal gameplay HUD opacity.
function closePauseMenu() {
  const pauseMenu = getPauseMenu();
  const hud = getHUD();

  if (!pauseMenu || !GameState.isPaused) {
    return;
  }

  clearPauseTimers();
  updateState({ isPaused: false });
  resetKeyboardState();
  requestGamePointerLock();
  playContentAnimation(0.96, 0, EXIT_DURATION_MS, 'ease-in');

  exitTimeoutId = window.setTimeout(() => {
    pauseMenu.classList.remove('active');

    if (hud) {
      hud.style.opacity = '1';
    }

    closePauseSubscreen();
    selectedIndex = 0;
    resetKeyboardState();
    exitTimeoutId = null;
  }, EXIT_DURATION_MS);
}

// Binds keyboard and pointer navigation for the pause menu.
function setupPauseNavigation() {
  if (navigationBound) {
    return;
  }

  navigationBound = true;
  window.addEventListener('keydown', handleKeydown);
  initPauseMenu().querySelectorAll('.pause-option').forEach((option) => {
    option.addEventListener('mouseover', () => {
      handleOptionPointerSelect(option);
    });
    option.addEventListener('click', () => {
      handleOptionPointerSelect(option);
      triggerPauseOption();
    });
  });
}

export {
  closePauseMenu,
  initPauseMenu,
  openPauseMenu,
  setupPauseNavigation,
};
