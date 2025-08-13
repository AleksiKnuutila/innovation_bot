// Simplified dogma resolution system

import type { 
  GameData, 
  PlayerId, 
  CardId 
} from '../types/index.js';
import type { 
  DogmaContext, 
  CardEffectFunction, 
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

// Global effect registry - maps numeric card IDs to effect functions
const effectRegistry: Record<number, CardEffectFunction> = { ...CARD_EFFECT_HANDLERS };

// Register a card effect function by numeric ID
export function registerCardEffect(cardId: number, effectFunction: CardEffectFunction): void {
  effectRegistry[cardId] = effectFunction;
}

// Get a card effect function by numeric ID
export function getCardEffectFunction(cardId: number): CardEffectFunction | undefined {
  return effectRegistry[cardId];
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
  
  // Use the card ID directly - no more title-to-ID conversion
  const effectFunction = effectRegistry[context.cardId];
  if (!effectFunction) {
    throw new Error(`No effect handler for card ID: ${context.cardId}`);
  }
  
  // Check if this effect is already active
  const currentEffect = context.gameData.currentEffect;
  if (currentEffect && currentEffect.cardId === context.cardId) {
    // Resume existing effect
    return effectFunction(context, currentEffect.state);
  } else {
    // Start new effect with initial state
    const initialState = getInitialState(context.cardId);
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
      // Set the current effect so it can be resumed later
      const choiceState = {
        ...result.newState,
        currentEffect: {
          cardId: context.cardId,
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
  
  // Use the card ID directly - no more title-to-ID conversion
  const effectFunction = effectRegistry[currentEffect.cardId];
  if (!effectFunction) {
    throw new Error(`No effect handler for card ID: ${currentEffect.cardId}`);
  }
  
  // Create context and call effect function
  // Get actual values from the current effect or use defaults
  const dogmaLevel = currentEffect.state?.dogmaLevel || 1;
  const activatingPlayer = currentEffect.state?.activatingPlayer || 0;
  const context = createDogmaContext(gameData, currentEffect.cardId, dogmaLevel, activatingPlayer);
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

// Helper function to get initial state for a card
function getInitialState(cardId: number): any {
  // Simplified effects don't need initial states
  const simplifiedEffects = [12, 13, 15, 16, 20]; // Sailing, The Wheel, Writing, Calendar, Fermenting
  
  if (simplifiedEffects.includes(cardId)) {
    return {}; // Simplified effects don't use state
  }
  
  switch (cardId) {
    case 1: // Agriculture
      return { step: 'check_hand' };
    case 2: // Archery
      return { step: 'execute_demand' };
    case 3: // City States
      return { step: 'check_condition' };
    case 4: // Clothing
      return { step: 'waiting_meld_choice' };
    case 5: // Code of Laws
      return { step: 'check_condition' };
    case 6: // Domestication
      return { step: 'check_hand' };
    case 7: // Masonry
      return { step: 'waiting_meld_choice' };
    case 8: // Metalworking
      return { step: 'draw_reveal' };
    case 9: // Mysticism
      return { step: 'draw_first' };
    case 10: // Oars
      return { 
        step: 'execute_demand', 
        affectedPlayers: [], 
        currentPlayerIndex: 0 
      };
    case 11: // Pottery
      return { step: 'waiting_return_choice' };
    case 14: // Tools
      return { step: 'check_hand' };
      
    // Age 2 Cards
    case 17: // Canal Building
      return { step: 'check_eligibility' };
    case 18: // Construction
      return { step: 'check_condition' };
    case 19: // Currency
      return { step: 'waiting_return_choice' };
    case 21: // Mapmaking
      return { step: 'check_condition' };
    case 22: // Mathematics
      return { step: 'waiting_return_choice' };
    case 23: // Monotheism
      return { step: 'check_condition' };
    case 24: // Philosophy
      return { step: 'waiting_splay_choice' };
    case 25: // Road Building
      return { step: 'waiting_meld_choice' };
      
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
