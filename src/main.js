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
import { GameState, updateState } from './systems/state.js';
import { onInspectHold } from './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initMenu();
initOverlay();

onInspectHold(
  () => openInspectOverlay(),
  () => closeInspectOverlay(),
);

// TEMP TEST - remove before PROMPT 07
// Pre-populate inventory for inspect testing.
updateState({
  inventory: ['FLASHLIGHT', 'RADIO', 'EXPLOSIVE'],
  activeSlot: 0,
});
updateQuickSlots();
// Hold TAB to inspect FLASHLIGHT (slot 1)
// Press 2, hold TAB to inspect RADIO
// Press 3, hold TAB to inspect EXPLOSIVE
// Press 4 (empty slot), hold TAB - overlay should NOT open

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
