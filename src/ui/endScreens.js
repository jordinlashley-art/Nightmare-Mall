import { GameState, ITEM_TYPES, updateState } from '../systems/state.js';
import { startGameSystems } from '../main.js';
import { initMainMenu, playEntryAnimation } from './mainMenu.js';

const DEATH_OPTIONS_COUNT = 2;
const WIN_OPTIONS_COUNT = 2;
const END_FADE_DURATION_MS = 500;

let runStats = {
  startTime: null,
  itemsFound: 0,
  fearAtEnd: 0,
};

let deathIndex = 0;
let winIndex = 0;
let deathInteractive = false;
let winInteractive = false;
let navigationBound = false;
let deathSequenceActive = false;
let winSequenceActive = false;
let endTypewriterIntervalId = null;
let endTimeoutIds = [];

function scheduleEndTimeout(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    endTimeoutIds = endTimeoutIds.filter((id) => id !== timeoutId);
    callback();
  }, delay);

  endTimeoutIds.push(timeoutId);
  return timeoutId;
}

function clearEndTimers() {
  endTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  endTimeoutIds = [];

  if (endTypewriterIntervalId) {
    window.clearInterval(endTypewriterIntervalId);
    endTypewriterIntervalId = null;
  }
}

function getEndScreens() {
  return document.getElementById('end-screens');
}

function getDeathScreen() {
  return document.getElementById('death-screen');
}

function getWinScreen() {
  return document.getElementById('win-screen');
}

function getActiveScreenName() {
  if (deathSequenceActive || getDeathScreen()?.classList.contains('active')) {
    return 'death';
  }

  if (winSequenceActive || getWinScreen()?.classList.contains('active')) {
    return 'win';
  }

  return null;
}

function hideHUD() {
  const hud = document.getElementById('hud');

  if (hud) {
    hud.style.opacity = '0';
  }
}

function showHUD() {
  const hud = document.getElementById('hud');

  if (hud) {
    hud.classList.remove('hud-hidden');
    hud.style.opacity = '1';
  }
}

function showEndShell(screen) {
  const endScreens = initEndScreens();
  const deathScreen = getDeathScreen();
  const winScreen = getWinScreen();

  endScreens.style.transition = '';
  endScreens.style.opacity = '1';
  endScreens.classList.add('active');
  deathScreen?.classList.toggle('active', screen === 'death');
  winScreen?.classList.toggle('active', screen === 'win');
}

function hideEndShell() {
  const endScreens = getEndScreens();
  const deathScreen = getDeathScreen();
  const winScreen = getWinScreen();
  const winFog = document.getElementById('win-fog');
  const deathStatic = document.getElementById('death-static');

  endScreens?.classList.remove('active');
  deathScreen?.classList.remove('active');
  winScreen?.classList.remove('active');
  winFog?.classList.remove('active');
  deathStatic?.classList.remove('static-burst');

  if (endScreens) {
    endScreens.style.transition = '';
    endScreens.style.opacity = '1';
  }

  deathSequenceActive = false;
  winSequenceActive = false;
  deathInteractive = false;
  winInteractive = false;
}

function resetEndContent(screen) {
  const title = document.getElementById(`${screen}-title`);
  const sub = document.getElementById(`${screen}-sub`);
  const stats = document.getElementById(`${screen}-stats`);
  const options = document.getElementById(`${screen}-options`);
  const winFlash = document.getElementById('win-flash');
  const winFog = document.getElementById('win-fog');
  const deathStatic = document.getElementById('death-static');

  [title, stats, options].forEach((element) => {
    if (element) {
      element.style.opacity = '0';
    }
  });

  if (sub) {
    sub.textContent = '';
  }

  if (winFlash) {
    winFlash.style.transition = 'none';
    winFlash.style.opacity = '0';
  }

  winFog?.classList.remove('active');
  deathStatic?.classList.remove('static-burst');
}

function setElementOpacity(id, opacity, transition) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  if (transition) {
    element.style.transition = transition;
  }

  element.style.opacity = String(opacity);
}

function typewriterEffect(element, text, delay) {
  let characterIndex = 0;

  if (!element) {
    return;
  }

  if (endTypewriterIntervalId) {
    window.clearInterval(endTypewriterIntervalId);
    endTypewriterIntervalId = null;
  }

  element.textContent = '';
  endTypewriterIntervalId = window.setInterval(() => {
    element.textContent += text.charAt(characterIndex);
    characterIndex++;

    if (characterIndex >= text.length) {
      window.clearInterval(endTypewriterIntervalId);
      endTypewriterIntervalId = null;
    }
  }, delay);
}

function populateStats(screen) {
  const time = document.getElementById(`${screen}-stat-time`);
  const items = document.getElementById(`${screen}-stat-items`);
  const fear = document.getElementById(`${screen}-stat-fear`);

  if (time) {
    time.textContent = getFormattedTime();
  }

  if (items) {
    items.textContent = String(runStats.itemsFound);
  }

  if (fear) {
    fear.textContent = `${Math.round(runStats.fearAtEnd)}%`;
  }
}

function resetGameState() {
  updateState({
    fear: 0,
    isHidden: false,
    detectionLevel: 0,
    inventory: [],
    activeSlot: 0,
    objective: null,
    isAlive: true,
    explosivesPlanted: false,
    playerReachedExit: false,
    isPaused: false,
    isInspecting: false,
    demonProximity: {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
    },
  });
}

function resetGameplayUIForNextRun() {
  const pauseMenu = document.getElementById('pause-menu');
  const inspectOverlay = document.getElementById('inspect-overlay');
  const plantUI = document.getElementById('plant-ui');
  const canvas = document.querySelector('canvas');

  pauseMenu?.classList.remove('active');
  plantUI?.classList.remove('active');
  document.body.classList.remove('plant-screen-shake');

  if (inspectOverlay) {
    inspectOverlay.style.opacity = '0';
    inspectOverlay.style.visibility = 'hidden';
  }

  if (canvas) {
    canvas.style.opacity = '1';
  }
}

function hideMainMenuForRun() {
  const mainMenu = document.getElementById('main-menu');

  if (mainMenu) {
    mainMenu.classList.add('faded-out', 'hidden');
  }
}

function fadeEndScreens(callback) {
  const endScreens = getEndScreens();

  if (!endScreens) {
    callback();
    return;
  }

  deathInteractive = false;
  winInteractive = false;
  endScreens.style.transition = `opacity ${END_FADE_DURATION_MS}ms ease`;
  endScreens.style.opacity = '0';

  scheduleEndTimeout(() => {
    hideEndShell();
    callback();
  }, END_FADE_DURATION_MS);
}

function updateDeathSelection(index) {
  const options = [...document.querySelectorAll('#death-options .end-option')];

  deathIndex = (index + DEATH_OPTIONS_COUNT) % DEATH_OPTIONS_COUNT;
  options.forEach((option, optionIndex) => {
    const isSelected = optionIndex === deathIndex;

    option.classList.toggle('selected', isSelected);
    option.classList.toggle('dimmed', !isSelected);
  });
}

function updateWinSelection(index) {
  const options = [...document.querySelectorAll('#win-options .end-option')];

  winIndex = (index + WIN_OPTIONS_COUNT) % WIN_OPTIONS_COUNT;
  options.forEach((option, optionIndex) => {
    const isSelected = optionIndex === winIndex;

    option.classList.toggle('selected', isSelected);
    option.classList.toggle('dimmed', !isSelected);
  });
}

function triggerEndOption(action, screen) {
  const isInteractive = screen === 'death' ? deathInteractive : winInteractive;

  if (!isInteractive) {
    return;
  }

  clearEndTimers();
  fadeEndScreens(() => {
    resetGameState();
    resetGameplayUIForNextRun();

    if (action === 'restart') {
      hideMainMenuForRun();
      startGameSystems();
      initRunStats();
      showHUD();
      return;
    }

    hideHUD();
    initMainMenu();
    playEntryAnimation();
  });
}

function handleKeydown(event) {
  if (event.repeat) {
    return;
  }

  const activeScreenName = getActiveScreenName();

  if (!activeScreenName) {
    return;
  }

  if (activeScreenName === 'death' && !deathInteractive) {
    return;
  }

  if (activeScreenName === 'win' && !winInteractive) {
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();

    if (activeScreenName === 'death') {
      updateDeathSelection(deathIndex - 1);
    } else {
      updateWinSelection(winIndex - 1);
    }
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();

    if (activeScreenName === 'death') {
      updateDeathSelection(deathIndex + 1);
    } else {
      updateWinSelection(winIndex + 1);
    }
  } else if (event.key === 'Enter') {
    const selector = activeScreenName === 'death' ? '#death-options' : '#win-options';
    const selectedIndex = activeScreenName === 'death' ? deathIndex : winIndex;
    const selectedOption = document.querySelectorAll(`${selector} .end-option`)[selectedIndex];

    event.preventDefault();
    triggerEndOption(selectedOption?.dataset.action, activeScreenName);
  }
}

function bindOptionEvents(screen) {
  const selector = `#${screen}-options .end-option`;

  document.querySelectorAll(selector).forEach((option, index) => {
    option.addEventListener('mouseover', () => {
      if (screen === 'death' && deathInteractive) {
        updateDeathSelection(index);
      }

      if (screen === 'win' && winInteractive) {
        updateWinSelection(index);
      }
    });

    option.addEventListener('click', () => {
      if (screen === 'death') {
        updateDeathSelection(index);
      } else {
        updateWinSelection(index);
      }

      triggerEndOption(option.dataset.action, screen);
    });
  });
}

// Starts a fresh run timer and clears per-run end-screen stats.
function initRunStats() {
  runStats.startTime = Date.now();
  runStats.itemsFound = 0;
  runStats.fearAtEnd = 0;
}

// Records a successful item pickup for resolution screen stats.
function incrementItemsFound() {
  runStats.itemsFound++;
}

// Returns the elapsed run time formatted as M:SS.
function getFormattedTime() {
  const startedAt = runStats.startTime ?? Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Injects the death and win screen DOM shells into the document body.
function initEndScreens() {
  let endScreens = getEndScreens();

  if (endScreens) {
    return endScreens;
  }

  endScreens = document.createElement('div');
  endScreens.id = 'end-screens';
  endScreens.innerHTML = `
    <div id="death-screen" class="end-screen">
      <div id="death-scanlines"></div>
      <div id="death-vignette"></div>
      <div id="death-static"></div>

      <div id="death-content">
        <div id="death-title">YOU WERE FOUND</div>
        <div id="death-sub"></div>

        <div id="death-stats" class="stats-block">
          <div class="stat-row">
            <span class="stat-label">TIME SURVIVED</span>
            <span id="death-stat-time" class="stat-value">0:00</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">ITEMS FOUND</span>
            <span id="death-stat-items" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">FEAR AT DEATH</span>
            <span id="death-stat-fear" class="stat-value">0%</span>
          </div>
        </div>

        <div id="death-options" class="end-options">
          <div class="end-option selected" data-action="restart">
            <span class="option-bracket">[</span>
            <span class="option-text">TRY AGAIN</span>
            <span class="option-bracket">]</span>
          </div>
          <div class="end-option" data-action="menu">
            <span class="option-bracket">[</span>
            <span class="option-text">QUIT TO MENU</span>
            <span class="option-bracket">]</span>
          </div>
        </div>
      </div>
    </div>

    <div id="win-screen" class="end-screen">
      <div id="win-scanlines"></div>
      <div id="win-vignette"></div>
      <div id="win-flash"></div>
      <div id="win-fog">
        <div class="win-fog-particle"></div>
        <div class="win-fog-particle"></div>
        <div class="win-fog-particle"></div>
        <div class="win-fog-particle"></div>
      </div>

      <div id="win-content">
        <div id="win-title">YOU GOT OUT</div>
        <div id="win-sub"></div>

        <div id="win-stats" class="stats-block">
          <div class="stat-row">
            <span class="stat-label">TIME SURVIVED</span>
            <span id="win-stat-time" class="stat-value">0:00</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">ITEMS COLLECTED</span>
            <span id="win-stat-items" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">FEAR AT END</span>
            <span id="win-stat-fear" class="stat-value">0%</span>
          </div>
        </div>

        <div id="win-options" class="end-options">
          <div class="end-option selected" data-action="restart">
            <span class="option-bracket">[</span>
            <span class="option-text">PLAY AGAIN</span>
            <span class="option-bracket">]</span>
          </div>
          <div class="end-option" data-action="menu">
            <span class="option-bracket">[</span>
            <span class="option-text">QUIT TO MENU</span>
            <span class="option-bracket">]</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(endScreens);
  updateDeathSelection(0);
  updateWinSelection(0);
  return endScreens;
}

// Runs the sudden death ending sequence and enables its options.
function triggerDeathScreen() {
  if (deathSequenceActive) {
    return;
  }

  clearEndTimers();
  deathSequenceActive = true;
  winSequenceActive = false;
  deathInteractive = false;
  winInteractive = false;
  deathIndex = 0;
  runStats.fearAtEnd = GameState.fear;
  updateState({ isAlive: false });
  hideHUD();
  showEndShell('death');
  resetEndContent('death');
  updateDeathSelection(0);

  const deathScreen = getDeathScreen();
  const deathStatic = document.getElementById('death-static');

  if (deathScreen) {
    deathScreen.style.background = '#000000';
  }

  scheduleEndTimeout(() => {
    deathStatic?.classList.add('static-burst');
    scheduleEndTimeout(() => {
      deathStatic?.classList.remove('static-burst');
    }, 700);
  }, 300);

  scheduleEndTimeout(() => {
    setElementOpacity('death-title', 1, 'opacity 0.8s ease');
  }, 1000);

  scheduleEndTimeout(() => {
    typewriterEffect(
      document.getElementById('death-sub'),
      'The mall has gone quiet again.',
      30,
    );
  }, 2000);

  scheduleEndTimeout(() => {
    populateStats('death');
    setElementOpacity('death-stats', 1, 'opacity 0.6s ease');
  }, 3500);

  scheduleEndTimeout(() => {
    setElementOpacity('death-options', 1, 'opacity 0.5s ease');
    deathInteractive = true;
  }, 5000);
}

// Runs the escape ending sequence and enables its options.
function triggerWinScreen() {
  if (winSequenceActive) {
    return;
  }

  clearEndTimers();
  winSequenceActive = true;
  deathSequenceActive = false;
  winInteractive = false;
  deathInteractive = false;
  winIndex = 0;
  runStats.fearAtEnd = GameState.fear;
  updateState({ explosivesPlanted: true });
  hideHUD();
  showEndShell('win');
  resetEndContent('win');
  updateWinSelection(0);

  const winFlash = document.getElementById('win-flash');
  const winFog = document.getElementById('win-fog');

  if (winFlash) {
    winFlash.style.transition = 'none';
    winFlash.style.opacity = '1';
  }

  scheduleEndTimeout(() => {
    if (winFlash) {
      winFlash.style.transition = 'opacity 1s ease';
      winFlash.style.opacity = '0';
    }
  }, 500);

  scheduleEndTimeout(() => {
    setElementOpacity('win-title', 1, 'opacity 1.2s ease');
  }, 2000);

  scheduleEndTimeout(() => {
    typewriterEffect(
      document.getElementById('win-sub'),
      "The portal is closed. Whatever came through... didn't follow you.",
      35,
    );
  }, 3000);

  scheduleEndTimeout(() => {
    populateStats('win');
    setElementOpacity('win-stats', 1, 'opacity 0.6s ease');
    winFog?.classList.add('active');
  }, 5000);

  scheduleEndTimeout(() => {
    setElementOpacity('win-options', 1, 'opacity 0.5s ease');
    winInteractive = true;
  }, 7000);
}

// Binds keyboard and pointer navigation for both resolution screens.
function setupEndNavigation() {
  initEndScreens();

  if (navigationBound) {
    return;
  }

  navigationBound = true;
  window.addEventListener('keydown', handleKeydown);
  bindOptionEvents('death');
  bindOptionEvents('win');
}

// Returns whether the death screen is active.
function isDeathScreenActive() {
  return deathSequenceActive || Boolean(getDeathScreen()?.classList.contains('active'));
}

// Returns whether the win screen is active.
function isWinScreenActive() {
  return winSequenceActive || Boolean(getWinScreen()?.classList.contains('active'));
}

export {
  getFormattedTime,
  incrementItemsFound,
  initEndScreens,
  initRunStats,
  isDeathScreenActive,
  isWinScreenActive,
  runStats,
  setupEndNavigation,
  triggerDeathScreen,
  triggerWinScreen,
};
