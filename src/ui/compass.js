import { GameState, updateState } from '../systems/state.js';
import { updateFearMeter } from './hud.js';

const DIRECTIONS = ['north', 'south', 'east', 'west'];
const TIER_CLASSES = ['threat-low', 'threat-med', 'threat-high'];
const prevTiers = {
  north: null,
  south: null,
  east: null,
  west: null,
};
const animatingDirections = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const pulseTimeouts = {
  north: null,
  south: null,
  east: null,
  west: null,
};

function getHUDContainer() {
  let hud = document.getElementById('hud');

  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    document.body.appendChild(hud);
  }

  return hud;
}

function clampThreat(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numericValue));
}

function getThreatTier(threat) {
  if (threat >= 67) {
    return 'HIGH';
  }

  if (threat >= 34) {
    return 'MED';
  }

  if (threat >= 1) {
    return 'LOW';
  }

  return 'NONE';
}

function applyTierClass(indicator, direction, tier) {
  if (prevTiers[direction] === tier) {
    return;
  }

  indicator.classList.remove(...TIER_CLASSES, 'inward-pulse');

  if (tier === 'LOW') {
    indicator.classList.add('threat-low');
  } else if (tier === 'MED') {
    indicator.classList.add('threat-med');
  } else if (tier === 'HIGH') {
    indicator.classList.add('threat-high');
  }
}

function fireInwardPulse(indicator, direction) {
  if (animatingDirections[direction]) {
    return;
  }

  animatingDirections[direction] = true;
  indicator.classList.add('inward-pulse');

  if (pulseTimeouts[direction]) {
    window.clearTimeout(pulseTimeouts[direction]);
  }

  pulseTimeouts[direction] = window.setTimeout(() => {
    indicator.classList.remove('inward-pulse');
    animatingDirections[direction] = false;
    pulseTimeouts[direction] = null;
  }, 600);
}

function applyFearBleed(highThreatCount) {
  if (highThreatCount === 0) {
    return;
  }

  const nextFear = Math.min(100, GameState.fear + (0.3 * highThreatCount));

  updateState({ fear: nextFear });
  updateFearMeter(nextFear);
}

// Initializes the proximity danger compass indicators.
function initCompass() {
  const hud = getHUDContainer();
  let compass = document.getElementById('compass');

  if (!compass) {
    compass = document.createElement('div');
    compass.id = 'compass';
    compass.innerHTML = `
      <div class="compass-indicator" id="compass-north" data-direction="north">
        <div class="compass-arrow">▼</div>
        <div class="compass-distance"></div>
      </div>
      <div class="compass-indicator" id="compass-south" data-direction="south">
        <div class="compass-arrow">▲</div>
        <div class="compass-distance"></div>
      </div>
      <div class="compass-indicator" id="compass-east" data-direction="east">
        <div class="compass-distance"></div>
        <div class="compass-arrow">◄</div>
      </div>
      <div class="compass-indicator" id="compass-west" data-direction="west">
        <div class="compass-arrow">►</div>
        <div class="compass-distance"></div>
      </div>
    `;
    hud.appendChild(compass);
  }

  updateCompass();
  return compass;
}

// Updates compass indicators from current demon proximity levels.
function updateCompass() {
  let highThreatCount = 0;

  DIRECTIONS.forEach((direction) => {
    const indicator = document.getElementById(`compass-${direction}`);
    const distance = indicator?.querySelector('.compass-distance');
    const threat = clampThreat(GameState.demonProximity?.[direction] ?? 0);
    const tier = getThreatTier(threat);

    if (tier === 'HIGH') {
      highThreatCount++;
    }

    if (!indicator || !distance) {
      return;
    }

    applyTierClass(indicator, direction, tier);

    if (tier === 'NONE') {
      indicator.style.opacity = '0';
      distance.textContent = '';
    } else if (tier === 'LOW') {
      indicator.style.opacity = '0.3';
      distance.textContent = '';
    } else if (tier === 'MED') {
      indicator.style.opacity = '0.6';
      distance.textContent = 'NEAR';
    } else if (tier === 'HIGH') {
      indicator.style.opacity = '1';
      distance.textContent = 'CLOSE';

      if (prevTiers[direction] !== 'HIGH') {
        fireInwardPulse(indicator, direction);
      }
    }

    prevTiers[direction] = tier;
  });

  applyFearBleed(highThreatCount);
}

// Sets demon proximity values and refreshes the danger compass.
function setDemonProximity(directionObj) {
  updateState({
    demonProximity: {
      ...GameState.demonProximity,
      ...directionObj,
    },
  });
  updateCompass();
}

export { initCompass, setDemonProximity, updateCompass };
