import * as THREE from 'three';
import { camera } from './core/camera.js';
import { initLighting, toggleFlashlight, updateLighting } from './core/lighting.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import { initDemon, resetDemon, updateDemon } from './world/demon.js';
import { initItemSpawns, updateItems } from './world/items.js';
import { initLoreNotes, updateLoreNotes } from './world/loreNotes.js';
import { initPortal, resetPortal, updatePortal } from './world/portal.js';
import {
  initHUD,
  setActiveSlot,
  updateObjectiveTracker,
} from './ui/hud.js';
import { initCompass } from './ui/compass.js';
import {
  initMainMenu,
  playEntryAnimation,
  setupMenuNavigation,
} from './ui/mainMenu.js';
import {
  closeInspectOverlay,
  initOverlay,
  openInspectOverlay,
} from './ui/overlay.js';
import {
  initEndScreens,
  initRunStats,
  isDeathScreenActive,
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
import { initPlantUI } from './ui/plantUI.js';
import { initPlayer, updatePlayer } from './systems/player.js';
import { GameState, updateState } from './systems/state.js';
import {
  initDetection,
  triggerRadioDistraction,
  updateDetection,
} from './systems/detection.js';
import {
  onFlashlightToggle,
  onInspectHold,
  onRadioUse,
  onSlotSelect,
} from './systems/input.js';
import {
  initAudioSystem,
  playFlashlightClickSound,
  resumeAudio,
  updateAudio,
} from './systems/audio.js';

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

  updatePlayer(delta);
  updateLighting(delta);
  updateAudio(delta);

  if (!GameState.isPaused) {
    updateItems(delta);
    updateLoreNotes(delta);
    updateDetection(delta);
    updateDemon(delta);
    updatePortal(delta);
  }

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
  onFlashlightToggle(() => {
    toggleFlashlight();
    playFlashlightClickSound();
  });
  onRadioUse((position) => triggerRadioDistraction(position));
}

// Initializes HUD, overlays, input handlers, and the render loop after START.
function startGameSystems() {
  initEndScreens();
  setupEndNavigation();
  initRunStats();
  initAudioSystem();
  resumeAudio();

  if (gameSystemsStarted) {
    initEnvironment(scene);
    initDemon();
    resetDemon();
    initLighting();
    resetPortal();
    initItemSpawns();
    initLoreNotes();
    initPlayer(new THREE.Vector3(0, 1.7, 5));
    initDetection();
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
  initDemon();
  initLighting();
  initPortal();
  initItemSpawns();
  initLoreNotes();
  initPlayer(new THREE.Vector3(0, 1.7, 5));
  initDetection();
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
