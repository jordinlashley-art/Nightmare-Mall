import * as THREE from 'three';
import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import {
  initHUD,
  setActiveSlot,
  updateFearMeter,
  updateObjectiveTracker,
  updateStealthIndicator,
} from './ui/hud.js';
import { initCompass, updateCompass } from './ui/compass.js';
import {
  initMainMenu,
  playEntryAnimation,
  setupMenuNavigation,
} from './ui/mainMenu.js';
import {
  closeInspectOverlay,
  initOverlay,
  openInspectOverlay,
  updateVignette,
} from './ui/overlay.js';
import {
  initEndScreens,
  initRunStats,
  isDeathScreenActive,
  isWinScreenActive,
  runStats,
  setupEndNavigation,
  triggerDeathScreen,
  triggerWinScreen,
} from './ui/endScreens.js';
import {
  closePauseMenu,
  initPauseMenu,
  openPauseMenu,
  setupPauseNavigation,
} from './ui/pauseMenu.js';
import { initPlantUI, startPlantSequence } from './ui/plantUI.js';
import { initPlayer, updatePlayer } from './systems/player.js';
import { GameState, updateState } from './systems/state.js';
import { onInspectHold, onInteract, onSlotSelect } from './systems/input.js';

let animationLoopStarted = false;
let gameSystemsStarted = false;
let inputHandlersBound = false;
let lastTime = performance.now();

document.body.appendChild(renderer.domElement);

document.getElementById('hud').style.opacity = '0';
initMainMenu();
setupMenuNavigation();
playEntryAnimation();

function animate() {
  const now = performance.now();
  const delta = (now - lastTime) / 1000;

  lastTime = now;

  if (GameState.isAlive === false && !isDeathScreenActive()) {
    triggerDeathScreen();
  }

  if (GameState.explosivesPlanted === true && !isWinScreenActive() && !isDeathScreenActive()) {
    triggerWinScreen();
  }

  updatePlayer(delta);

  if (!GameState.isInspecting && !GameState.isPaused) {
    updateStealthIndicator();
    updateFearMeter(GameState.fear);
  }

  if (!GameState.isPaused) {
    updateCompass();
  }

  updateVignette(GameState.fear);
  updateObjectiveTracker();
  renderer.render(scene, camera);
}

function bindGameInputHandlers() {
  if (inputHandlersBound) {
    return;
  }

  inputHandlersBound = true;
  onInspectHold(
    () => openInspectOverlay(),
    () => closeInspectOverlay(),
  );
  onSlotSelect(setActiveSlot);
  onInteract(() => {
    startPlantSequence();
  });
}

// Initializes HUD, overlays, input handlers, and the render loop after START.
function startGameSystems() {
  initEndScreens();
  setupEndNavigation();
  initRunStats();

  if (gameSystemsStarted) {
    initEnvironment(scene);
    initPlayer(new THREE.Vector3(0, 1.7, 5));
    lastTime = performance.now();
    return;
  }

  gameSystemsStarted = true;
  initHUD();
  initOverlay();
  initCompass();
  initPlantUI();
  initPauseMenu();
  setupPauseNavigation();
  bindGameInputHandlers();
  initEnvironment(scene);
  initPlayer(new THREE.Vector3(0, 1.7, 5));
  lastTime = performance.now();

  if (!animationLoopStarted) {
    renderer.setAnimationLoop(animate);
    animationLoopStarted = true;
  }
}

// TEMP TEST — remove when world is connected
// Tests both end screens manually
window.addEventListener('keydown', (event) => {
  if (event.key === 'k' || event.key === 'K') {
    updateState({
      fear: 87,
      inventory: ['FLASHLIGHT', 'RADIO'],
    });
    runStats.itemsFound = 2;
    triggerDeathScreen();
  }

  if (event.key === 'j' || event.key === 'J') {
    updateState({
      fear: 34,
      inventory: ['EXPLOSIVE'],
    });
    runStats.itemsFound = 4;
    triggerWinScreen();
  }
});
// Test: K -> full death sequence -> TRY AGAIN -> game restarts directly
// Test: J -> full win sequence -> PLAY AGAIN -> game restarts directly
// Test: K -> QUIT TO MENU -> main menu replays
// Test: J -> QUIT TO MENU -> main menu replays

export { GameState, closePauseMenu, openPauseMenu, startGameSystems };
