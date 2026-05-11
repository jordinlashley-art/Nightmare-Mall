import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import {
  initHUD,
  updateFearMeter,
  updateObjectiveTracker,
  updateQuickSlots,
  updateStealthIndicator,
} from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import {
  closeInspectOverlay,
  initOverlay,
  openInspectOverlay,
  updateVignette,
} from './ui/overlay.js';
import { initPlantUI } from './ui/plantUI.js';
import { GameState, updateState } from './systems/state.js';
import { onInspectHold } from './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initMenu();
initOverlay();
initPlantUI();

onInspectHold(
  () => openInspectOverlay(),
  () => closeInspectOverlay(),
);

// TEMP TEST — remove before PROMPT 09
// Test all 3 objective states sequentially

// STATE 1: No explosive in inventory
updateState({
  inventory: ['FLASHLIGHT', 'RADIO'],
  explosivesPlanted: false,
});
updateQuickSlots();
updateObjectiveTracker();

// After 4s: simulate picking up explosive → STATE 2
setTimeout(() => {
  updateState({
    inventory: ['FLASHLIGHT', 'RADIO', 'EXPLOSIVE'],
  });
  updateQuickSlots();
}, 4000);

// After 8s: simulate planting → STATE 3
setTimeout(() => {
  updateState({ explosivesPlanted: true });
}, 8000);

// Observe:
// 0-4s:  "Find the explosive" (white chevron)
// 4-8s:  "Plant the explosive" (amber chevron)
// 8s+:   "GET OUT NOW" (red, glitching)

function animate() {
  if (!GameState.isInspecting) {
    updateStealthIndicator();
    updateFearMeter(GameState.fear);
  }

  updateVignette(GameState.fear);
  updateObjectiveTracker();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };
