// Main engine API exports

// Core engine functions
export { processAction, processChoice, getPlayerLegalActions } from './state-machine.js';
export type { GameResult } from './state-machine.js';

// Game setup and initialization
export { initializeGame, validateGameSetup } from './game-setup.js';

// RNG system
export { DeterministicRng, createRng, shuffleCards } from './rng.js';

// Serialization
export { 
  serializeGame, 
  deserializeGame, 
  createSaveData, 
  loadSaveData,
  exportGameData,
  importGameData,
  getGameSummary
} from './serializer.js';
export type { SerializedGame, GameSummary } from './serializer.js';

// Legality checking
export { isActionLegal, getLegalActions } from './legality.js';
export type { LegalityResult } from './legality.js';

// Event system
export {
  emitDrewEvent,
  emitMeldedEvent,
  emitSplayedEvent,
  emitScoredEvent,
  emitDogmaActivatedEvent,
  emitAchievementClaimedEvent,
  getEventsByType,
  getEventsByPlayer,
  getRecentEvents
} from './events.js';


// Utilities
export { generateGameId, simpleHash, deepClone, getPlayerIconCount } from './utils.js';