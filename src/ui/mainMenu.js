import { updateState } from '../systems/state.js';
import { startGameSystems } from '../main.js';

const MENU_OPTIONS = ['start', 'howto', 'credits'];
const TAGLINE_TEXT = 'They came through the gate.';
const TYPEWRITER_DELAY_MS = 30;

let selectedIndex = 0;
let menuInteractive = false;
let currentMenuState = 'MAIN';
let navigationBound = false;
let taglineIntervalId = null;

function getMenuOptions() {
  return [...document.querySelectorAll('.menu-option')];
}

function getSelectedOption() {
  return getMenuOptions()[selectedIndex] ?? null;
}

function typewriterEffect(element, text) {
  let characterIndex = 0;

  if (!element) {
    return;
  }

  if (taglineIntervalId) {
    window.clearInterval(taglineIntervalId);
    taglineIntervalId = null;
  }

  element.textContent = '';
  taglineIntervalId = window.setInterval(() => {
    element.textContent += text.charAt(characterIndex);
    characterIndex++;

    if (characterIndex >= text.length) {
      window.clearInterval(taglineIntervalId);
      taglineIntervalId = null;
    }
  }, TYPEWRITER_DELAY_MS);
}

function updateMenuSelection() {
  getMenuOptions().forEach((option, index) => {
    const isSelected = index === selectedIndex;

    option.classList.toggle('selected', isSelected);
    option.classList.toggle('dimmed', !isSelected);
  });
}

function showSubscreen(name) {
  const nav = document.getElementById('menu-nav');
  const titleBlock = document.getElementById('menu-title-block');
  const subscreen = document.getElementById(`menu-${name}`);

  if (!subscreen) {
    return;
  }

  currentMenuState = name.toUpperCase();
  nav?.classList.add('hidden');
  titleBlock?.classList.add('hidden');
  subscreen.classList.add('active');
}

function closeSubscreen() {
  const nav = document.getElementById('menu-nav');
  const titleBlock = document.getElementById('menu-title-block');

  document.querySelectorAll('.menu-subscreen').forEach((subscreen) => {
    subscreen.classList.remove('active');
  });

  currentMenuState = 'MAIN';
  nav?.classList.remove('hidden');
  titleBlock?.classList.remove('hidden');
}

function triggerMenuOption() {
  const selectedOption = getSelectedOption();
  const option = selectedOption?.dataset.option;

  if (option === 'start') {
    startGame();
  } else if (option === 'howto') {
    showSubscreen('howto');
  } else if (option === 'credits') {
    showSubscreen('credits');
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && currentMenuState !== 'MAIN') {
    event.preventDefault();
    closeSubscreen();
    return;
  }

  if (!menuInteractive || currentMenuState !== 'MAIN') {
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedIndex = (selectedIndex - 1 + MENU_OPTIONS.length) % MENU_OPTIONS.length;
    updateMenuSelection();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedIndex = (selectedIndex + 1) % MENU_OPTIONS.length;
    updateMenuSelection();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    triggerMenuOption();
  }
}

function handlePointerSelect(option, index) {
  if (!menuInteractive || currentMenuState !== 'MAIN') {
    return;
  }

  selectedIndex = index;
  updateMenuSelection();
  option.focus();
}

// Injects the full-screen main menu shell before the HUD.
function initMainMenu() {
  let menu = document.getElementById('main-menu');

  if (menu) {
    return menu;
  }

  menu = document.createElement('div');
  menu.id = 'main-menu';
  menu.innerHTML = `
    <div id="menu-scanlines"></div>
    <div id="menu-vignette"></div>
    <div id="menu-fog">
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
      <div class="fog-particle"></div>
    </div>

    <div id="menu-title-block">
      <div id="menu-title">
        <span class="title-red">NIGHTMARE</span>
        <span class="title-space"> </span>
        <span class="title-white">MALL</span>
      </div>
      <div id="menu-tagline"></div>
    </div>

    <div id="menu-nav">
      <div class="menu-option" data-option="start" tabindex="0">
        <span class="option-bracket">[</span>
        <span class="option-text">START</span>
        <span class="option-bracket">]</span>
      </div>
      <div class="menu-option" data-option="howto" tabindex="0">
        <span class="option-bracket">[</span>
        <span class="option-text">HOW TO PLAY</span>
        <span class="option-bracket">]</span>
      </div>
      <div class="menu-option" data-option="credits" tabindex="0">
        <span class="option-bracket">[</span>
        <span class="option-text">CREDITS</span>
        <span class="option-bracket">]</span>
      </div>
    </div>

    <div id="menu-howto" class="menu-subscreen">
      <div class="subscreen-title">HOW TO PLAY</div>
      <div class="subscreen-content">
        <div class="howto-row">
          <span class="howto-key">W A S D</span>
          <span class="howto-desc">Move</span>
        </div>
        <div class="howto-row">
          <span class="howto-key">MOUSE</span>
          <span class="howto-desc">Look around</span>
        </div>
        <div class="howto-row">
          <span class="howto-key">E</span>
          <span class="howto-desc">Interact / Pick up</span>
        </div>
        <div class="howto-row">
          <span class="howto-key">TAB</span>
          <span class="howto-desc">Inspect item</span>
        </div>
        <div class="howto-row">
          <span class="howto-key">1 2 3 4</span>
          <span class="howto-desc">Select item slot</span>
        </div>
        <div class="howto-row">
          <span class="howto-key">ESC</span>
          <span class="howto-desc">Pause</span>
        </div>
        <div class="howto-divider"></div>
        <div class="howto-objective">
          Find the explosive. Plant it at the portal.
          Get out before it closes.
          Do not get caught.
        </div>
      </div>
      <div class="subscreen-back">[ ESC ] Back</div>
    </div>

    <div id="menu-credits" class="menu-subscreen">
      <div class="subscreen-title">CREDITS</div>
      <div class="subscreen-content">
        <div class="credits-row">
          <span class="credits-role">DESIGN &amp; DEV</span>
          <span class="credits-name">Nightmare Mall Team</span>
        </div>
        <div class="credits-row">
          <span class="credits-role">ENGINE</span>
          <span class="credits-name">Three.js</span>
        </div>
        <div class="credits-row">
          <span class="credits-role">INSPIRED BY</span>
          <span class="credits-name">Stranger Things</span>
        </div>
        <div class="credits-row">
          <span class="credits-role">BUILT WITH</span>
          <span class="credits-name">Vite + Vercel</span>
        </div>
      </div>
      <div class="subscreen-back">[ ESC ] Back</div>
    </div>
  `;

  const hud = document.getElementById('hud');
  document.body.insertBefore(menu, hud ?? null);

  return menu;
}

// Plays the first-load title, scanline, tagline, option, and fog sequence.
function playEntryAnimation() {
  const menu = document.getElementById('main-menu');
  const scanlines = document.getElementById('menu-scanlines');
  const titleBlock = document.getElementById('menu-title-block');
  const title = document.getElementById('menu-title');
  const tagline = document.getElementById('menu-tagline');
  const fog = document.getElementById('menu-fog');
  const options = getMenuOptions();

  if (!menu) {
    return;
  }

  menu.classList.remove('faded-out', 'hidden');
  menuInteractive = false;
  currentMenuState = 'MAIN';
  selectedIndex = 0;

  window.setTimeout(() => {
    scanlines?.classList.add('visible');
  }, 800);

  window.setTimeout(() => {
    titleBlock?.classList.add('visible');
    title?.classList.add('slam-in');
  }, 1500);

  window.setTimeout(() => {
    title?.classList.add('chromatic');
  }, 2200);

  window.setTimeout(() => {
    typewriterEffect(tagline, TAGLINE_TEXT);
  }, 2800);

  window.setTimeout(() => {
    updateMenuSelection();
    options.forEach((option, index) => {
      window.setTimeout(() => {
        option.classList.add('visible');
      }, index * 150);
    });
  }, 3800);

  window.setTimeout(() => {
    fog?.classList.add('active');
  }, 4200);

  window.setTimeout(() => {
    menuInteractive = true;
  }, 4500);
}

// Binds keyboard and pointer navigation for the main menu.
function setupMenuNavigation() {
  if (navigationBound) {
    return;
  }

  navigationBound = true;
  window.addEventListener('keydown', handleKeydown);
  getMenuOptions().forEach((option, index) => {
    option.addEventListener('mouseover', () => handlePointerSelect(option, index));
    option.addEventListener('click', () => {
      handlePointerSelect(option, index);

      if (menuInteractive && currentMenuState === 'MAIN') {
        triggerMenuOption();
      }
    });
  });
}

// Fades the menu away and starts the playable HUD/game systems.
function startGame() {
  const menu = document.getElementById('main-menu');

  if (!menu || !menuInteractive) {
    return;
  }

  menuInteractive = false;
  currentMenuState = 'STARTING';
  menu.classList.add('faded-out');

  window.setTimeout(() => {
    menu.classList.add('hidden');
    startGameSystems();
    const hud = document.getElementById('hud');

    if (hud) {
      hud.style.opacity = '1';
    }

    updateState({ isAlive: true });
    console.log('Game started — world init pending');
  }, 1000);
}

export {
  initMainMenu,
  playEntryAnimation,
  setupMenuNavigation,
  startGame,
};
