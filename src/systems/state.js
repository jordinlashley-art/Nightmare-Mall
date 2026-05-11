const GameState = {
  fear: 0,
  isHidden: false,
  detectionLevel: 0,
  inventory: [],
  objective: null,
  isAlive: true,
  explosivesPlanted: false,
};

const ITEM_TYPES = {
  FLASHLIGHT: {
    name: 'FLASHLIGHT',
    description: 'Cuts through darkness. Demons can see the beam.',
    stackable: false,
  },
  LIGHTER: {
    name: 'LIGHTER',
    description: 'Small flame. Unreliable but silent.',
    stackable: false,
  },
  RADIO: {
    name: 'RADIO',
    description: 'Creates noise. Use to distract.',
    stackable: false,
  },
  ROPE: {
    name: 'ROPE',
    description: 'Useful for climbing or binding.',
    stackable: false,
  },
  MEDKIT: {
    name: 'MEDKIT',
    description: 'Reduces fear. Limited uses.',
    stackable: false,
  },
  EXPLOSIVE: {
    name: 'EXPLOSIVE',
    description: 'The objective. Plant at the hell portal.',
    stackable: false,
  },
};

// Applies a partial state update and returns the current game state.
function updateState(patch) {
  Object.assign(GameState, patch);
  return GameState;
}

export { GameState, ITEM_TYPES, updateState };
