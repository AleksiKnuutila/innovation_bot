// Card effect handlers using callback-based state machine pattern

import type { 
  EffectResult,
  DogmaContext
} from '../types/dogma.js';
import type { PlayerId, CardId, GameData } from '../types/index.js';
import type { GameEvent } from '../types/events.js';
import type { YesNoChoice, SelectCardsChoice } from '../types/choices.js';
import { emitEvent } from '../engine/events.js';
import { 
  drawCard, 
  scoreCard, 
  tuckCard, 
  transferCard, 
  countIcons,
  meldCard,
  revealCard,
  getTopCards,
  hasIcon,
  // New composite primitives
  drawAndScore,
  drawAndMeld,
  returnCard
} from '../engine/state-manipulation.js';
import { CARDS } from './database.js';

// ============================================================================
// Simple Effect Wrapper - Eliminates State Machine Boilerplate
// ============================================================================

/**
 * Creates a simple effect function that eliminates state machine complexity
 * for effects that don't require choices or multi-step execution.
 * 
 * @param effectFn Function that takes context and returns [newState, events]
 * @returns CardEffectFunction that follows the required interface
 */
export function createSimpleEffect(
  effectFn: (context: DogmaContext) => [GameData, GameEvent[]]
): (context: DogmaContext, state: any, choiceAnswer?: any) => EffectResult {
  return (context: DogmaContext, _state: any, _choiceAnswer?: any) => {
    const [newState, events] = effectFn(context);
    
    // Automatically emit dogma_activated event
    const dogmaEvent = emitEvent(newState, 'dogma_activated', {
      playerId: context.activatingPlayer,
      cardId: context.cardId,
      dogmaLevel: context.dogmaLevel,
      source: `${context.cardId}_card_effect`,
    });
    events.push(dogmaEvent);
    
    return { 
      type: 'complete', 
      newState, 
      events,
      effectType: 'non-demand' // Simple effects are typically non-demand
    };
  };
}

/**
 * Helper function to emit standardized dogma_activated event
 * This centralizes event emission logic and reduces boilerplate
 */
function emitDogmaEvent(
  gameData: GameData,
  context: DogmaContext,
  events: GameEvent[]
): void {
  const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
    playerId: context.activatingPlayer,
    cardId: context.cardId,
    dogmaLevel: context.dogmaLevel,
    source: `${context.cardId}_card_effect`,
  });
  events.push(dogmaEvent);
}

// ============================================================================
// Simple Card: Writing (No Choices) - SIMPLIFIED
// ============================================================================

export const writingEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  // Writing: "Draw a 2" - should draw 2 cards from age 2
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw 2 cards from age 2 (or next available age)
  newState = drawCard(newState, activatingPlayer, 2, events);
  newState = drawCard(newState, activatingPlayer, 2, events);
  
  return [newState, events];
});

// ============================================================================
// Medium Card: Code of Laws (Single Choice)
// ============================================================================

interface CodeOfLawsState {
  step: 'check_condition' | 'waiting_choice';
  activatingPlayer?: PlayerId;
}

export function codeOfLawsEffect(
  context: DogmaContext, 
  state: CodeOfLawsState, 
  _choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Check if this player has the highest crown count
      const playerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
      const otherPlayerId = activatingPlayer === 0 ? 1 : 0;
      const otherPlayerCrowns = countIcons(gameData, otherPlayerId, 'Crown');

      if (playerCrowns <= otherPlayerCrowns) {
        // Player does not have highest crown count, complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: [],
          effectType: 'non-demand'
        };
      }

      // Check if player has cards in hand to tuck
      const player = gameData.players[activatingPlayer]!;
      if (player.hands.length === 0) {
        // Player has no cards to tuck, complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: [],
          effectType: 'non-demand'
        };
      }

      // Player has highest crown count and cards to tuck, offer choice
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'codeOfLaws_tuck_choice',
          playerId: activatingPlayer,
          type: 'yes_no',
          prompt: 'Tuck all cards from your hand?',
          source: 'codeOfLaws_card_effect',
          yesText: 'Tuck all cards from hand',
          noText: 'Do not tuck any cards'
        },
        nextState: { 
          step: 'waiting_choice',
          activatingPlayer // Store the activating player in state
        }
      };
    }
    
    case 'waiting_choice': {
      if (!_choiceAnswer || _choiceAnswer.type !== 'yes_no') {
        throw new Error('Expected yes/no choice answer');
      }
      
      // Get the activating player from state
      const storedActivatingPlayer = state.activatingPlayer;
      if (storedActivatingPlayer === undefined) {
        throw new Error('Activating player not found in state');
      }
      
      if (!_choiceAnswer.answer) {
        // Player chose no - effect completes without action
        const events: GameEvent[] = [];
        emitDogmaEvent(gameData, context, events);
        
        return { 
          type: 'complete', 
          newState: gameData, 
          events: events
        };
      }
      
      // Player chose yes - tuck all cards from hand
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Get hand cards from the original state to avoid iteration issues
      const handCards = [...gameData.players[storedActivatingPlayer]!.hands];
      
      for (const cardId of handCards) {
        // Get card color for tucking
        const card = CARDS.cardsById.get(cardId);
        if (!card) {
          throw new Error(`Card ${cardId} not found in database`);
        }
        const color = card.color;
        newState = tuckCard(newState, storedActivatingPlayer, cardId, color, events);
      }
      
      // Emit dogma event
      emitDogmaEvent(newState, context, events);
      
      return { 
        type: 'complete', 
        newState: newState, 
        events: events,
        effectType: 'non-demand' // This effect can be shared
      };
    }
  }
}

// ============================================================================
// Complex Card: Oars (Demand with Multiple Choices)
// ============================================================================

interface OarsState {
  step: 'execute_demand' | 'waiting_transfer_choice' | 'waiting_draw_choice';
  affectedPlayers: PlayerId[];
  currentPlayerIndex: number;
}

export function oarsEffect(
  context: DogmaContext, 
  state: OarsState, 
  _choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'execute_demand': {
      // Find players with fewer crown icons than the activating player
      const activatingPlayerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
      const affectedPlayers: PlayerId[] = [];
      
      for (let playerId = 0; playerId < 2; playerId++) {
        const typedPlayerId = playerId as PlayerId;
        if (typedPlayerId !== activatingPlayer) {
          const playerCrowns = countIcons(gameData, typedPlayerId, 'Crown');
          if (playerCrowns < activatingPlayerCrowns) {
            affectedPlayers.push(typedPlayerId);
          }
        }
      }
      
      if (affectedPlayers.length === 0) {
        // No players affected by demand - execute non-demand effect
        let newState = gameData;
        const events: GameEvent[] = [];
        
        newState = drawAndScore(newState, activatingPlayer, 1, 1, events);
        
        const dogmaEvent = emitEvent(newState, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'oars_card_effect',
        });
        events.push(dogmaEvent);
        
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }
      
      // Start processing first affected player
      const firstPlayer = affectedPlayers[0];
      if (firstPlayer === undefined) {
        throw new Error('No affected players found');
      }
      
      const hasCards = gameData.players[firstPlayer]!.hands.length > 0;
      
      if (!hasCards) {
        // Skip to next player or complete
        if (affectedPlayers.length === 1) {
          // No more players to process - execute non-demand effect
          let newState = gameData;
          const events: GameEvent[] = [];
          
          newState = drawAndScore(newState, activatingPlayer, 1, 1, events);
          
          const dogmaEvent = emitEvent(newState, 'dogma_activated', {
            playerId: activatingPlayer,
            cardId: context.cardId,
            dogmaLevel: context.dogmaLevel,
            source: 'oars_card_effect',
          });
          events.push(dogmaEvent);
          
          return { type: 'complete', newState, events, effectType: 'non-demand' };
        }
        
        // Continue with next player
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: {
            step: 'execute_demand',
            affectedPlayers: affectedPlayers.slice(1),
            currentPlayerIndex: 0
          }
        };
      }
      
      // Offer choice to first affected player
      const choice: SelectCardsChoice = {
        id: 'oars_transfer_choice',
        playerId: firstPlayer,
        type: 'select_cards',
        prompt: 'Select a card to transfer to the activating player',
        source: 'oars_card_effect',
        from: { playerId: firstPlayer, zone: 'hand' },
        minCards: 1,
        maxCards: 1
      };
      
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice,
        nextState: {
          step: 'waiting_transfer_choice',
          affectedPlayers,
          currentPlayerIndex: 0
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!_choiceAnswer || _choiceAnswer.type !== 'select_cards') {
        throw new Error('Expected card selection choice answer');
      }
      
      const selectedCards = _choiceAnswer.selectedCards;
      if (selectedCards.length === 0) {
        throw new Error('No cards selected');
      }
      
      const currentPlayer = state.affectedPlayers[state.currentPlayerIndex];
      if (currentPlayer === undefined) {
        throw new Error('Invalid current player index');
      }
      
      const cardToTransfer = selectedCards[0];
      
      // Transfer the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, currentPlayer, activatingPlayer, cardToTransfer, 'hand', 'hand', events);
      
      // Check if more players need to be processed
      if (state.currentPlayerIndex < state.affectedPlayers.length - 1) {
        const nextPlayer = state.affectedPlayers[state.currentPlayerIndex + 1];
        if (nextPlayer === undefined) {
          throw new Error('Invalid next player index');
        }
        
        const hasCards = newState.players[nextPlayer]!.hands.length > 0;
        
        if (!hasCards) {
          // Skip to next player
          return {
            type: 'continue',
            newState,
            events,
            nextState: {
              ...state,
              currentPlayerIndex: state.currentPlayerIndex + 1
            }
          };
        }
        
        // Offer choice to next player
        const choice: SelectCardsChoice = {
          id: 'oars_transfer_choice',
          playerId: nextPlayer,
          type: 'select_cards',
          prompt: 'Select a card to transfer to the activating player',
          source: 'oars_card_effect',
          from: { playerId: nextPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: 1
        };
        
        return {
          type: 'need_choice',
          newState,
          events,
          choice,
          nextState: {
            ...state,
            currentPlayerIndex: state.currentPlayerIndex + 1
          }
        };
      }
      
      // All players processed - offer optional draw to activating player
      const choice: YesNoChoice = {
        id: 'oars_draw_choice',
        playerId: activatingPlayer,
        type: 'yes_no',
        prompt: 'Draw and score a card?',
        source: 'oars_card_effect',
        yesText: 'Draw and score a card',
        noText: 'Do not draw additional card'
      };
      
      return {
        type: 'need_choice',
        newState,
        events,
        choice,
        nextState: { 
          step: 'waiting_draw_choice', 
          affectedPlayers: [], 
          currentPlayerIndex: 0 
        }
      };
    }
    
    case 'waiting_draw_choice': {
      if (!_choiceAnswer || _choiceAnswer.type !== 'yes_no') {
        throw new Error('Expected yes/no choice answer');
      }
      
      if (!_choiceAnswer.answer) {
        // Player chose no - effect completes without additional action
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: context.activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'oars_card_effect',
        });
        
        return { 
          type: 'complete', 
          newState: gameData, 
          events: [dogmaEvent] 
        };
      }
      
      // Player chose yes - draw and score a card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = drawAndScore(newState, context.activatingPlayer, 1, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: context.activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'oars_card_effect',
      });
      events.push(dogmaEvent);
      
      return { type: 'complete', newState, events, effectType: 'demand' };
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// Export all effect functions for registration - MOVED TO END OF FILE
// export const CARD_EFFECT_HANDLERS = {
//   // Age 1 Cards (IDs 1-15)
//   1: agricultureEffect,      // Agriculture
//   2: archeryEffect,          // Archery
//   3: cityStatesEffect,       // City States
//   4: clothingEffect,         // Clothing
//   5: codeOfLawsEffect,       // Code of Laws
//   6: domesticationEffect,    // Domestication
//   7: masonryEffect,          // Masonry
//   8: metalworkingEffect,     // Metalworking
//   9: mysticismEffect,        // Mysticism
//   10: oarsEffect,            // Oars
//   11: potteryEffect,         // Pottery
//   12: sailingEffect,         // Sailing
//   13: theWheelEffect,        // The Wheel
//   14: toolsEffect,           // Tools
//   15: writingEffect,         // Writing
//   
//   // Age 2 Cards (IDs 16-25)
//   16: calendarEffect,        // Calendar
//   17: canalBuildingEffect,   // Canal Building
//   18: constructionEffect,    // Construction
//   19: currencyEffect,        // Currency
//   20: fermentingEffect,      // Fermenting
//   21: mapmakingEffect,       // Mapmaking
//   22: mathematicsEffect,     // Mathematics
//   23: monotheismEffect,      // Monotheism
//   24: philosophyEffect,      // Philosophy
//   25: roadBuildingEffect,    // Road Building
// }; 

// ============================================================================
// Simple Cards Using New Primitives
// ============================================================================

// Agriculture: "You may return a card from your hand. If you do, draw and score a card of value one higher than the card you returned."
interface AgricultureState {
  step: 'check_hand' | 'waiting_return_choice' | 'execute_draw_score';
  returnedCardAge?: number;
}

export function agricultureEffect(
  context: DogmaContext,
  state: AgricultureState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_hand': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: [],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to return a card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'agriculture_return_choice',
          playerId: activatingPlayer,
          source: 'agriculture_card_effect',
          type: 'select_cards',
          prompt: 'You may return a card from your hand. If you do, draw and score a card of value one higher than the card you returned.',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 0,
          maxCards: 1
        },
        nextState: { step: 'waiting_return_choice' }
      };
    }
    
    case 'waiting_return_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        // No card returned, complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: [],
          effectType: 'non-demand'
        };
      }
      
      // Get the returned card's age
      const returnedCardId = choiceAnswer.selectedCards[0];
      const returnedCard = CARDS.cardsById.get(returnedCardId);
      if (!returnedCard) {
        throw new Error('Invalid card ID');
      }
      
      // Return the card and draw/score one age higher
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Return the card
      newState = returnCard(newState, activatingPlayer, returnedCardId, returnedCard.age, events);
      
      // Draw and score a card one age higher
      const targetAge = returnedCard.age + 1;
      newState = drawAndScore(newState, activatingPlayer, targetAge, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'agriculture_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// The Wheel: "Draw two 1" - very simple effect - SIMPLIFIED
export const theWheelEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw two cards from age 1
  newState = drawCard(newState, activatingPlayer, 1, events);
  newState = drawCard(newState, activatingPlayer, 1, events);
  
  return [newState, events];
});

// Tools: "You may return three cards from your hand. If you do, draw and meld a 3."
interface ToolsState {
  step: 'check_hand' | 'waiting_return_choice' | 'execute_draw_meld';
}

export function toolsEffect(
  context: DogmaContext,
  state: ToolsState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_hand': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: [],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to return up to 3 cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'tools_return_choice',
          playerId: activatingPlayer,
          source: 'tools_card_effect',
          type: 'select_cards',
          prompt: 'You may return up to three cards from your hand. If you do, draw and meld a 3.',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 0,
          maxCards: Math.min(3, player.hands.length)
        },
        nextState: { step: 'waiting_return_choice' }
      };
    }
    
    case 'waiting_return_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        // No cards returned, complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: [],
          effectType: 'non-demand'
        };
      }
      
      // Return the selected cards
      let newState = gameData;
      const events: GameEvent[] = [];
      
      for (const cardId of choiceAnswer.selectedCards) {
        const card = CARDS.cardsById.get(cardId);
        if (card) {
          newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
        }
      }
      
      // Draw and meld a 3
      newState = drawAndMeld(newState, activatingPlayer, 3, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'tools_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 

// ============================================================================
// Remaining Age 1 Card Effects
// ============================================================================

// Archery: "I demand you draw a 1, then transfer the highest card in your hand to my hand!"
interface ArcheryState {
  step: 'execute_demand' | 'waiting_transfer_choice';
  targetPlayer?: PlayerId;
  drawnCardId?: CardId;
}

export function archeryEffect(
  context: DogmaContext,
  state: ArcheryState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'execute_demand': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Draw a 1 for the target player
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = drawCard(newState, targetPlayer, 1, events);
      const drawnCardId = newState.players[targetPlayer]!.hands[newState.players[targetPlayer]!.hands.length - 1]!;
      
      // Check if target player has cards to transfer
      if (newState.players[targetPlayer]!.hands.length === 0) {
        // No cards to transfer, complete immediately
        const dogmaEvent = emitEvent(newState, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'archery_card_effect',
        });
        events.push(dogmaEvent);
        
        return {
          type: 'complete',
          newState,
          events,
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer highest card
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: 'archery_transfer_choice',
          playerId: targetPlayer,
          source: 'archery_card_effect',
          type: 'select_cards',
          prompt: 'Transfer the highest card in your hand to the activating player',
          from: { playerId: targetPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'waiting_transfer_choice',
          targetPlayer,
          drawnCardId
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card transfer is mandatory for Archery demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      const cardToTransfer = choiceAnswer.selectedCards[0];
      
      // Transfer the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, targetPlayer, activatingPlayer, cardToTransfer, 'hand', 'hand', events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'archery_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// City States: "I demand you transfer a top card with a [Castle] from your board to my board if you have at least four [Castle] icons on your board! If you do, draw a 1!"
interface CityStatesState {
  step: 'check_condition' | 'waiting_transfer_choice';
  targetPlayer?: PlayerId;
}

export function cityStatesEffect(
  context: DogmaContext,
  state: CityStatesState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if target player has at least 4 castle icons
      const castleCount = countIcons(gameData, targetPlayer, 'Castle');
      
      if (castleCount < 4) {
        // Target player doesn't have enough castle icons, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'cityStates_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Check if target player has castle cards on top of their board
      const topCards = getTopCards(gameData, targetPlayer);
      const castleTopCards = topCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && hasIcon(gameData, targetPlayer, 'Castle');
      });
      
      if (castleTopCards.length === 0) {
        // No castle cards on top, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'cityStates_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer a castle top card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'cityStates_transfer_choice',
          playerId: targetPlayer,
          source: 'cityStates_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a top card with a Castle from your board to the activating player',
          from: { playerId: targetPlayer, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'waiting_transfer_choice',
          targetPlayer
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card transfer is mandatory for City States demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      const cardToTransfer = choiceAnswer.selectedCards[0];
      
      // Transfer the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, targetPlayer, activatingPlayer, cardToTransfer, 'board', 'board', events);
      
      // Draw a 1 for the activating player
      newState = drawCard(newState, activatingPlayer, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'cityStates_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Clothing: "Meld a card from your hand of different color from any card on your board. Draw and score a 1 for each color present on your board not present on any other player's board."
interface ClothingState {
  step: 'waiting_meld_choice' | 'execute_draw_score';
  meldedCardId?: CardId;
}

export function clothingEffect(
  context: DogmaContext,
  state: ClothingState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_meld_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'clothing_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Get colors on player's board
      const boardColors = new Set<string>();
      for (const colorStack of player.colors) {
        for (const cardId of colorStack.cards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            boardColors.add(card.color);
          }
        }
      }
      
      // Filter hand cards to only those of different colors from board
      const validHandCards = player.hands.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && !boardColors.has(card.color);
      });
      
      if (validHandCards.length === 0) {
        // No valid cards to meld, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'clothing_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to meld a card of different color
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'clothing_meld_choice',
          playerId: activatingPlayer,
          source: 'clothing_card_effect',
          type: 'select_cards',
          prompt: 'Meld a card from your hand of different color from any card on your board',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { step: 'execute_draw_score' }
      };
    }
    
    case 'execute_draw_score': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card melding is mandatory for Clothing effect');
      }
      
      const cardToMeld = choiceAnswer.selectedCards[0];
      
      // Meld the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = meldCard(newState, activatingPlayer, cardToMeld, events);
      
      // Count unique colors on player's board that aren't on other players' boards
      const playerBoardColors = new Set<string>();
      for (const colorStack of newState.players[activatingPlayer]!.colors) {
        for (const cardId of colorStack.cards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            playerBoardColors.add(card.color);
          }
        }
      }
      
      const otherPlayerBoardColors = new Set<string>();
      const otherPlayer = activatingPlayer === 0 ? 1 : 0;
      for (const colorStack of newState.players[otherPlayer]!.colors) {
        for (const cardId of colorStack.cards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            otherPlayerBoardColors.add(card.color);
          }
        }
      }
      
      const uniqueColors = [...playerBoardColors].filter(color => !otherPlayerBoardColors.has(color));
      
      // Draw and score a 1 for each unique color
      for (const _ of uniqueColors) {
        newState = drawAndScore(newState, activatingPlayer, 1, 1, events);
      }
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'clothing_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Domestication: "Meld the lowest card in your hand. Draw a 1." - SIMPLIFIED
export const domesticationEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  const player = gameData.players[activatingPlayer]!;
  
  // If no cards in hand, complete immediately
  if (player.hands.length === 0) {
    return [gameData, []];
  }
  
  // Find the lowest card in hand
  let lowestCardId = player.hands[0]!;
  let lowestAge = 10;
  
  for (const cardId of player.hands) {
    const card = CARDS.cardsById.get(cardId);
    if (card && card.age < lowestAge) {
      lowestAge = card.age;
      lowestCardId = cardId;
    }
  }
  
  // Meld the lowest card and draw a 1
  let newState = gameData;
  const events: GameEvent[] = [];
  
  newState = meldCard(newState, activatingPlayer, lowestCardId, events);
  newState = drawCard(newState, activatingPlayer, 1, events);
  
  return [newState, events];
});

// Masonry: "You may meld any number of cards from your hand, each with a [Castle]. If you melded four or more cards, claim the Monument achievement."
interface MasonryState {
  step: 'waiting_meld_choice' | 'check_achievement';
}

export function masonryEffect(
  context: DogmaContext,
  state: MasonryState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_meld_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      // Find castle cards in hand
      const castleCards = player.hands.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && hasIcon(gameData, activatingPlayer, 'Castle');
      });
      
      if (castleCards.length === 0) {
        // No castle cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'masonry_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to meld castle cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'masonry_meld_choice',
          playerId: activatingPlayer,
          source: 'masonry_card_effect',
          type: 'select_cards',
          prompt: 'You may meld any number of cards from your hand, each with a Castle',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 0,
          maxCards: castleCards.length
        },
        nextState: { step: 'check_achievement' }
      };
    }
    
    case 'check_achievement': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Meld selected castle cards
      if (choiceAnswer && choiceAnswer.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
        for (const cardId of choiceAnswer.selectedCards) {
          newState = meldCard(newState, activatingPlayer, cardId, events);
        }
        
        // Check if 4 or more cards were melded
        if (choiceAnswer.selectedCards.length >= 4) {
          // Claim Monument achievement
          const achievementEvent = emitEvent(newState, 'achievement_claimed', {
            playerId: activatingPlayer,
            achievementId: 'monument',
            source: 'masonry_card_effect'
          });
          events.push(achievementEvent);
          
          // Note: Achievement claiming is handled by the event system
          // No need to manually update game state
        }
      }
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'masonry_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Metalworking: "Draw and reveal a 1. If it has a [Castle], score it and repeat this dogma effect. Otherwise, keep it."
interface MetalworkingState {
  step: 'draw_reveal' | 'check_castle' | 'repeat_or_keep';
  drawnCardId?: CardId;
}

export function metalworkingEffect(
  context: DogmaContext,
  state: MetalworkingState,
  _choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'draw_reveal': {
      // Draw and reveal a 1
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = drawCard(newState, activatingPlayer, 1, events);
      const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
      
      // Reveal the drawn card
      newState = revealCard(newState, activatingPlayer, drawnCardId, events);
      
      return {
        type: 'continue',
        newState,
        events,
        nextState: { step: 'check_castle', drawnCardId }
      };
    }
    
    case 'check_castle': {
      const drawnCardId = state.drawnCardId;
      if (drawnCardId === undefined) {
        throw new Error('Drawn card ID not found in state');
      }
      
      // Check if the drawn card has a castle icon
      const hasCastle = hasIcon(gameData, activatingPlayer, 'Castle');
      
      if (hasCastle) {
        // Score the card and repeat the effect
        let newState = gameData;
        const events: GameEvent[] = [];
        
        newState = scoreCard(newState, activatingPlayer, drawnCardId, events);
        
        return {
          type: 'continue',
          newState,
          events,
          nextState: { step: 'draw_reveal' }
        };
      } else {
        // Keep the card in hand, complete
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'metalworking_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Mysticism: "Draw a 1. If it is the same color as any card on your board, meld it and draw a 1."
interface MysticismState {
  step: 'draw_first' | 'check_color' | 'meld_and_draw';
  drawnCardId?: CardId;
}

export function mysticismEffect(
  context: DogmaContext,
  state: MysticismState,
  _choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'draw_first': {
      // Draw a 1
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = drawCard(newState, activatingPlayer, 1, events);
      const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
      
      return {
        type: 'continue',
        newState,
        events,
        nextState: { step: 'check_color', drawnCardId }
      };
    }
    
    case 'check_color': {
      const drawnCardId = state.drawnCardId;
      if (drawnCardId === undefined) {
        throw new Error('Drawn card ID not found in state');
      }
      
      const drawnCard = CARDS.cardsById.get(drawnCardId);
      if (!drawnCard) {
        throw new Error('Drawn card not found in database');
      }
      
      // Check if any card on board has the same color
      const player = gameData.players[activatingPlayer]!;
      const hasSameColor = player.colors.some(colorStack => 
        colorStack.cards.some((boardCardId: CardId) => {
          const boardCard = CARDS.cardsById.get(boardCardId);
          return boardCard && boardCard.color === drawnCard.color;
        })
      );
      
      if (hasSameColor) {
        // Meld the card and draw another 1
        let newState = gameData;
        const events: GameEvent[] = [];
        
        newState = meldCard(newState, activatingPlayer, drawnCardId, events);
        newState = drawCard(newState, activatingPlayer, 1, events);
        
        const dogmaEvent = emitEvent(newState, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'mysticism_card_effect',
        });
        events.push(dogmaEvent);
        
        return {
          type: 'complete',
          newState,
          events,
          effectType: 'non-demand'
        };
      } else {
        // Keep the card in hand, complete
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'mysticism_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Pottery: "You may return up to three cards from your hand. If you returned any cards, draw and score a card of value equal to the number of cards you returned. Draw a 1."
interface PotteryState {
  step: 'waiting_return_choice' | 'execute_draw_score' | 'draw_final';
  returnedCount?: number;
}

export function potteryEffect(
  context: DogmaContext,
  state: PotteryState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_return_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, skip to final draw
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: { step: 'draw_final' }
        };
      }
      
      // Offer choice to return up to 3 cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'pottery_return_choice',
          playerId: activatingPlayer,
          source: 'pottery_card_effect',
          type: 'select_cards',
          prompt: 'You may return up to three cards from your hand. If you returned any cards, draw and score a card of value equal to the number of cards you returned.',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 0,
          maxCards: Math.min(3, player.hands.length)
        },
        nextState: { step: 'execute_draw_score' }
      };
    }
    
    case 'execute_draw_score': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Return selected cards if any
      if (choiceAnswer && choiceAnswer.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
        const returnedCount = choiceAnswer.selectedCards.length;
        
        for (const cardId of choiceAnswer.selectedCards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
          }
        }
        
        // Draw and score a card of value equal to the number returned
        newState = drawAndScore(newState, activatingPlayer, returnedCount, 1, events);
      }
      
      return {
        type: 'continue',
        newState,
        events,
        nextState: { step: 'draw_final' }
      };
    }
    
    case 'draw_final': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Draw a 1
      newState = drawCard(newState, activatingPlayer, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'pottery_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Sailing: "Draw and meld a 1." - SIMPLIFIED
export const sailingEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw and meld a 1
  newState = drawAndMeld(newState, activatingPlayer, 1, 1, events);
  
  return [newState, events];
});

// ============================================================================
// Age 2 Card Effects (IDs 16-25)
// ============================================================================

// Calendar: "Draw a 3 for each card in your score pile. If you have more cards in your score pile than in your hand, draw a 3." - SIMPLIFIED
export const calendarEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  const player = gameData.players[activatingPlayer]!;
  const scoreCount = player.scores.length;
  const handCount = player.hands.length;
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw a 3 for each card in score pile
  for (let i = 0; i < scoreCount; i++) {
    newState = drawCard(newState, activatingPlayer, 3, events);
  }
  
  // If more cards in score than hand, draw another 3
  if (scoreCount > handCount) {
    newState = drawCard(newState, activatingPlayer, 3, events);
  }
  
  return [newState, events];
});

// Canal Building: "Exchange the highest card in your hand with the highest card in your score pile." - SIMPLIFIED
export const canalBuildingEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  const player = gameData.players[activatingPlayer]!;
  
  // If no cards to exchange, complete immediately
  if (player.hands.length === 0 || player.scores.length === 0) {
    return [gameData, []];
  }
  
  // Find highest card in hand
  let highestHandCard = player.hands[0]!;
  let highestHandAge = 0;
  
  for (const cardId of player.hands) {
    const card = CARDS.cardsById.get(cardId);
    if (card && card.age > highestHandAge) {
      highestHandAge = card.age;
      highestHandCard = cardId;
    }
  }
  
  // Find highest card in score pile
  let highestScoreCard = player.scores[0]!;
  let highestScoreAge = 0;
  
  for (const cardId of player.scores) {
    const card = CARDS.cardsById.get(cardId);
    if (card && card.age > highestScoreAge) {
      highestScoreAge = card.age;
      highestScoreCard = cardId;
    }
  }
  
  // Exchange the cards
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Remove from original locations and add to new locations
  newState = {
    ...newState,
    players: {
      ...newState.players,
      [activatingPlayer]: {
        ...newState.players[activatingPlayer]!,
        hands: newState.players[activatingPlayer]!.hands.filter(id => id !== highestHandCard).concat([highestScoreCard]),
        scores: newState.players[activatingPlayer]!.scores.filter(id => id !== highestScoreCard).concat([highestHandCard])
      }
    }
  };
  
  // Emit transfer events
  const transferEvent1 = emitEvent(newState, 'transferred', {
    playerId: activatingPlayer,
    cardId: highestHandCard,
    fromZone: 'hand',
    toZone: 'score',
    source: 'canalBuilding_card_effect'
  });
  
  const transferEvent2 = emitEvent(newState, 'transferred', {
    playerId: activatingPlayer,
    cardId: highestScoreCard,
    fromZone: 'score',
    toZone: 'hand',
    source: 'canalBuilding_card_effect'
  });
  
  events.push(transferEvent1, transferEvent2);
  
  return [newState, events];
});

// Construction: "I demand you transfer two cards from your hand to my hand! If you do, claim the Empire achievement."
interface ConstructionState {
  step: 'check_condition' | 'waiting_transfer_choice';
  targetPlayer?: PlayerId;
}

export function constructionEffect(
  context: DogmaContext,
  state: ConstructionState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if target player has castle cards on top of their board
      const topCards = getTopCards(gameData, targetPlayer);
      const castleTopCards = topCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && hasIcon(gameData, targetPlayer, 'Castle');
      });
      
      if (castleTopCards.length === 0) {
        // No castle cards on top, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'construction_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer a castle top card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'construction_transfer_choice',
          playerId: targetPlayer,
          source: 'construction_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a top card with a Castle from your board to the activating player',
          from: { playerId: targetPlayer, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'waiting_transfer_choice',
          targetPlayer
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card transfer is mandatory for Construction demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      const cardToTransfer = choiceAnswer.selectedCards[0];
      
      // Transfer the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, targetPlayer, activatingPlayer, cardToTransfer, 'board', 'board', events);
      
      // Claim Empire achievement
      const achievementEvent = emitEvent(newState, 'achievement_claimed', {
        playerId: activatingPlayer,
        achievementId: 'empire',
        source: 'construction_card_effect'
      });
      events.push(achievementEvent);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'construction_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Currency: "Return any number of cards from your hand. Score a card of value 2 for each different value of card you returned."
interface CurrencyState {
  step: 'waiting_return_choice' | 'execute_score';
  returnedValues?: Set<number>;
}

export function currencyEffect(
  context: DogmaContext,
  state: CurrencyState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_return_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'currency_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to return any number of cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'currency_return_choice',
          playerId: activatingPlayer,
          source: 'currency_card_effect',
          type: 'select_cards',
          prompt: 'Return any number of cards from your hand. Score a card of value 2 for each different value of card you returned.',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 0,
          maxCards: player.hands.length
        },
        nextState: { step: 'execute_score' }
      };
    }
    
    case 'execute_score': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      if (choiceAnswer && choiceAnswer.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
        // Return selected cards and collect unique values
        const returnedValues = new Set<number>();
        
        for (const cardId of choiceAnswer.selectedCards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
            returnedValues.add(card.age);
          }
        }
        
        // Score a card of value 2 for each different value returned
        for (const _ of returnedValues) {
          newState = drawAndScore(newState, activatingPlayer, 2, 1, events);
        }
      }
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'currency_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Fermenting: "Draw a 2 for each [Leaf] icon on your board." - SIMPLIFIED
export const fermentingEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  // Count leaf icons on board
  const leafCount = countIcons(gameData, activatingPlayer, 'Leaf');
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw a 2 for each leaf icon
  for (let i = 0; i < leafCount; i++) {
    newState = drawCard(newState, activatingPlayer, 2, events);
  }
  
  return [newState, events];
});

// Mapmaking: "I demand you transfer a top card with a [Crown] from your board to my board! If you do, draw and score a 1."
interface MapmakingState {
  step: 'check_condition' | 'waiting_transfer_choice';
  targetPlayer?: PlayerId;
}

export function mapmakingEffect(
  context: DogmaContext,
  state: MapmakingState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if target player has crown cards on top of their board
      const topCards = getTopCards(gameData, targetPlayer);
      const crownTopCards = topCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && hasIcon(gameData, targetPlayer, 'Crown');
      });
      
      if (crownTopCards.length === 0) {
        // No crown cards on top, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'mapmaking_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer a crown top card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'mapmaking_transfer_choice',
          playerId: targetPlayer,
          source: 'mapmaking_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a top card with a Crown from your board to the activating player',
          from: { playerId: targetPlayer, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'waiting_transfer_choice',
          targetPlayer
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card transfer is mandatory for Mapmaking demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      const cardToTransfer = choiceAnswer.selectedCards[0];
      
      // Transfer the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, targetPlayer, activatingPlayer, cardToTransfer, 'board', 'board', events);
      
      // Draw and score a 1
      newState = drawAndScore(newState, activatingPlayer, 1, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'mapmaking_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Mathematics: "Return a card from your hand. Draw and meld a card of value one higher than the card you returned."
interface MathematicsState {
  step: 'waiting_return_choice' | 'execute_draw_meld';
}

export function mathematicsEffect(
  context: DogmaContext,
  state: MathematicsState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_return_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'mathematics_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to return a card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'mathematics_return_choice',
          playerId: activatingPlayer,
          source: 'mathematics_card_effect',
          type: 'select_cards',
          prompt: 'Return a card from your hand. Draw and meld a card of value one higher than the card you returned.',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { step: 'execute_draw_meld' }
      };
    }
    
    case 'execute_draw_meld': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card return is mandatory for Mathematics effect');
      }
      
      // Get the returned card's age
      const returnedCardId = choiceAnswer.selectedCards[0];
      const returnedCard = CARDS.cardsById.get(returnedCardId);
      if (!returnedCard) {
        throw new Error('Invalid card ID');
      }
      
      // Return the card and draw/meld one age higher
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Return the card
      newState = returnCard(newState, activatingPlayer, returnedCardId, returnedCard.age, events);
      
      // Draw and meld a card one age higher
      const targetAge = returnedCard.age + 1;
      newState = drawAndMeld(newState, activatingPlayer, targetAge, 1, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'mathematics_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'non-demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Monotheism: "I demand you transfer a top card of a different color from all cards on your board to my board! If you do, draw and tuck a 1."
interface MonotheismState {
  step: 'check_condition' | 'waiting_transfer_choice';
  targetPlayer?: PlayerId;
  availableColors?: string[];
}

export function monotheismEffect(
  context: DogmaContext,
  state: MonotheismState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Get colors on target player's board
      const boardColors = new Set<string>();
      for (const colorStack of gameData.players[targetPlayer]!.colors) {
        for (const cardId of colorStack.cards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            boardColors.add(card.color);
          }
        }
      }
      
      // Find top cards of different colors
      const topCards = getTopCards(gameData, targetPlayer);
      const differentColorTopCards = topCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && !boardColors.has(card.color);
      });
      
      if (differentColorTopCards.length === 0) {
        // No different color cards on top, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'monotheism_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer a different color top card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'monotheism_transfer_choice',
          playerId: targetPlayer,
          source: 'monotheism_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a top card of a different color from all cards on your board to the activating player',
          from: { playerId: targetPlayer, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'waiting_transfer_choice',
          targetPlayer
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card transfer is mandatory for Monotheism demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      const cardToTransfer = choiceAnswer.selectedCards[0];
      
      // Transfer the selected card
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, targetPlayer, activatingPlayer, cardToTransfer, 'board', 'board', events);
      
      // Draw and tuck a 1
      newState = drawCard(newState, activatingPlayer, 1, events);
      const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
      const drawnCard = CARDS.cardsById.get(drawnCardId);
      if (drawnCard) {
        newState = tuckCard(newState, activatingPlayer, drawnCardId, drawnCard.color, events);
      }
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'monotheism_card_effect',
      });
      events.push(dogmaEvent);
      
      return {
        type: 'complete',
        newState,
        events,
        effectType: 'demand'
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Philosophy: "Splay left any one color of your cards. Score a card from your hand."
interface PhilosophyState {
  step: 'waiting_splay_choice' | 'waiting_score_choice';
  splayedColor?: string;
}

export function philosophyEffect(
  context: DogmaContext,
  state: PhilosophyState,
  _choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_splay_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.colors.length === 0) {
        // No colors to splay, skip to score choice
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: { step: 'waiting_score_choice' }
        };
      }
      
      // Offer choice to splay left any color
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'philosophy_splay_choice',
          playerId: activatingPlayer,
          source: 'philosophy_card_effect',
          type: 'select_cards',
          prompt: 'Splay left any one color of your cards',
          from: { playerId: activatingPlayer, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { step: 'waiting_score_choice' }
      };
    }
    
    case 'waiting_score_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'philosophy_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to score a card from hand
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'philosophy_score_choice',
          playerId: activatingPlayer,
          source: 'philosophy_card_effect',
          type: 'select_cards',
          prompt: 'Score a card from your hand',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { step: 'waiting_score_choice' }
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 

// Road Building: "Meld one or two cards from your hand. You may exchange a card from your hand with a card of equal value from your score pile."
interface RoadBuildingState {
  step: 'waiting_meld_choice' | 'waiting_exchange_choice';
  meldedCards?: CardId[];
}

export function roadBuildingEffect(
  context: DogmaContext,
  state: RoadBuildingState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_meld_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'roadBuilding_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to meld one or two cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'roadBuilding_meld_choice',
          playerId: activatingPlayer,
          source: 'roadBuilding_card_effect',
          type: 'select_cards',
          prompt: 'Meld one or two cards from your hand',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: Math.min(2, player.hands.length)
        },
        nextState: { step: 'waiting_exchange_choice' }
      };
    }
    
    case 'waiting_exchange_choice': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Meld selected cards if any
      if (choiceAnswer && choiceAnswer.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
        for (const cardId of choiceAnswer.selectedCards) {
          newState = meldCard(newState, activatingPlayer, cardId, events);
        }
      }
      
      // Check if player has cards in hand and score pile for potential exchange
      const player = newState.players[activatingPlayer]!;
      if (player.hands.length === 0 || player.scores.length === 0) {
        // No cards to exchange, complete
        const dogmaEvent = emitEvent(newState, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'roadBuilding_card_effect',
        });
        events.push(dogmaEvent);
        
        return {
          type: 'complete',
          newState,
          events,
          effectType: 'non-demand'
        };
      }
      
      // Offer optional exchange choice
      return {
        type: 'need_choice',
        newState,
        events: [],
        choice: {
          id: 'roadBuilding_exchange_choice',
          playerId: activatingPlayer,
          source: 'roadBuilding_card_effect',
          type: 'select_cards',
          prompt: 'You may exchange a card from your hand with a card of equal value from your score pile',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 0,
          maxCards: 1
        },
        nextState: { step: 'waiting_exchange_choice' }
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 

// ============================================================================
// Export all effect functions for registration
// ============================================================================

export const CARD_EFFECT_HANDLERS = {
  // Age 1 Cards (IDs 1-15)
  1: agricultureEffect,      // Agriculture
  2: archeryEffect,          // Archery
  3: cityStatesEffect,       // City States
  4: clothingEffect,         // Clothing
  5: codeOfLawsEffect,       // Code of Laws
  6: domesticationEffect,    // Domestication
  7: masonryEffect,          // Masonry
  8: metalworkingEffect,     // Metalworking
  9: mysticismEffect,        // Mysticism
  10: oarsEffect,            // Oars
  11: potteryEffect,         // Pottery
  12: sailingEffect,         // Sailing
  13: theWheelEffect,        // The Wheel
  14: toolsEffect,           // Tools
  15: writingEffect,         // Writing
  
  // Age 2 Cards (IDs 16-25)
  16: calendarEffect,        // Calendar
  17: canalBuildingEffect,   // Canal Building
  18: constructionEffect,    // Construction
  19: currencyEffect,        // Currency
  20: fermentingEffect,      // Fermenting
  21: mapmakingEffect,       // Mapmaking
  22: mathematicsEffect,     // Mathematics
  23: monotheismEffect,      // Monotheism
  24: philosophyEffect,      // Philosophy
  25: roadBuildingEffect,    // Road Building
};