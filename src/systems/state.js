const GameState = {
  fear: 0,
  isHidden: false,
  detectionLevel: 0,
  demonProximity: {
    north: 0,
    south: 0,
    east: 0,
    west: 0,
  },
  inventory: [],
  activeSlot: 0,
  objective: null,
  isAlive: true,
  explosivesPlanted: false,
  explosiveSpawnStoreId: null,
  explosiveSpawnStoreHistory: [],
  isPaused: false,
  isInspecting: false,
  flashlightOn: false,
  flashlightVisible: false,
  lighterOn: false,
  ropeUsed: false,
  radioThrown: false,
  difficulty: 'normal',
  loreNotesFound: [],
};

const ITEM_TYPES = {
  FLASHLIGHT: {
    name: 'FLASHLIGHT',
    icon: '🔦',
    description: 'Cuts through the dark. But the beam is visible. They can see it too. Use sparingly.',
    stackable: false,
  },
  LIGHTER: {
    name: 'LIGHTER',
    icon: '🔥',
    description: 'A small flame. Enough to read by. Not enough to run by. Silent, at least.',
    stackable: false,
  },
  RADIO: {
    name: 'RADIO',
    icon: '📻',
    description: 'Still picks up a signal. Throw it to draw them away. One use. Make it count.',
    stackable: false,
  },
  ROPE: {
    name: 'ROPE',
    icon: '🪢',
    description: 'Thirty feet of hardware store rope. Could get you to a roof. Could get you out.',
    stackable: false,
  },
  MEDKIT: {
    name: 'MEDKIT',
    icon: '🩹',
    description: 'Bandages, antiseptic, something that might be a sedative. Fear fades when you focus on the wound.',
    stackable: false,
  },
  EXPLOSIVE: {
    name: 'EXPLOSIVE',
    icon: '💥',
    description: 'This is it. This closes the portal. Plant it at the source and do not look back.',
    stackable: false,
  },
};

// Applies a partial state update and returns the current game state.
function updateState(patch) {
  const shouldNotifyStateListeners = [
    'inventory',
    'activeSlot',
    'difficulty',
    'loreNotesFound',
  ].some((key) => key in patch);

  Object.assign(GameState, patch);

  if (
    shouldNotifyStateListeners
    && typeof window !== 'undefined'
    && typeof CustomEvent === 'function'
  ) {
    window.dispatchEvent(new CustomEvent('game-state-updated', {
      detail: {
        patch,
        state: GameState,
      },
    }));
  }

  return GameState;
}

export { GameState, ITEM_TYPES, updateState };
