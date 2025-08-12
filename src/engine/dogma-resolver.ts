// Callback-based dogma resolution system

import type { 
  GameData, 
  PlayerId, 
  CardId 
} from '../types/index.js';
import type { 
  DogmaContext, 
  CardEffectFunction, 
  EffectRegistry, 
  EffectResult,
  ActiveEffect 
} from '../types/dogma.js';
import type { GameEvent } from '../types/events.js';
import type { Choice } from '../types/choices.js';
import { deepClone } from './utils.js';
import { emitEvent } from './events.js';
import { CARD_EFFECT_HANDLERS } from '../cards/effect-handlers.js';
import { CARDS } from '../cards/database.js';

// Global effect registry - maps card keys to effect functions
const effectRegistry: EffectRegistry = { ...CARD_EFFECT_HANDLERS };

// Register a card effect function
export function registerCardEffect(cardKey: string, effectFunction: CardEffectFunction): void {
  effectRegistry[cardKey] = effectFunction;
}

// Get a card effect function by key
export function getCardEffectFunction(cardKey: string): CardEffectFunction | undefined {
  return effectRegistry[cardKey];
}

// Create dogma context for an effect
export function createDogmaContext(
  gameData: GameData,
  cardId: CardId,
  dogmaLevel: number,
  activatingPlayer: PlayerId
): DogmaContext {
  // For now, assume all players are affected by dogma level 1
  // This will be enhanced later to handle actual dogma level logic
  const affectedPlayers: PlayerId[] = dogmaLevel === 1 ? [0, 1] : [];
  
  return {
    gameData,
    cardId,
    dogmaLevel,
    activatingPlayer,
    affectedPlayers
  };
}

// Get affected players for a specific dogma level
export function getAffectedPlayersForDogma(
  gameData: GameData,
  cardId: CardId,
  dogmaLevel: number,
  activatingPlayer: PlayerId
): PlayerId[] {
  // TODO: Implement actual dogma level logic based on card rules
  // For now, return all players for level 1
  if (dogmaLevel === 1) {
    return [0, 1];
  }
  return [];
}

// Get sharing players for a dogma effect
export function getSharingPlayers(
  gameData: GameData,
  cardId: CardId,
  dogmaLevel: number,
  activatingPlayer: PlayerId
): PlayerId[] {
  // Get the card data to find the dogma icon
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    return [];
  }
  
  // Count the dogma icon for the activating player
  const activatingPlayerIconCount = countPlayerIcons(gameData, activatingPlayer, card.dogmaIcon);
  
  // Find opponents who have at least that many icons
  const sharingPlayers: PlayerId[] = [];
  for (let playerId = 0; playerId < 2; playerId++) {
    const typedPlayerId = playerId as PlayerId;
    if (typedPlayerId !== activatingPlayer) {
      const playerIconCount = countPlayerIcons(gameData, typedPlayerId, card.dogmaIcon);
      if (playerIconCount >= activatingPlayerIconCount) {
        sharingPlayers.push(typedPlayerId);
      }
    }
  }
  
  return sharingPlayers;
}

// Count icons for a specific player (moved from effect-handlers)
function countPlayerIcons(gameData: GameData, playerId: PlayerId, icon: string): number {
  const player = gameData.players[playerId];
  if (!player) return 0;
  
  let count = 0;
  for (const colorStack of player.colors) {
    for (const cardId of colorStack.cards) {
      // TODO: Get actual card data and count icons
      // For now, return a placeholder value
      count += 1; // Placeholder
    }
  }
  return count;
}

// Execute a dogma effect using the callback-based pattern
export function executeDogmaEffect(
  context: DogmaContext,
  playerId: PlayerId
): EffectResult {
  // Get the card key from the card ID
  const cardKey = getCardKeyFromId(context.cardId);
  if (!cardKey) {
    throw new Error(`Unknown card ID: ${context.cardId}`);
  }
  
  // Get the effect function
  const effectFunction = effectRegistry[cardKey];
  if (!effectFunction) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  // Check if this effect is already active
  const activeEffect = context.gameData.activeEffects.find(e => e.cardId === context.cardId);
  
  if (activeEffect) {
    // Resume existing effect
    return effectFunction(context, activeEffect.effectState);
  } else {
    // Start new effect with initial state
    let initialState: any;
    
    // Provide appropriate initial state for each card
    switch (cardKey) {
      case 'writing':
        initialState = { step: 'start' };
        break;
      case 'codeOfLaws':
        initialState = { step: 'check_condition' };
        break;
      case 'oars':
        initialState = { 
          step: 'execute_demand', 
          affectedPlayers: [], 
          currentPlayerIndex: 0 
        };
        break;
      default:
        initialState = { step: 'start' };
    }
    
    return effectFunction(context, initialState);
  }
}

// Process a dogma action using the callback-based pattern
export function processDogmaAction(
  gameData: GameData,
  cardId: CardId,
  activatingPlayer: PlayerId
): GameResult {
  const newState = deepClone(gameData);
  const events: GameEvent[] = [];
  
  // Create dogma context
  const context = createDogmaContext(newState, cardId, 1, activatingPlayer);
  
  // Get affected players and sharing players
  const affectedPlayers = getAffectedPlayersForDogma(newState, cardId, 1, activatingPlayer);
  const sharingPlayers = getSharingPlayers(newState, cardId, 1, activatingPlayer);
  
  // Process dogma level 1 for now (will be enhanced for levels 2-3)
  if (affectedPlayers.length === 0) {
    // No players affected, effect completes immediately
    return {
      newState,
      events,
      nextPhase: 'AwaitingAction'
    };
  }
  
  // Start with the activating player
  let currentState = newState;
  let currentContext = { 
    ...context, 
    gameData: currentState,
    affectedPlayers,
    sharingPlayers
  };
  
  // Execute the effect for the activating player
  const result = executeDogmaEffect(currentContext, activatingPlayer);
  
  // Handle the result
  switch (result.type) {
    case 'continue':
      // Effect continues with new state
      return {
        newState: result.newState,
        events: [...events, ...result.events],
        nextPhase: 'AwaitingAction'
      };
      
    case 'need_choice':
      // Effect needs a choice - store it in game state
      const choiceState = {
        ...result.newState,
        pendingChoice: result.choice,
        activeEffects: [...result.newState.activeEffects, {
          cardId,
          effectState: result.nextState,
          priority: 1
        }]
      };
      
      return {
        newState: choiceState,
        events: [...events, ...result.events],
        nextPhase: 'AwaitingChoice',
        pendingChoice: result.choice
      };
      
    case 'complete':
      // Effect completed - now handle sharing if applicable
      let finalState = result.newState;
      let finalEvents = [...events, ...result.events];
      
      // Check if there are sharing players and if this effect should be shared
      if (sharingPlayers.length > 0 && shouldShareEffect(cardId, 'non-demand')) {
        // Process sharing effects
        const sharingResult = processSharingEffects(
          finalState, 
          cardId, 
          activatingPlayer, 
          sharingPlayers,
          'non-demand'
        );
        finalState = sharingResult.newState;
        finalEvents = [...finalEvents, ...sharingResult.events];
        
        // If sharing led to changes, activating player gets free Draw action
        if (sharingResult.changesMade) {
          // TODO: Implement free Draw action mechanism
          // For now, just emit an event
          const freeDrawEvent = emitEvent(finalState, 'shared_effect', {
            playerId: activatingPlayer,
            cardId,
            reason: 'sharing_effects_triggered_changes'
          });
          finalEvents.push(freeDrawEvent);
        }
      }
      
      return {
        newState: finalState,
        events: finalEvents,
        nextPhase: 'AwaitingAction'
      };
  }
}

// Determine if an effect should be shared
function shouldShareEffect(cardId: CardId, effectType?: string): boolean {
  // TODO: Implement proper logic based on card rules
  // For now, assume non-demand effects are shared
  return effectType !== 'demand';
}

// Process sharing effects for eligible players
function processSharingEffects(
  gameData: GameData,
  cardId: CardId,
  activatingPlayer: PlayerId,
  sharingPlayers: PlayerId[],
  effectType?: string
): { newState: GameData; events: GameEvent[]; changesMade: boolean } {
  let currentState = gameData;
  const events: GameEvent[] = [];
  let changesMade = false;
  
  // Process each sharing player in turn order
  for (const sharingPlayer of sharingPlayers) {
    // Create context for the sharing player
    const sharingContext = createDogmaContext(currentState, cardId, 1, sharingPlayer);
    
    // Execute the effect for the sharing player
    const sharingResult = executeDogmaEffect(sharingContext, sharingPlayer);
    
    // Apply the result
    currentState = sharingResult.newState;
    events.push(...sharingResult.events);
    
    // Check if changes were made
    if (sharingResult.events.length > 0) {
      changesMade = true;
    }
  }
  
  return { newState: currentState, events, changesMade };
}

// Resume dogma execution after a choice is made
export function resumeDogmaExecution(
  gameData: GameData,
  choiceAnswer: any
): GameResult {
  // Find the active effect
  const activeEffect = gameData.activeEffects[0];
  if (!activeEffect) {
    throw new Error('No active effect to resume');
  }
  
  // Get the card key
  const cardKey = getCardKeyFromId(activeEffect.cardId);
  if (!cardKey) {
    throw new Error(`Unknown card ID: ${activeEffect.cardId}`);
  }
  
  // Get the effect function
  const effectFunction = effectRegistry[cardKey];
  if (!effectFunction) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  // Create context
  const context = createDogmaContext(gameData, activeEffect.cardId, 1, 0); // TODO: get actual values
  
  // Call the effect function with the choice answer
  const result = effectFunction(context, activeEffect.effectState, choiceAnswer);
  
  // Handle the result
  switch (result.type) {
    case 'continue':
      // Update effect state and continue
      const continueState = {
        ...result.newState,
        activeEffects: gameData.activeEffects.map(e => 
          e.cardId === activeEffect.cardId 
            ? { ...e, effectState: result.nextState }
            : e
        )
      };
      
      return {
        newState: continueState,
        events: result.events,
        nextPhase: 'AwaitingAction'
      };
      
    case 'need_choice':
      // Need another choice
      const choiceState = {
        ...result.newState,
        pendingChoice: result.choice,
        activeEffects: gameData.activeEffects.map(e => 
          e.cardId === activeEffect.cardId 
            ? { ...e, effectState: result.nextState }
            : e
        )
      };
      
      return {
        newState: choiceState,
        events: result.events,
        nextPhase: 'AwaitingChoice',
        pendingChoice: result.choice
      };
      
    case 'complete':
      // Effect completed - remove from active effects
      const completeState = {
        ...result.newState,
        activeEffects: gameData.activeEffects.filter(e => e.cardId !== activeEffect.cardId)
      };
      
      return {
        newState: completeState,
        events: result.events,
        nextPhase: 'AwaitingAction'
      };
  }
}

// Helper function to get card key from card ID
// TODO: This should come from the card database
function getCardKeyFromId(cardId: CardId): string | null {
  // For now, use a simple mapping
  // This will be replaced with proper card database lookup
  const cardKeyMap: Record<CardId, string> = {
    15: 'writing',      // Writing
    5: 'codeOfLaws',    // Code of Laws
    10: 'oars'          // Oars
  };
  
  return cardKeyMap[cardId] || null;
}

// Game result type for the new system
export interface GameResult {
  newState: GameData;
  events: GameEvent[];
  nextPhase: 'AwaitingAction' | 'AwaitingChoice';
  pendingChoice?: Choice;
} 