// Engine module exports

export { processAction, processChoice, getPlayerLegalActions } from './state-machine.js';
export { initializeGame } from './game-setup.js';
export { DeterministicRng } from './rng.js';
export { serializeGame, deserializeGame } from './serializer.js';
export { emitEvent } from './events.js';
export { isActionLegal, getLegalActions } from './legality.js';

// New Phase 3 exports
export { 
  drawCard, 
  meldCard, 
  scoreCard, 
  tuckCard, 
  splayColor, 
  transferCard, 
  returnCard,
  getTopCard,
  getTopCards,
  hasIcon,
  countIcons
} from './state-manipulation.js';

export { 
  registerCardEffect, 
  getCardEffectFunction, 
  processDogmaAction,
  createDogmaContext,
  executeDogmaEffect,
  resumeDogmaExecution
} from './dogma-resolver.js';

export { 
  compareIcons, 
  isPlayerAffected, 
  getAffectedPlayers,
  getHighestIconCount,
  getLowestIconCount
} from './symbol-comparison.js';


// Utilities
export { generateGameId, simpleHash, deepClone, getPlayerIconCount } from './utils.js';