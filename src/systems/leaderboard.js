import { GameState } from './state.js';
import { getCurrentDifficulty } from './difficulty.js';

const LEADERBOARD_ENDPOINT = '/api/leaderboard';
const LOCAL_LEADERBOARD_KEY = 'nightmare-mall-leaderboard';
const MAX_LEADERBOARD_ENTRIES = 10;

let lastSourceLabel = 'LOCAL';

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeEntry(entry) {
  return {
    id: String(entry.id ?? `${Date.now()}-${Math.random()}`),
    name: String(entry.name ?? 'SURVIVOR').slice(0, 16).toUpperCase(),
    score: Number(entry.score) || 0,
    timeSeconds: Number(entry.timeSeconds) || 0,
    itemsFound: Number(entry.itemsFound) || 0,
    fear: Number(entry.fear) || 0,
    difficulty: String(entry.difficulty ?? 'NORMAL').toUpperCase(),
    outcome: String(entry.outcome ?? 'ESCAPED').toUpperCase(),
    createdAt: String(entry.createdAt ?? new Date().toISOString()),
  };
}

function sortEntries(entries) {
  return entries
    .map(normalizeEntry)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.timeSeconds - b.timeSeconds;
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

function getLocalEntries() {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    return sortEntries(JSON.parse(storage.getItem(LOCAL_LEADERBOARD_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

function saveLocalEntries(entries) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  storage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(sortEntries(entries)));
}

function calculateRunScore({ timeSeconds, itemsFound, fear, outcome }) {
  const difficulty = getCurrentDifficulty();
  const escapedBonus = outcome === 'ESCAPED' ? 1000 : 250;
  const itemBonus = itemsFound * 125;
  const fearPenalty = Math.round(fear * 4);
  const timePenalty = Math.min(900, Math.round(timeSeconds * 1.5));
  const rawScore = escapedBonus + itemBonus - fearPenalty - timePenalty;

  return Math.max(0, Math.round(rawScore * difficulty.leaderboardMultiplier));
}

function buildEntry(runStats) {
  const difficulty = getCurrentDifficulty();
  const timeSeconds = Number(runStats.timeSeconds) || 0;
  const itemsFound = Number(runStats.itemsFound) || 0;
  const fear = Math.round(Number(runStats.fear) || 0);
  const outcome = String(runStats.outcome ?? 'ESCAPED').toUpperCase();

  return normalizeEntry({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: runStats.name ?? 'SURVIVOR',
    score: calculateRunScore({
      timeSeconds,
      itemsFound,
      fear,
      outcome,
    }),
    timeSeconds,
    itemsFound,
    fear,
    difficulty: difficulty.label,
    outcome,
    createdAt: new Date().toISOString(),
  });
}

async function fetchRemoteEntries() {
  const response = await fetch(LEADERBOARD_ENDPOINT, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Leaderboard unavailable: ${response.status}`);
  }

  const payload = await response.json();

  return sortEntries(payload.entries ?? payload);
}

async function submitRemoteEntry(entry) {
  const response = await fetch(LEADERBOARD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error(`Leaderboard submit failed: ${response.status}`);
  }
}

// Loads the top leaderboard entries from Vercel KV when configured, otherwise local storage.
async function getLeaderboardEntries() {
  try {
    const remoteEntries = await fetchRemoteEntries();

    lastSourceLabel = 'VERCEL KV';
    return remoteEntries;
  } catch {
    lastSourceLabel = 'LOCAL';
    return getLocalEntries();
  }
}

// Stores a completed run in the leaderboard and mirrors it locally for offline play.
async function submitLeaderboardScore(runStats) {
  const entry = buildEntry({
    ...runStats,
    fear: runStats.fear ?? GameState.fear,
  });
  const localEntries = getLocalEntries();

  saveLocalEntries([...localEntries, entry]);

  try {
    await submitRemoteEntry(entry);
    lastSourceLabel = 'VERCEL KV';
  } catch {
    lastSourceLabel = 'LOCAL';
  }

  return entry;
}

// Returns the source label for the most recent leaderboard operation.
function getLeaderboardSourceLabel() {
  return lastSourceLabel;
}

export {
  getLeaderboardEntries,
  getLeaderboardSourceLabel,
  submitLeaderboardScore,
};
