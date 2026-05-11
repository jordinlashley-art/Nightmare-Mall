import { camera } from './core/camera.js';
import { renderer } from './core/renderer.js';
import { scene } from './core/scene.js';
import { initEnvironment } from './world/environment.js';
import { initHUD, updateFearMeter } from './ui/hud.js';
import { initMenu } from './ui/menu.js';
import { initVignette, updateVignette } from './ui/overlay.js';
import { GameState } from './systems/state.js';
import './systems/input.js';

document.body.appendChild(renderer.domElement);

initEnvironment(scene);
initHUD();
initMenu();
initVignette();

// TEMP TEST — remove before PROMPT 03
setInterval(() => {
  const nextFear = GameState.fear >= 100 ? 0 : GameState.fear + 1;
  updateFearMeter(nextFear);
}, 100);

function animate() {
  updateFearMeter(GameState.fear);
  updateVignette(GameState.fear);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

export { GameState };
