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
import { getCardEffectByName } from '../cards/effect-registry.js';
import { CARDS } from '../cards/database.js';
import { countIcons } from './state-manipulation.js';
import { autoClaimSpecialAchievements } from './achievements.js';

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
  
  // Use the card name to look up the effect function
  const effectFunction = getCardEffectByName(card.title);
  if (!effectFunction) {
    throw new Error(`No effect handler for card: ${card.title}`);
  }
  
  // Check if this effect is already active
  const currentEffect = context.gameData.currentEffect;
  if (currentEffect && currentEffect.cardId === context.cardId) {
    // Resume existing effect
    return effectFunction(context, currentEffect.state);
  } else {
    // Check if this is a simplified effect
    const simplifiedEffects = ['Domestication', 'Sailing', 'The Wheel', 'Writing', 'Calendar', 'Canal Building', 'Fermenting', 'Paper', 'Translation', 'Reformation'];
    
    if (simplifiedEffects.includes(card.title)) {
      // Simplified effects don't need initial state
      return effectFunction(context, {});
    } else {
      // State-based effects need initial state
      const initialState = getInitialState(card.title);
      return effectFunction(context, initialState);
    }
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
  const effectFunction = getCardEffectByName(card.title);
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
function getInitialState(cardName: string): any {
  switch (cardName) {
    case 'Agriculture':
      return { step: 'check_hand' };
    case 'Archery':
      return { step: 'execute_demand' };
    case 'City States':
      return { step: 'check_condition' };
    case 'Clothing':
      return { step: 'waiting_meld_choice' };
    case 'Code of Laws':
      return { step: 'check_condition' };
    case 'Masonry':
      return { step: 'waiting_meld_choice' };
    case 'Metalworking':
      return { step: 'draw_reveal' };
    case 'Mysticism':
      return { step: 'draw_first' };
    case 'Oars':
      return { 
        step: 'execute_demand', 
        affectedPlayers: [], 
        currentPlayerIndex: 0 
      };
    case 'Pottery':
      return { step: 'waiting_return_choice' };
    case 'Tools':
      return { step: 'check_hand' };
      
    // Age 2 Cards
    case 'Construction':
      return { step: 'check_condition' };
    case 'Currency':
      return { step: 'waiting_return_choice' };
    case 'Mapmaking':
      return { step: 'check_condition' };
    case 'Mathematics':
      return { step: 'waiting_return_choice' };
    case 'Monotheism':
      return { step: 'check_condition' };
    case 'Philosophy':
      return { step: 'waiting_splay_choice' };
    case 'Road Building':
      return { step: 'waiting_meld_choice' };
      
    // Age 3 Cards
    case 'Alchemy':
      return { step: 'start' };
    case 'Compass':
      return { step: 'check_condition' }; // Compass needs to check for non-green leaf cards
    case 'Engineering':
      return { step: 'check_condition' };
    case 'Feudalism':
      return { step: 'check_condition' };
    case 'Machinery':
      return { step: 'check_condition' };
    case 'Medicine':
      return { step: 'check_condition' };
    case 'Education':
      return { step: 'waiting_return_choice' };
      
    // Age 4 Cards
    case 'Invention': return { step: 'check_splay_options' };
    case 'Navigation': return { step: 'demand_transfer' };
    case 'Perspective': return { step: 'check_hand' };
    case 'Printing Press': return { step: 'check_score_choice' };
    
    // Age 6 Cards
    case 'Atomic Theory': return { step: 'check_splay_choice' };
      
    // Age 5 Cards
    case 'Coal':
      return { step: 'start' }; // Simple effect
    case 'Steam Engine':
      return { step: 'start' }; // Simple effect
      
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
