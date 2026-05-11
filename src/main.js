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
import { initPlantUI, startPlantSequence } from './ui/plantUI.js';
import { GameState } from './systems/state.js';
import { onInspectHold, onInteract, onSlotSelect } from './systems/input.js';

let animationLoopStarted = false;
let gameSystemsStarted = false;
let inputHandlersBound = false;

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
renderer.render(scene, camera);

document.getElementById('hud').style.opacity = '0';
initMainMenu();
setupMenuNavigation();
playEntryAnimation();

function animate() {
  if (!GameState.isInspecting) {
    updateStealthIndicator();
    updateFearMeter(GameState.fear);
  }

  updateCompass();
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
  if (gameSystemsStarted) {
    return;
  }

  gameSystemsStarted = true;
  initHUD();
  initOverlay();
  initCompass();
  initPlantUI();
  bindGameInputHandlers();

  if (!animationLoopStarted) {
    renderer.setAnimationLoop(animate);
    animationLoopStarted = true;
  }
}

export { GameState, startGameSystems };
