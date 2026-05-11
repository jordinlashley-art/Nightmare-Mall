import './ui.css';
import { GameState, updateState } from '../systems/state.js';

function initFearMeter() {
  const hud = initHUDContainer();
  let fearMeter = document.getElementById('fear-meter');

  if (!fearMeter) {
    fearMeter = document.createElement('div');
    fearMeter.id = 'fear-meter';
    fearMeter.innerHTML = `
      <div id="fear-label">FEAR</div>
      <div id="fear-bar-container">
        <div id="fear-bar-fill"></div>
      </div>
      <div id="fear-value">0%</div>
    `;
    hud.appendChild(fearMeter);
  }

  updateFearMeter(GameState.fear);
  return fearMeter;
}

function initHUDContainer() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  return hud;
}

// Initializes the persistent heads-up display.
function initHUD() {
  const hud = initHUDContainer();
  initFearMeter();

  return hud;
}

// Updates the fear meter display and synchronizes the game state.
function updateFearMeter(fearValue) {
  const numericFear = Number(fearValue);
  const clampedFear = Math.min(
    100,
    Math.max(0, Number.isFinite(numericFear) ? numericFear : 0),
  );
  const fearMeter = document.getElementById('fear-meter');
  const fearBarFill = document.getElementById('fear-bar-fill');
  const fearValueDisplay = document.getElementById('fear-value');
  let fearState = 'calm';

  if (clampedFear >= 67) {
    fearState = 'terror';
  } else if (clampedFear >= 34) {
    fearState = 'anxious';
  }

  updateState({ fear: clampedFear });

  if (!fearMeter || !fearBarFill || !fearValueDisplay) {
    return;
  }

  fearBarFill.style.width = `${clampedFear}%`;
  fearValueDisplay.textContent = `${Math.round(clampedFear)}%`;
  fearMeter.classList.remove('calm', 'anxious', 'terror');
  fearMeter.classList.add(fearState);
}

export { initHUD, updateFearMeter };
