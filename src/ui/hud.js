import './ui.css';
import { GameState, updateState } from '../systems/state.js';

const STEALTH_STATE_CLASSES = ['hidden-state', 'safe', 'detected', 'compromised'];

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

// Initializes the stealth detection indicator.
function initStealthIndicator() {
  const hud = initHUDContainer();
  let stealthIndicator = document.getElementById('stealth-indicator');

  if (!stealthIndicator) {
    stealthIndicator = document.createElement('div');
    stealthIndicator.id = 'stealth-indicator';
    stealthIndicator.innerHTML = `
      <div id="stealth-icon">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path id="eye-open" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle id="eye-pupil" cx="12" cy="12" r="3"></circle>
          <path id="eye-closed" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" hidden></path>
        </svg>
      </div>
      <div id="stealth-label">SAFE</div>
      <div id="stealth-bar-container">
        <div id="stealth-bar-fill"></div>
      </div>
    `;
    hud.appendChild(stealthIndicator);
  }

  updateStealthIndicator();
  return stealthIndicator;
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
  initStealthIndicator();

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

// Updates the stealth indicator display from detection and cover state.
function updateStealthIndicator() {
  const stealthIndicator = document.getElementById('stealth-indicator');
  const stealthLabel = document.getElementById('stealth-label');
  const stealthBarFill = document.getElementById('stealth-bar-fill');
  const eyeOpen = document.getElementById('eye-open');
  const eyePupil = document.getElementById('eye-pupil');
  const eyeClosed = document.getElementById('eye-closed');
  const detectionLevel = Math.min(
    100,
    Math.max(0, Number.isFinite(GameState.detectionLevel) ? GameState.detectionLevel : 0),
  );
  let stealthState = 'safe';
  let stealthLabelText = 'SAFE';

  if (GameState.isHidden) {
    stealthState = 'hidden-state';
    stealthLabelText = 'HIDDEN';
  } else if (detectionLevel >= 75) {
    stealthState = 'compromised';
    stealthLabelText = 'IT KNOWS';
  } else if (detectionLevel >= 26) {
    stealthState = 'detected';
    stealthLabelText = 'SEARCHING...';
  }

  if (stealthState === 'compromised') {
    updateState({ fear: Math.min(100, GameState.fear + 0.5) });
  }

  if (!stealthIndicator || !stealthLabel || !stealthBarFill || !eyeOpen || !eyePupil || !eyeClosed) {
    return;
  }

  stealthIndicator.classList.remove(...STEALTH_STATE_CLASSES);
  stealthIndicator.classList.add(stealthState);
  stealthLabel.textContent = stealthLabelText;
  stealthBarFill.style.width = `${detectionLevel}%`;

  eyeOpen.hidden = GameState.isHidden;
  eyePupil.hidden = GameState.isHidden;
  eyeClosed.hidden = !GameState.isHidden;
}

export { initHUD, updateFearMeter, updateStealthIndicator };
