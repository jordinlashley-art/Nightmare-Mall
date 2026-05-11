import { GameState, updateState } from './state.js';

const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

const DIFFICULTY_SETTINGS = {
  easy: {
    id: 'easy',
    label: 'EASY',
    demonSpeedMultiplier: 0.85,
    detectionMultiplier: 0.8,
    fearMultiplier: 0.75,
    leaderboardMultiplier: 0.85,
  },
  normal: {
    id: 'normal',
    label: 'NORMAL',
    demonSpeedMultiplier: 1,
    detectionMultiplier: 1,
    fearMultiplier: 1,
    leaderboardMultiplier: 1,
  },
  hard: {
    id: 'hard',
    label: 'HARD',
    demonSpeedMultiplier: 1.18,
    detectionMultiplier: 1.25,
    fearMultiplier: 1.3,
    leaderboardMultiplier: 1.25,
  },
};

function normalizeDifficultyId(id) {
  const difficultyId = String(id ?? '').toLowerCase();

  return DIFFICULTY_SETTINGS[difficultyId] ? difficultyId : 'normal';
}

// Returns the active difficulty tuning profile.
function getCurrentDifficulty() {
  return DIFFICULTY_SETTINGS[normalizeDifficultyId(GameState.difficulty)];
}

// Sets the active difficulty and emits a state update for interested UI.
function setDifficulty(id) {
  const difficulty = normalizeDifficultyId(id);

  updateState({ difficulty });
  return getCurrentDifficulty();
}

// Advances to the next difficulty option and returns the selected profile.
function cycleDifficulty(direction = 1) {
  const current = normalizeDifficultyId(GameState.difficulty);
  const currentIndex = DIFFICULTY_ORDER.indexOf(current);
  const nextIndex = (
    currentIndex
    + Math.sign(direction || 1)
    + DIFFICULTY_ORDER.length
  ) % DIFFICULTY_ORDER.length;

  return setDifficulty(DIFFICULTY_ORDER[nextIndex]);
}

// Returns all difficulty profiles in display order.
function getDifficultyOptions() {
  return DIFFICULTY_ORDER.map((id) => DIFFICULTY_SETTINGS[id]);
}

export {
  DIFFICULTY_SETTINGS,
  cycleDifficulty,
  getCurrentDifficulty,
  getDifficultyOptions,
  setDifficulty,
};
