// Simplified dogma resolution system

import type { 
  GameData, 
  PlayerId, 
  CardId 
} from '../types/index.js';
import type { 
  DogmaContext, 
  CardEffectFunction, 
  EffectRegistry, 
  EffectResult
} from '../types/dogma.js';
import type { GameEvent } from '../types/events.js';
import type { Choice } from '../types/choices.js';
import { deepClone } from './utils.js';
import { emitEvent } from './events.js';
import { CARD_EFFECT_HANDLERS } from '../cards/effect-handlers.js';
import { CARDS } from '../cards/database.js';
import { countIcons } from './state-manipulation.js';
import { autoClaimSpecialAchievements } from './achievements.js';

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

// Create simplified dogma context
export function createDogmaContext(
  gameData: GameData,
  cardId: CardId,
  dogmaLevel: number,
  activatingPlayer: PlayerId
): DogmaContext {
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    throw new Error(`Unknown card ID: ${cardId}`);
  }
  
  // Get sharing players based on icon count
  const sharingPlayers: PlayerId[] = [];
  const activatingPlayerIconCount = countIcons(gameData, activatingPlayer, card.dogmaIcon);
  
  for (const playerId of [0, 1] as PlayerId[]) {
    if (playerId === activatingPlayer) continue;
    
    const playerIconCount = countIcons(gameData, playerId, card.dogmaIcon);
    if (playerIconCount >= activatingPlayerIconCount) {
      sharingPlayers.push(playerId);
    }
  }
  
  return {
    gameData,
    cardId,
    dogmaLevel,
    activatingPlayer,
    affectedPlayers: [0, 1], // All players affected for now
    sharingPlayers
  };
}

// Simplified dogma execution - direct call to card effect
export function executeDogmaEffect(
  context: DogmaContext
): EffectResult {
  const card = CARDS.cardsById.get(context.cardId);
  if (!card) {
    throw new Error(`Unknown card ID: ${context.cardId}`);
  }
  
  // Get card key from card title (simplified)
  const cardKey = getCardKeyFromTitle(card.title);
  if (!cardKey) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  const effectFunction = effectRegistry[cardKey];
  if (!effectFunction) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  // Check if this effect is already active
  const currentEffect = context.gameData.currentEffect;
  if (currentEffect && currentEffect.cardId === context.cardId) {
    // Resume existing effect
    return effectFunction(context, currentEffect.state);
  } else {
    // Start new effect with initial state
    const initialState = getInitialState(cardKey);
    return effectFunction(context, initialState);
  }
}

// Process dogma action - simplified flow
export function processDogmaAction(
  gameData: GameData,
  cardId: CardId,
  activatingPlayer: PlayerId
): GameResult {
  const newState = deepClone(gameData);
  const events: GameEvent[] = [];
  
  // Create context and execute effect
  const context = createDogmaContext(newState, cardId, 1, activatingPlayer);
  const result = executeDogmaEffect(context);
  
  // Handle the result
  switch (result.type) {
    case 'continue':
      return {
        newState: result.newState,
        events: [...events, ...result.events],
        nextPhase: 'AwaitingAction'
      };
      
    case 'need_choice':
      // Store choice and effect state
      const choiceState = {
        ...result.newState,
        currentEffect: {
          cardId,
          state: result.nextState,
          choice: result.choice
        }
      };
      
      return {
        newState: choiceState,
        events: [...events, ...result.events],
        nextPhase: 'AwaitingChoice',
        pendingChoice: result.choice
      };
      
    case 'complete':
      // Effect completed - handle sharing if applicable
      let finalState = result.newState;
      let finalEvents = [...events, ...result.events];
      
      // Simple sharing logic - only for non-demand effects
      if (result.effectType === 'non-demand' && context.sharingPlayers && context.sharingPlayers.length > 0) {
        const sharingResult = processSharingEffects(finalState, cardId, context.sharingPlayers);
        finalState = sharingResult.newState;
        finalEvents = [...finalEvents, ...sharingResult.events];
        
        // If sharing led to changes, emit event (free draw handled later)
        if (sharingResult.changesMade) {
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

// Simplified sharing effects processing
function processSharingEffects(
  gameData: GameData,
  cardId: CardId,
  sharingPlayers: PlayerId[]
): { newState: GameData; events: GameEvent[]; changesMade: boolean } {
  let currentState = gameData;
  const events: GameEvent[] = [];
  let changesMade = false;
  
  // Process each sharing player
  for (const sharingPlayer of sharingPlayers) {
    const sharingContext = createDogmaContext(currentState, cardId, 1, sharingPlayer);
    const sharingResult = executeDogmaEffect(sharingContext);
    
    currentState = sharingResult.newState;
    events.push(...sharingResult.events);
    
    if (sharingResult.events.length > 0) {
      changesMade = true;
    }
    
    // Check for special achievements
    const achievementResult = autoClaimSpecialAchievements(currentState, sharingPlayer);
    if (achievementResult.claimedAchievements.length > 0) {
      currentState = achievementResult.newState;
    }
  }
  
  return { newState: currentState, events, changesMade };
}

// Resume dogma execution after a choice
export function resumeDogmaExecution(
  gameData: GameData,
  choiceAnswer: any
): GameResult {
  const currentEffect = gameData.currentEffect;
  if (!currentEffect) {
    throw new Error('No active effect to resume');
  }
  
  const card = CARDS.cardsById.get(currentEffect.cardId);
  if (!card) {
    throw new Error(`Unknown card ID: ${currentEffect.cardId}`);
  }
  
  const cardKey = getCardKeyFromTitle(card.title);
  if (!cardKey) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  const effectFunction = effectRegistry[cardKey];
  if (!effectFunction) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  // Create context and call effect function
  const context = createDogmaContext(gameData, currentEffect.cardId, 1, 0); // TODO: get actual values
  const result = effectFunction(context, currentEffect.state, choiceAnswer);
  
  // Handle the result
  switch (result.type) {
    case 'continue':
      const continueState = {
        ...result.newState,
        currentEffect: {
          ...currentEffect,
          state: result.nextState
        }
      };
      
      return {
        newState: continueState,
        events: result.events,
        nextPhase: 'AwaitingAction'
      };
      
    case 'need_choice':
      const choiceState = {
        ...result.newState,
        currentEffect: {
          ...currentEffect,
          state: result.nextState,
          choice: result.choice
        }
      };
      
      return {
        newState: choiceState,
        events: result.events,
        nextPhase: 'AwaitingChoice',
        pendingChoice: result.choice
      };
      
    case 'complete':
      const { currentEffect: _, ...completeState } = result.newState;
      
      return {
        newState: completeState,
        events: result.events,
        nextPhase: 'AwaitingAction'
      };
  }
}

// Helper function to get card key from card title (simplified)
function getCardKeyFromTitle(title: string): string | null {
  const titleToKey: Record<string, string> = {
    'Writing': 'writing',
    'Code of Laws': 'codeOfLaws',
    'Oars': 'oars'
  };
  
  return titleToKey[title] || null;
}

// Helper function to get initial state for a card
function getInitialState(cardKey: string): any {
  switch (cardKey) {
    case 'writing':
      return { step: 'start' };
    case 'codeOfLaws':
      return { step: 'check_condition' };
    case 'oars':
      return { 
        step: 'execute_demand', 
        affectedPlayers: [], 
        currentPlayerIndex: 0 
      };
    default:
      return { step: 'start' };
  }
}

// Game result type
export interface GameResult {
  newState: GameData;
  events: GameEvent[];
  nextPhase: 'AwaitingAction' | 'AwaitingChoice';
  pendingChoice?: Choice;
} 
