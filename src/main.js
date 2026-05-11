import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import { initHUD, updateFearMeter, updateStealthIndicator } from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import { initVignette, updateVignette } from './ui/overlay.js';
import { GameState, updateState } from './systems/state.js';
import './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initMenu();
initVignette();

// TEMP TEST — remove before PROMPT 04
// Cycles through all 4 stealth states every 3 seconds
const stealthStates = [
  { isHidden: true, detectionLevel: 0 },
  { isHidden: false, detectionLevel: 15 },
  { isHidden: false, detectionLevel: 50 },
  { isHidden: false, detectionLevel: 90 },
];
let stealthTestIndex = 0;
setInterval(() => {
  updateState(stealthStates[stealthTestIndex % 4]);
  stealthTestIndex++;
}, 3000);

function animate() {
  updateStealthIndicator();
  updateFearMeter(GameState.fear);
  updateVignette(GameState.fear);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };
