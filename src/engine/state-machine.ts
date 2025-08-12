// Main state machine API for Innovation game engine

import type { GameData } from '@/types/game-data.js';
import type { Action } from '@/types/actions.js';
import type { Choice, ChoiceAnswer } from '@/types/choices.js';
import type { GameEvent } from '@/types/events.js';
import type { PlayerId } from '@/types/core.js';
import { isActionLegal, getLegalActions, advanceTurn, checkAchievementVictory } from './legality.js';
import { DeterministicRng } from './rng.js';
import { deepClone } from './utils.js';
import { emitEvent } from './events.js';
import { CARDS } from '@/cards/database.js';

// Result of processing an action or choice
export interface GameResult {
  readonly newState: GameData;
  readonly events: GameEvent[];
  readonly nextPhase: import('@/types/game-state.js').GameState;
  readonly pendingChoice?: Choice;
  readonly winner?: PlayerId | null; // Set if game ended
}

// Process a player action through the state machine
export function processAction(gameData: GameData, action: Action): GameResult {
  // Validate action legality
  const legalityCheck = isActionLegal(gameData, action);
  if (!legalityCheck.legal) {
    throw new Error(`Illegal action: ${legalityCheck.reason} (${legalityCheck.code})`);
  }
  
  // Start with a copy of the game state
  let newState = deepClone(gameData);
  const events: GameEvent[] = [];
  
  // Process the specific action
  switch (action.type) {
    case 'draw':
      newState = processDrawAction(newState, action.playerId, events);
      break;
    case 'meld':
      newState = processMeldAction(newState, action.playerId, action.cardId, events);
      break;
    case 'dogma':
      // Dogma actions are more complex and might require choices
      return processDogmaAction(newState, action.playerId, action.cardId, events);
    case 'achieve':
      newState = processAchieveAction(newState, action.playerId, action.achievementType, action.achievementId, events);
      break;
  }
  
  
  // Check for win conditions
  const winner = checkAchievementVictory(newState);
  if (winner !== null) {
    newState = {
      ...newState,
      phase: {
        ...newState.phase,
        state: 'GameOver',
      },
    };
    
    return {
      newState,
      events,
      nextPhase: 'GameOver',
      winner,
    };
  }
  
  // Advance turn or continue with same player
  newState = advanceTurn(newState);
  
  return {
    newState,
    events,
    nextPhase: 'AwaitingAction',
  };
}

// Process a choice answer to resume from a paused state
export function processChoice(gameData: GameData, choiceAnswer: ChoiceAnswer): GameResult {
  if (gameData.phase.state !== 'AwaitingChoice') {
    throw new Error('Game is not awaiting a choice');
  }
  
  if (!gameData.pendingChoice) {
    throw new Error('No pending choice found');
  }
  
  if (gameData.pendingChoice.id !== choiceAnswer.choiceId) {
    throw new Error('Choice answer does not match pending choice');
  }
  
  if (gameData.pendingChoice.playerId !== choiceAnswer.playerId) {
    throw new Error('Choice answer from wrong player');
  }
  
  // Process the choice answer and resume the interrupted action
  // For now, this is a placeholder - would be implemented with specific choice handlers
  const newState = deepClone(gameData);
  const events: GameEvent[] = [];
  
  // Clear the pending choice
  (newState as any).pendingChoice = undefined;
  
  // Continue processing based on the choice type
  // This would be implemented with specific choice handlers
  
  return {
    newState,
    events,
    nextPhase: 'AwaitingAction',
  };
}

// Get legal actions for a player
export function getPlayerLegalActions(gameData: GameData, playerId: PlayerId): Action[] {
  return getLegalActions(gameData, playerId);
}

// Process draw action
function processDrawAction(gameData: GameData, playerId: PlayerId, events: GameEvent[]): GameData {
  const rng = DeterministicRng.fromState(gameData.rng);
  
  // Determine which age to draw from based on highest top card
  const player = gameData.players[playerId]!;
  let highestAge = 1;
  
  for (const colorStack of player.colors) {
    if (colorStack.cards.length > 0) {
      const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
      const topCard = CARDS.cardsById.get(topCardId);
      if (topCard) {
        highestAge = Math.max(highestAge, topCard.age);
      }
    }
  }
  
  // Find available pile (with age skipping)
  let ageToDrawFrom = highestAge;
  let targetPile = gameData.shared.supplyPiles.find(pile => pile.age === ageToDrawFrom && pile.cards.length > 0);
  
  while (!targetPile && ageToDrawFrom <= 10) {
    ageToDrawFrom++;
    targetPile = gameData.shared.supplyPiles.find(pile => pile.age === ageToDrawFrom && pile.cards.length > 0);
  }
  
  if (!targetPile) {
    throw new Error('No cards available to draw');
  }
  
  // Draw a random card from the pile using RNG
  const randomIndex = rng.nextInt(targetPile.cards.length);
  const drawnCardId = targetPile.cards[randomIndex]!;
  const remainingCards = targetPile.cards.filter((_, index) => index !== randomIndex);
  
  // Update state
  const newState = deepClone(gameData);
  
  // Add card to player's hand
  newState.players[playerId]!.hands.push(drawnCardId);
  
  // Update supply pile
  const pileIndex = newState.shared.supplyPiles.findIndex(pile => pile.age === ageToDrawFrom);
  if (pileIndex !== -1) {
    newState.shared.supplyPiles[pileIndex] = {
      ...newState.shared.supplyPiles[pileIndex]!,
      cards: remainingCards,
    };
  }
  
  // Update RNG state
  (newState as any).rng = rng.getState();
  
  // Emit draw event
  const event = emitEvent(newState, 'drew', {
    playerId,
    cardId: drawnCardId,
    fromAge: ageToDrawFrom,
    source: 'draw_action',
  });
  events.push(event);
  
  return newState;
}

// Process meld action
function processMeldAction(gameData: GameData, playerId: PlayerId, cardId: import('@/types/core.js').CardId, events: GameEvent[]): GameData {
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    throw new Error('Invalid card ID');
  }
  
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from hand
  (player as any).hands = player.hands.filter(id => id !== cardId);
  
  // Add card to appropriate color stack on board
  const existingColorStack = player.colors.find(stack => stack.color === card.color);
  
  if (existingColorStack) {
    existingColorStack.cards.push(cardId);
  } else {
    player.colors.push({
      color: card.color,
      cards: [cardId],
    });
  }
  
  // Emit meld event
  const event = emitEvent(newState, 'melded', {
    playerId,
    cardId,
    color: card.color,
    source: 'meld_action',
  });
  events.push(event);
  
  return newState;
}

// Process dogma action (simplified - would need full dogma resolution)
function processDogmaAction(gameData: GameData, playerId: PlayerId, cardId: import('@/types/core.js').CardId, events: GameEvent[]): GameResult {
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    throw new Error('Invalid card ID');
  }
  
  const newState = deepClone(gameData);
  
  // For now, just emit the dogma activation event
  // Full dogma resolution would be implemented in Phase 3
  const event = emitEvent(newState, 'dogma_activated', {
    playerId,
    cardId,
    iconCount: 1, // Placeholder
    source: `dogma_${cardId}`,
  });
  events.push(event);
  
  const finalState = advanceTurn(newState);
  
  return {
    newState: finalState,
    events,
    nextPhase: 'AwaitingAction',
  };
}

// Process achieve action
function processAchieveAction(
  gameData: GameData, 
  playerId: PlayerId, 
  achievementType: 'normal' | 'special',
  achievementId: import('@/types/core.js').AchievementId | import('@/types/core.js').SpecialAchievementId,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  if (achievementType === 'normal') {
    // Add to player's normal achievements
    player.normalAchievements.push(achievementId as import('@/types/core.js').AchievementId);
    
    // Remove from available achievements
    (newState.shared as any).availableNormalAchievements = newState.shared.availableNormalAchievements
      .filter(id => id !== achievementId);
  } else {
    // Add to player's special achievements
    player.specialAchievements.push(achievementId as import('@/types/core.js').SpecialAchievementId);
    
    // Remove from available special achievements
    (newState.shared as any).availableSpecialAchievements = newState.shared.availableSpecialAchievements
      .filter(id => id !== achievementId);
  }
  
  // Emit achievement event
  const event = emitEvent(newState, 'achievement_claimed', {
    playerId,
    achievementType,
    achievementId,
    source: 'achieve_action',
  });
  events.push(event);
  
  return newState;
}