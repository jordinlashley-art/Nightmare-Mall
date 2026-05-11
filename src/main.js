import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import { initHUD, updateFearMeter, updateQuickSlots, updateStealthIndicator } from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import {
  closeInspectOverlay,
  initOverlay,
  openInspectOverlay,
  updateVignette,
} from './ui/overlay.js';
import { initPlantUI, startPlantSequence } from './ui/plantUI.js';
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

// TEMP TEST — remove before PROMPT 08
// Pre-load inventory with explosive for sequence testing.
updateState({
  inventory: ['FLASHLIGHT', 'EXPLOSIVE'],
  activeSlot: 1,
});
updateQuickSlots();

// Press P to trigger plant sequence manually.
// This simulates being at the portal.
window.addEventListener('keydown', (event) => {
  if (event.key === 'p' || event.key === 'P') {
    startPlantSequence();
  }
});
// Test full sequence: P → E to confirm → watch all phases
// Test cancel: P → ESC → verify HUD returns
// Test fear elevation persists after cancel

function animate() {
  if (!GameState.isInspecting) {
    updateStealthIndicator();
    updateFearMeter(GameState.fear);
  }

  updateVignette(GameState.fear);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };
