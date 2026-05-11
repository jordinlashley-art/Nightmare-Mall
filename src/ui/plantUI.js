import { GameState, updateState } from '../systems/state.js';
import { updateFearMeter } from './hud.js';
import { updateVignette } from './overlay.js';

const ARMING_DURATION_MS = 4000;
const ARMED_HOLD_MS = 500;
const COUNTDOWN_STEP_MS = 1000;
const DETECTION_UPDATE_MS = 100;
const RING_CIRCUMFERENCE = 339.3;
const PLANT_PHASES = {
  IDLE: 'idle',
  CONFIRM: 'confirm',
  ARMING: 'arming',
  COMPLETE: 'complete',
};

let plantPhase = PLANT_PHASES.IDLE;
let confirmKeydownHandler = null;
let armingFrameId = null;
let detectionIntervalId = null;

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function getPlantElements() {
  return {
    hud: document.getElementById('hud'),
    plantUI: document.getElementById('plant-ui'),
    plantConfirm: document.getElementById('plant-confirm'),
    plantArming: document.getElementById('plant-arming'),
    plantCountdown: document.getElementById('plant-countdown'),
    armingLabel: document.getElementById('arming-label'),
    ringProgress: document.getElementById('ring-progress'),
    armingCenterText: document.getElementById('arming-center-text'),
    countdownNumber: document.getElementById('countdown-number'),
  };
}

function setActivePhase(activePhaseId) {
  const { plantConfirm, plantArming, plantCountdown } = getPlantElements();

  [plantConfirm, plantArming, plantCountdown].forEach((phaseElement) => {
    phaseElement?.classList.toggle('active', phaseElement.id === activePhaseId);
  });
}

function cleanupConfirmListeners() {
  if (!confirmKeydownHandler) {
    return;
  }

  window.removeEventListener('keydown', confirmKeydownHandler);
  confirmKeydownHandler = null;
}

function stopArmingTimers() {
  if (armingFrameId) {
    window.cancelAnimationFrame(armingFrameId);
    armingFrameId = null;
  }

  stopDetectionTimer();
}

function stopDetectionTimer() {
  if (!detectionIntervalId) {
    return;
  }

  window.clearInterval(detectionIntervalId);
  detectionIntervalId = null;
}

function resetPlantUI() {
  const {
    plantUI,
    armingLabel,
    ringProgress,
    armingCenterText,
    countdownNumber,
  } = getPlantElements();

  setActivePhase(null);
  plantUI?.classList.remove('active', 'screen-edge-pulse');
  document.body.classList.remove('plant-screen-shake');

  if (armingLabel) {
    armingLabel.textContent = 'ARMING...';
  }

  if (ringProgress) {
    ringProgress.setAttribute('stroke', '#ff2200');
    ringProgress.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));
  }

  if (armingCenterText) {
    armingCenterText.textContent = '4';
  }

  if (countdownNumber) {
    countdownNumber.textContent = '3';
    countdownNumber.classList.remove('slam-in');
  }
}

function showPlantShell() {
  const { hud, plantUI } = getPlantElements();

  hud?.classList.add('hud-hidden');
  plantUI?.classList.add('active');
}

function flashScreenEdge() {
  const { plantUI } = getPlantElements();

  if (!plantUI) {
    return;
  }

  plantUI.classList.remove('screen-edge-pulse');
  void plantUI.offsetWidth;
  plantUI.classList.add('screen-edge-pulse');
}

function animateArmingRing() {
  const { ringProgress, armingCenterText } = getPlantElements();
  const startedAt = performance.now();

  return new Promise((resolve) => {
    function tick(now) {
      const elapsed = Math.min(ARMING_DURATION_MS, now - startedAt);
      const progress = elapsed / ARMING_DURATION_MS;
      const remainingSeconds = Math.max(1, Math.ceil((ARMING_DURATION_MS - elapsed) / 1000));

      ringProgress?.setAttribute(
        'stroke-dashoffset',
        String(RING_CIRCUMFERENCE * (1 - progress)),
      );

      if (armingCenterText) {
        armingCenterText.textContent = String(remainingSeconds);
      }

      if (elapsed >= ARMING_DURATION_MS) {
        ringProgress?.setAttribute('stroke-dashoffset', '0');
        armingFrameId = null;
        resolve();
        return;
      }

      armingFrameId = window.requestAnimationFrame(tick);
    }

    armingFrameId = window.requestAnimationFrame(tick);
  });
}

function rampDetectionLevel() {
  const startedAt = performance.now();

  updateState({ detectionLevel: 0 });

  detectionIntervalId = window.setInterval(() => {
    const elapsed = Math.min(ARMING_DURATION_MS, performance.now() - startedAt);
    const detectionLevel = Math.round((elapsed / ARMING_DURATION_MS) * 100);

    updateState({ detectionLevel });

    if (elapsed >= ARMING_DURATION_MS) {
      stopDetectionTimer();
      updateState({ detectionLevel: 100 });
    }
  }, DETECTION_UPDATE_MS);
}

async function runArmingPhase() {
  const { armingLabel, ringProgress } = getPlantElements();

  plantPhase = PLANT_PHASES.ARMING;
  cleanupConfirmListeners();
  setActivePhase('plant-arming');
  updateVignette(100);
  rampDetectionLevel();
  await animateArmingRing();
  stopDetectionTimer();
  updateState({ detectionLevel: 100 });

  if (armingLabel) {
    armingLabel.textContent = 'ARMED';
  }

  ringProgress?.setAttribute('stroke', 'var(--color-safe)');
  await wait(ARMED_HOLD_MS);
}

function fireCountdownImpact() {
  const { countdownNumber } = getPlantElements();

  if (countdownNumber) {
    countdownNumber.classList.remove('slam-in');
    void countdownNumber.offsetWidth;
    countdownNumber.classList.add('slam-in');
  }

  document.body.classList.remove('plant-screen-shake');
  void document.body.offsetWidth;
  document.body.classList.add('plant-screen-shake');
}

async function runCountdownPhase() {
  const { countdownNumber } = getPlantElements();

  setActivePhase('plant-countdown');
  updateState({ fear: 100 });
  updateFearMeter(GameState.fear);
  updateVignette(100);

  for (let count = 3; count >= 1; count--) {
    if (countdownNumber) {
      countdownNumber.textContent = String(count);
    }

    fireCountdownImpact();
    await wait(COUNTDOWN_STEP_MS);
  }
}

function resolvePlantSequence() {
  completeObjective();
  console.log('SEQUENCE COMPLETE — WIN/DEATH screen pending');
  plantPhase = PLANT_PHASES.COMPLETE;
}

// Initializes the explosive planting UI overlay.
function initPlantUI() {
  let plantUI = document.getElementById('plant-ui');

  if (!plantUI) {
    plantUI = document.createElement('div');
    plantUI.id = 'plant-ui';
    plantUI.innerHTML = `
      <div id="plant-confirm">
        <div id="plant-confirm-icon">💥</div>
        <div id="plant-confirm-title">PLANT EXPLOSIVE?</div>
        <div id="plant-confirm-subtitle">
          There is no going back.
        </div>
        <div id="plant-confirm-actions">
          <div class="plant-action confirm">
            <span class="action-key">E</span>
            <span class="action-label">CONFIRM</span>
          </div>
          <div class="plant-action cancel">
            <span class="action-key">ESC</span>
            <span class="action-label">CANCEL</span>
          </div>
        </div>
      </div>

      <div id="plant-arming">
        <div id="arming-label">ARMING...</div>
        <div id="arming-ring-container">
          <svg id="arming-ring-svg" viewBox="0 0 120 120" width="180" height="180">
            <circle id="ring-track"
              cx="60" cy="60" r="54"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              stroke-width="4"/>
            <circle id="ring-progress"
              cx="60" cy="60" r="54"
              fill="none"
              stroke="#ff2200"
              stroke-width="4"
              stroke-linecap="round"
              stroke-dasharray="339.3"
              stroke-dashoffset="339.3"
              transform="rotate(-90 60 60)"/>
          </svg>
          <div id="arming-center-text">4</div>
        </div>
      </div>

      <div id="plant-countdown">
        <div id="countdown-label">GET OUT</div>
        <div id="countdown-number">3</div>
      </div>
    `;

    const hud = document.getElementById('hud');
    document.body.insertBefore(plantUI, hud ?? null);
  }

  resetPlantUI();
  return plantUI;
}

// Starts the five-phase explosive planting sequence.
async function startPlantSequence() {
  if (plantPhase !== PLANT_PHASES.IDLE || !GameState.inventory.includes('EXPLOSIVE')) {
    return false;
  }

  plantPhase = PLANT_PHASES.CONFIRM;
  resetPlantUI();
  showPlantShell();
  setActivePhase('plant-confirm');
  updateState({ fear: Math.min(100, GameState.fear + 20) });
  updateFearMeter(GameState.fear);
  flashScreenEdge();

  const confirmed = await new Promise((resolve) => {
    confirmKeydownHandler = (event) => {
      const key = event.key.toLowerCase();

      if (event.repeat) {
        return;
      }

      if (key === 'e') {
        event.preventDefault();
        cleanupConfirmListeners();
        resolve(true);
      }

      if (key === 'escape') {
        event.preventDefault();
        cancelPlantSequence();
        resolve(false);
      }
    };

    window.addEventListener('keydown', confirmKeydownHandler);
  });

  if (!confirmed) {
    return false;
  }

  await runArmingPhase();
  await runCountdownPhase();
  resolvePlantSequence();
  return true;
}

// Cancels the plant prompt before the arming commitment begins.
function cancelPlantSequence() {
  cleanupConfirmListeners();
  stopArmingTimers();
  resetPlantUI();
  getPlantElements().hud?.classList.remove('hud-hidden');
  updateState({ fear: GameState.fear });
  plantPhase = PLANT_PHASES.IDLE;
}

// Completes the portal objective and consumes the explosive.
function completeObjective() {
  const inventory = GameState.inventory.filter((itemName) => itemName !== 'EXPLOSIVE');

  updateState({ explosivesPlanted: true });
  updateState({ inventory });
  resetPlantUI();
  console.log('Objective complete. Portal sequence initiated.');
}

export {
  cancelPlantSequence,
  completeObjective,
  initPlantUI,
  startPlantSequence,
};
