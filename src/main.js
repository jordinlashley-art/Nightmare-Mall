import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import { initHUD, updateFearMeter, updateStealthIndicator } from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import {
  hidePickupPrompt,
  initOverlay,
  showPickupPrompt,
  triggerPickup,
  updateVignette,
} from './ui/overlay.js';
import { GameState } from './systems/state.js';
import { onInteract } from './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initMenu();
initOverlay();

// TEMP TEST - remove before PROMPT 05
// Simulates walking near an item after 2 seconds
// Tests pickup, inventory full state, and hide behavior
const testItems = [
  'FLASHLIGHT',
  'LIGHTER',
  'RADIO',
  'ROPE',
  'MEDKIT',
];
let testItemIndex = 0;

setTimeout(() => {
  showPickupPrompt(testItems[testItemIndex]);

  onInteract(() => {
    const success = triggerPickup(testItems[testItemIndex]);

    if (success) {
      testItemIndex++;

      setTimeout(() => {
        if (testItems[testItemIndex]) {
          showPickupPrompt(testItems[testItemIndex]);
        } else {
          hidePickupPrompt();
        }
      }, 1000);
    }
  });
}, 2000);
// After 4 pickups inventory is full -
// 5th item should show INVENTORY FULL state

function animate() {
  updateStealthIndicator();
  updateFearMeter(GameState.fear);
  updateVignette(GameState.fear);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };
