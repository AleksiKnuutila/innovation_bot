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
import { processDogmaAction as processDogmaActionWithResolver, resumeDogmaExecution } from './dogma-resolver.js';
import { checkVictoryConditions } from './victory-conditions.js';

// Result of processing an action or choice
export interface GameResult {
  readonly newState: GameData;
  readonly events: GameEvent[];
  readonly nextPhase: import('@/types/game-state.js').GameState;
  readonly pendingChoice?: Choice;
  readonly winner?: PlayerId | null; // Set if game ended
  readonly winCondition?: import('@/types/core.js').WinCondition | null; // How the game was won
}

// Process a player action and return the new game state
export function processAction(gameData: GameData, action: Action): GameResult {
  // Check victory conditions at the start
  const initialVictoryCheck = checkVictoryConditions(gameData);
  if (initialVictoryCheck.winner !== null) {
    return {
      newState: gameData,
      events: [],
      nextPhase: 'GameOver',
      winner: initialVictoryCheck.winner,
      winCondition: initialVictoryCheck.condition
    };
  }

  // Validate that the action is legal
  const legalityCheck = isActionLegal(gameData, action);
  if (!legalityCheck.legal) {
    // Throw error for illegal actions - this is what the tests expect
    throw new Error(legalityCheck.reason || 'Action is not legal');
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
      const dogmaResult = processDogmaActionWithResolver(newState, action.cardId, action.playerId);
      
      // Merge events from dogma resolution
      events.push(...dogmaResult.events);
      
      // Check if we need to wait for a choice
      if (dogmaResult.pendingChoice) {
        return {
          newState: dogmaResult.newState,
          events,
          nextPhase: dogmaResult.nextPhase,
          pendingChoice: dogmaResult.pendingChoice,
        };
      }
      
      // Update state and continue
      newState = dogmaResult.newState;
      break;
    case 'achieve':
      newState = processAchieveAction(newState, action.playerId, action.achievementType, action.achievementId, events);
      break;
  }
  
  
  // Check for win conditions
  const finalVictoryCheck = checkVictoryConditions(newState);
  if (finalVictoryCheck.winner !== null) {
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
      winner: finalVictoryCheck.winner,
      winCondition: finalVictoryCheck.condition,
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
  
  // Handle choice if we're in choice phase
  if (gameData.phase.state === 'AwaitingChoice') {
    if (!gameData.currentEffect) {
      throw new Error('Game state is AwaitingChoice but no currentEffect is set');
    }
    
    if (gameData.currentEffect.choice?.id !== choiceAnswer.choiceId) {
      throw new Error('Choice ID mismatch');
    }
    
    if (gameData.currentEffect.choice?.playerId !== choiceAnswer.playerId) {
      throw new Error('Choice player mismatch');
    }
    
    // Resume dogma execution
    if (gameData.currentEffect) {
      return resumeDogmaExecution(gameData, choiceAnswer);
    }
  }
  
  // No active effects - just clear the choice and continue
  const newState = deepClone(gameData);
  const events: GameEvent[] = [];
  
  // Clear the pending choice
  (newState as any).pendingChoice = undefined;
  
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