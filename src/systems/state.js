const GameState = {
  fear: 0,
  isHidden: false,
  detectionLevel: 0,
  inventory: [],
  activeSlot: 0,
  objective: null,
  isAlive: true,
  explosivesPlanted: false,
};

const ITEM_TYPES = {
  FLASHLIGHT: {
    name: 'FLASHLIGHT',
    icon: '🔦',
    description: 'Cuts through darkness. Demons can see the beam.',
    stackable: false,
  },
  LIGHTER: {
    name: 'LIGHTER',
    icon: '🔥',
    description: 'Small flame. Unreliable but silent.',
    stackable: false,
  },
  RADIO: {
    name: 'RADIO',
    icon: '📻',
    description: 'Creates noise. Use to distract.',
    stackable: false,
  },
  ROPE: {
    name: 'ROPE',
    icon: '🪢',
    description: 'Useful for climbing or binding.',
    stackable: false,
  },
  MEDKIT: {
    name: 'MEDKIT',
    icon: '🩹',
    description: 'Reduces fear. Limited uses.',
    stackable: false,
  },
  EXPLOSIVE: {
    name: 'EXPLOSIVE',
    icon: '💥',
    description: 'The objective. Plant at the hell portal.',
    stackable: false,
  },
};

// Applies a partial state update and returns the current game state.
function updateState(patch) {
  Object.assign(GameState, patch);

  if ('inventory' in patch && typeof window !== 'undefined' && typeof CustomEvent === 'function') {
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
