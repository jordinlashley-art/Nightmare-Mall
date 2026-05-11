const GameState = {
  fear: 0,
  isHidden: false,
  detectionLevel: 0,
  inventory: [],
  objective: null,
  isAlive: true,
  explosivesPlanted: false,
};

function updateState(patch) {
  Object.assign(GameState, patch);
  return GameState;
}

export { GameState, updateState };
