// Card effect handlers using callback-based state machine pattern

import type { 
  EffectResult,
  DogmaContext
} from '../types/dogma.js';
import type { PlayerId, CardId, GameData } from '../types/index.js';
import type { GameEvent } from '../types/events.js';
import type { YesNoChoice, SelectCardsChoice, ChoiceAnswer, SelectPileAnswer } from '../types/choices.js';
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
  returnCard,
  splayColor,
  drawAndTuck
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
      // Remove from score pile
      const scoreIndex = newState.players[activatingPlayer]!.scores.indexOf(returnedCardId);
      if (scoreIndex === -1) {
        throw new Error(`Card ${returnedCardId} not found in score pile`);
      }
      newState.players[activatingPlayer]!.scores.splice(scoreIndex, 1);
      
      // Add to supply pile
      const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === returnedCard.age);
      if (!supplyPile) {
        throw new Error(`Supply pile for age ${returnedCard.age} not found`);
      }
      supplyPile.cards.push(returnedCardId);
      
      // Emit return event
      const returnEvent = emitEvent(newState, 'returned', {
        playerId: activatingPlayer,
        cardId: returnedCardId,
        fromZone: { playerId: activatingPlayer, zone: 'score' },
        toAge: returnedCard.age,
      });
      events.push(returnEvent);
      
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
        // No colors to splay, go directly to score choice
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
// Age 3 Card Effects (IDs 26-35)
// ============================================================================

// Alchemy: "Draw and reveal a 4 for every three [Castle] icons on your board. If any of the drawn cards are red, return the cards drawn and all cards in your hand. Otherwise, keep them." - SIMPLIFIED
export const alchemyEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  // Count castle icons and calculate how many 4s to draw
  const castleCount = countIcons(gameData, activatingPlayer, 'Castle');
  const cardsToDraw = Math.floor(castleCount / 3);
  
  if (cardsToDraw === 0) {
    return [gameData, []];
  }
  
  let newState = gameData;
  const events: GameEvent[] = [];
  const drawnCards: CardId[] = [];
  
  // Draw and reveal the 4s
  for (let i = 0; i < cardsToDraw; i++) {
    newState = drawCard(newState, activatingPlayer, 4, events);
    const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
    drawnCards.push(drawnCardId);
    
    // Reveal the drawn card
    newState = revealCard(newState, activatingPlayer, drawnCardId, events);
  }
  
  // Check if any drawn cards are red
  const hasRedCard = drawnCards.some(cardId => {
    const card = CARDS.cardsById.get(cardId);
    return card && card.color === 'Red';
  });
  
  if (hasRedCard) {
    // Return all drawn cards and all cards in hand
    const player = newState.players[activatingPlayer]!;
    
    // Return drawn cards
    for (const cardId of drawnCards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
      }
    }
    
    // Return all cards in hand
    const handCards = [...player.hands];
    for (const cardId of handCards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
      }
    }
  }
  // Otherwise, keep the drawn cards (they're already in hand)
  
  return [newState, events];
});

// Optics: "Draw and meld a 3. If it has a [Crown], draw and score a 4. Otherwise, transfer a card from your score pile to the score pile of an opponent with fewer points than you." - SIMPLIFIED
export const opticsEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw and meld a 3 (this will generate both draw and meld events)
  newState = drawAndMeld(newState, activatingPlayer, 3, 1, events);
  
  // Get the melded card to check for crown
  const meldedCardId = newState.players[activatingPlayer]!.colors.flatMap(stack => stack.cards).find(id => 
    !gameData.players[activatingPlayer]!.colors.flatMap(stack => stack.cards).includes(id)
  );
  
  if (meldedCardId && hasIcon(newState, activatingPlayer, 'Crown')) {
    // Has crown - draw and score a 4
    newState = drawAndScore(newState, activatingPlayer, 4, 1, events);
  } else {
    // No crown - transfer a card from score to opponent with fewer points
    const otherPlayer = activatingPlayer === 0 ? 1 : 0;
    const activatingPlayerPoints = newState.players[activatingPlayer]!.scores.length;
    const otherPlayerPoints = newState.players[otherPlayer]!.scores.length;
    
    if (activatingPlayerPoints > otherPlayerPoints && newState.players[activatingPlayer]!.scores.length > 0) {
      // Transfer highest score card to opponent
      const highestScoreCard = newState.players[activatingPlayer]!.scores.reduce((highest, current) => {
        const highestCard = CARDS.cardsById.get(highest);
        const currentCard = CARDS.cardsById.get(current);
        return (currentCard && highestCard && currentCard.age > highestCard.age) ? current : highest;
      });
      
      newState = transferCard(newState, activatingPlayer, otherPlayer, highestScoreCard, 'score', 'score', events);
    }
  }
  
  return [newState, events];
});

// Translation: "You may meld all the cards in your score pile. If you meld one, you must meld them all. If each top card on your board has a [Crown], claim the World achievement." - SIMPLIFIED
export const translationEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  const player = gameData.players[activatingPlayer]!;
  
  if (player.scores.length === 0) {
    return [gameData, []];
  }
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Move all score cards to board (this is equivalent to melding them)
  for (const cardId of player.scores) {
    // Remove from score pile and add to board
    newState = {
      ...newState,
      players: {
        ...newState.players,
        [activatingPlayer]: {
          ...newState.players[activatingPlayer]!,
          scores: newState.players[activatingPlayer]!.scores.filter(id => id !== cardId)
        }
      }
    };
    
    // Add to board (find the appropriate color stack)
    const card = CARDS.cardsById.get(cardId);
    if (card) {
      const colorIndex = newState.players[activatingPlayer]!.colors.findIndex(stack => stack.color === card.color);
      if (colorIndex >= 0) {
        // Add to existing color stack
        newState.players[activatingPlayer]!.colors[colorIndex]!.cards.push(cardId);
      } else {
        // Create new color stack
        newState.players[activatingPlayer]!.colors.push({
          color: card.color,
          cards: [cardId]
        });
      }
      
      // Emit meld event
      const meldEvent = emitEvent(newState, 'melded', {
        playerId: activatingPlayer,
        cardId,
        color: card.color,
        fromHand: false
      });
      events.push(meldEvent);
    }
  }
  
  // Check if each top card has a crown
  const topCards = getTopCards(newState, activatingPlayer);
  const allHaveCrowns = topCards.every(() => hasIcon(newState, activatingPlayer, 'Crown'));
  
  if (allHaveCrowns) {
    // Claim World achievement
    const achievementEvent = emitEvent(newState, 'achievement_claimed', {
      playerId: activatingPlayer,
      achievementId: 'world',
      source: 'translation_card_effect'
    });
    events.push(achievementEvent);
  }
  
  return [newState, events];
});

// Compass: "I demand you transfer a top non-green card with a [Leaf] from your board to my board, and then transfer a top card without a [Leaf] from my board to your board."
interface CompassState {
  step: 'check_condition' | 'waiting_transfer_choice' | 'waiting_exchange_choice';
  targetPlayer?: PlayerId;
  transferredCardId?: CardId;
}

export function compassEffect(
  context: DogmaContext,
  state: CompassState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if target player has non-green leaf cards on top of their board
      const topCards = getTopCards(gameData, targetPlayer);
      const validLeafCards = topCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && card.color !== 'Green' && hasIcon(gameData, targetPlayer, 'Leaf');
      });
      
      if (validLeafCards.length === 0) {
        // No valid cards to transfer, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'compass_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer a non-green leaf top card
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'compass_transfer_choice',
          playerId: targetPlayer,
          source: 'compass_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a top non-green card with a Leaf from your board to the activating player',
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
        throw new Error('Card transfer is mandatory for Compass demand');
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
      
      // Now offer choice to exchange with a non-leaf card from activating player's board
      const activatingPlayerTopCards = getTopCards(newState, activatingPlayer);
      const nonLeafCards = activatingPlayerTopCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && !hasIcon(newState, activatingPlayer, 'Leaf');
      });
      
      if (nonLeafCards.length === 0) {
        // No non-leaf cards to exchange, complete
        const dogmaEvent = emitEvent(newState, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'compass_card_effect',
        });
        events.push(dogmaEvent);
        
        return {
          type: 'complete',
          newState,
          events,
          effectType: 'demand'
        };
      }
      
      // Offer choice to exchange with a non-leaf card
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: 'compass_exchange_choice',
          playerId: activatingPlayer,
          source: 'compass_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a top card without a Leaf from your board to the target player',
          from: { playerId: activatingPlayer, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'waiting_exchange_choice',
          targetPlayer,
          transferredCardId: cardToTransfer
        }
      };
    }
    
    case 'waiting_exchange_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card exchange is mandatory for Compass demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      const cardToExchange = choiceAnswer.selectedCards[0];
      
      // Transfer the selected card to the target player
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = transferCard(newState, activatingPlayer, targetPlayer, cardToExchange, 'board', 'board', events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'compass_card_effect',
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

// ============================================================================
// Export all effect functions for registration
// ============================================================================

// Note: CARD_EFFECT_HANDLERS has been replaced with EFFECT_BY_NAME in effect-registry.ts
// This provides a more maintainable name-based mapping instead of ID-based mapping.
// The name-based approach eliminates the brittleness of ID-based mapping and makes
// it easier to add/remove effects without worrying about ID conflicts.

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
//   
//   // Age 3 Cards (IDs 26-35)
//   26: alchemyEffect,          // Alchemy
//   27: opticsEffect,            // Optics
//   28: translationEffect,       // Translation
//   29: compassEffect,           // Compass
//   30: educationEffect,         // Education
//   31: engineeringEffect,       // Engineering
//   32: feudalismEffect,        // Feudalism
//   33: machineryEffect,        // Machinery
//   34: medicineEffect,         // Medicine
// };

// Education: "You may return the highest card from your score pile. If you do, draw a card of value two higher than the highest card remaining in your score pile."
interface EducationState {
  step: 'waiting_return_choice' | 'execute_draw';
  returnedCardAge?: number;
}

export function educationEffect(
  context: DogmaContext,
  state: EducationState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'waiting_return_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.scores.length === 0) {
        // No cards in score pile, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'education_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'non-demand'
        };
      }
      
      // Offer choice to return the highest card from score pile
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'education_return_choice',
          playerId: activatingPlayer,
          source: 'education_card_effect',
          type: 'select_cards',
          prompt: 'You may return the highest card from your score pile. If you do, draw a card of value two higher than the highest card remaining in your score pile.',
          from: { playerId: activatingPlayer, zone: 'score' },
          minCards: 0,
          maxCards: 1
        },
        nextState: { step: 'execute_draw' }
      };
    }
    
    case 'execute_draw': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      if (choiceAnswer && choiceAnswer.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
        // Return the selected card
        const returnedCardId = choiceAnswer.selectedCards[0];
        const returnedCard = CARDS.cardsById.get(returnedCardId);
        if (returnedCard) {
          newState = returnCard(newState, activatingPlayer, returnedCardId, returnedCard.age, events);
        }
        
        // Find the highest remaining card in score pile
        const remainingScores = newState.players[activatingPlayer]!.scores;
        if (remainingScores.length > 0) {
          let highestAge = 0;
          for (const cardId of remainingScores) {
            const card = CARDS.cardsById.get(cardId);
            if (card && card.age > highestAge) {
              highestAge = card.age;
            }
          }
          
          // Draw a card of value two higher
          const targetAge = highestAge + 2;
          newState = drawCard(newState, activatingPlayer, targetAge, events);
        }
      }
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'education_card_effect',
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

// Engineering: "I demand you transfer all top cards with a [Castle] from your board to my score pile!"
interface EngineeringState {
  step: 'check_condition' | 'waiting_transfer_choice' | 'execute_splay';
  targetPlayer?: PlayerId;
  transferredCards?: CardId[];
}

export function engineeringEffect(
  context: DogmaContext,
  state: EngineeringState,
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
          source: 'engineering_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer castle top cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'engineering_transfer_choice',
          playerId: targetPlayer,
          source: 'engineering_card_effect',
          type: 'select_cards',
          prompt: 'Transfer all top cards with a Castle from your board to the activating player\'s score pile',
          from: { playerId: targetPlayer, zone: 'board' },
          minCards: 1,
          maxCards: castleTopCards.length
        },
        nextState: { 
          step: 'waiting_transfer_choice',
          targetPlayer
        }
      };
    }
    
    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        throw new Error('Card transfer is mandatory for Engineering demand');
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      // Transfer the selected cards to activating player's score pile
      let newState = gameData;
      const events: GameEvent[] = [];
      const transferredCards: CardId[] = [];
      
      for (const cardId of choiceAnswer.selectedCards) {
        // Remove from target player's board
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [targetPlayer]: {
              ...newState.players[targetPlayer]!,
              colors: newState.players[targetPlayer]!.colors.map(colorStack => ({
                ...colorStack,
                cards: colorStack.cards.filter(id => id !== cardId)
              }))
            }
          }
        };
        
        // Add to activating player's score pile
        newState = {
          ...newState,
          players: {
            ...newState.players,
            [activatingPlayer]: {
              ...newState.players[activatingPlayer]!,
              scores: [...newState.players[activatingPlayer]!.scores, cardId]
            }
          }
        };
        
        transferredCards.push(cardId);
        
        // Emit transfer event
        const transferEvent = emitEvent(newState, 'transferred', {
          playerId: targetPlayer,
          cardId,
          fromZone: 'board',
          toZone: 'score',
          source: 'engineering_card_effect'
        });
        events.push(transferEvent);
      }
      
      // Continue to splay choice
      return {
        type: 'continue',
        newState,
        events,
        nextState: { 
          step: 'execute_splay',
          targetPlayer,
          transferredCards
        }
      };
    }
    
    case 'execute_splay': {
      // Offer choice to splay red cards left
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'engineering_splay_choice',
          playerId: activatingPlayer,
          source: 'engineering_card_effect',
          type: 'select_cards',
          prompt: 'You may splay your red cards left',
          from: { playerId: activatingPlayer, zone: 'board' },
          minCards: 0,
          maxCards: 1
        },
        nextState: { 
          step: 'execute_splay',
          targetPlayer: state.targetPlayer,
          transferredCards: state.transferredCards
        }
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Feudalism: "I demand you transfer a card with a [Castle] from your hand to my hand! If you do, you may splay your yellow or purple cards left."
interface FeudalismState {
  step: 'check_condition' | 'waiting_transfer_choice' | 'execute_splay';
  targetPlayer?: PlayerId;
  transferredCardId?: CardId;
}

export function feudalismEffect(
  context: DogmaContext,
  state: FeudalismState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if target player has castle cards in hand
      const handCards = gameData.players[targetPlayer]!.hands;
      const castleHandCards = handCards.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        if (!card) return false;
        
        // Check if the card has a castle icon in any visible position
        return card.positions.top === 'Castle' || 
               card.positions.left === 'Castle' || 
               card.positions.middle === 'Castle' || 
               card.positions.right === 'Castle';
      });
      
      if (castleHandCards.length === 0) {
        // No castle cards in hand, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'feudalism_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to transfer a castle card from hand
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'feudalism_transfer_choice',
          playerId: targetPlayer,
          source: 'feudalism_card_effect',
          type: 'select_cards',
          prompt: 'Transfer a card with a Castle from your hand to the activating player',
          from: { playerId: targetPlayer, zone: 'hand' },
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
        throw new Error('Card transfer is mandatory for Feudalism demand');
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
      
      // Continue to splay choice
      return {
        type: 'continue',
        newState,
        events,
        nextState: { 
          step: 'execute_splay',
          targetPlayer,
          transferredCardId: cardToTransfer
        }
      };
    }
    
    case 'execute_splay': {
      // Offer choice to splay yellow or purple cards left
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'feudalism_splay_choice',
          playerId: activatingPlayer,
          source: 'feudalism_card_effect',
          type: 'yes_no',
          prompt: 'You may splay your yellow or purple cards left',
          yesText: 'Splay yellow/purple cards left',
          noText: 'Do not splay yellow/purple cards'
        },
        nextState: { 
          step: 'execute_splay',
          targetPlayer: state.targetPlayer,
          transferredCardId: state.transferredCardId
        }
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Machinery: "I demand you exchange all cards in your hand with all the cards in my hand! If you do, score a card from your hand, and you may splay your red cards left."
interface MachineryState {
  step: 'check_condition' | 'waiting_exchange_choice' | 'execute_score' | 'execute_splay';
  targetPlayer?: PlayerId;
  exchangedCards?: CardId[];
}

export function machineryEffect(
  context: DogmaContext,
  state: MachineryState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if target player has cards in hand
      const targetHandCards = gameData.players[targetPlayer]!.hands;
      const activatingHandCards = gameData.players[activatingPlayer]!.hands;
      
      if (targetHandCards.length === 0 && activatingHandCards.length === 0) {
        // No cards to exchange, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'machinery_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Offer choice to exchange hands
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'machinery_exchange_choice',
          playerId: targetPlayer,
          source: 'machinery_card_effect',
          type: 'yes_no',
          prompt: 'Exchange all cards in your hand with all the cards in the activating player\'s hand?',
          yesText: 'Exchange hands',
          noText: 'Do not exchange hands'
        },
        nextState: { 
          step: 'waiting_exchange_choice',
          targetPlayer
        }
      };
    }
    
    case 'waiting_exchange_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no' || !choiceAnswer.answer) {
        // Player chose not to exchange, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'machinery_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      const targetPlayer = state.targetPlayer;
      if (targetPlayer === undefined) {
        throw new Error('Target player not found in state');
      }
      
      // Exchange hands
      let newState = gameData;
      const events: GameEvent[] = [];
      
      const targetHandCards = gameData.players[targetPlayer]!.hands;
      const activatingHandCards = gameData.players[activatingPlayer]!.hands;
      
      // Swap the hands
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [targetPlayer]: {
            ...newState.players[targetPlayer]!,
            hands: [...activatingHandCards]
          },
          [activatingPlayer]: {
            ...newState.players[activatingPlayer]!,
            hands: [...targetHandCards]
          }
        }
      };
      
      // Emit transfer events for each card
      for (const cardId of targetHandCards) {
        const transferEvent = emitEvent(newState, 'transferred', {
          playerId: targetPlayer,
          cardId,
          fromZone: 'hand',
          toZone: 'hand',
          source: 'machinery_card_effect'
        });
        events.push(transferEvent);
      }
      
      for (const cardId of activatingHandCards) {
        const transferEvent = emitEvent(newState, 'transferred', {
          playerId: activatingPlayer,
          cardId,
          fromZone: 'hand',
          toZone: 'hand',
          source: 'machinery_card_effect'
        });
        events.push(transferEvent);
      }
      
      // Continue to score choice
      return {
        type: 'continue',
        newState,
        events,
        nextState: { 
          step: 'execute_score',
          targetPlayer,
          exchangedCards: [...targetHandCards, ...activatingHandCards]
        }
      };
    }
    
    case 'execute_score': {
      // Offer choice to score a card from hand
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, skip to splay choice
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: { 
            step: 'execute_splay',
            targetPlayer: state.targetPlayer,
            exchangedCards: state.exchangedCards
          }
        };
      }
      
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'machinery_score_choice',
          playerId: activatingPlayer,
          source: 'machinery_card_effect',
          type: 'select_cards',
          prompt: 'Score a card from your hand',
          from: { playerId: activatingPlayer, zone: 'hand' },
          minCards: 1,
          maxCards: 1
        },
        nextState: { 
          step: 'execute_score',
          targetPlayer: state.targetPlayer,
          exchangedCards: state.exchangedCards
        }
      };
    }
    
    case 'execute_splay': {
      // Offer choice to splay red cards left
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'machinery_splay_choice',
          playerId: activatingPlayer,
          source: 'machinery_card_effect',
          type: 'yes_no',
          prompt: 'You may splay your red cards left',
          yesText: 'Splay red cards left',
          noText: 'Do not splay red cards'
        },
        nextState: { 
          step: 'execute_splay',
          targetPlayer: state.targetPlayer,
          exchangedCards: state.exchangedCards
        }
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Medicine: "I demand you exchange the highest card in your score pile with the lowest card in my score pile!"
interface MedicineState {
  step: 'check_condition' | 'waiting_exchange_choice';
  targetPlayer?: PlayerId;
  highestCardId?: CardId;
  lowestCardId?: CardId;
}

export function medicineEffect(
  context: DogmaContext,
  state: MedicineState,
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Find the other player
      const targetPlayer = activatingPlayer === 0 ? 1 : 0;
      
      // Check if both players have score cards
      const targetScores = gameData.players[targetPlayer]!.scores;
      const activatingScores = gameData.players[activatingPlayer]!.scores;
      
      if (targetScores.length === 0 || activatingScores.length === 0) {
        // No cards to exchange, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'medicine_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      // Find highest card in target player's score pile
      let highestCardId = targetScores[0]!;
      let highestAge = 0;
      for (const cardId of targetScores) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.age > highestAge) {
          highestAge = card.age;
          highestCardId = cardId;
        }
      }
      
      // Find lowest card in activating player's score pile
      let lowestCardId = activatingScores[0]!;
      let lowestAge = 10;
      for (const cardId of activatingScores) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.age < lowestAge) {
          lowestAge = card.age;
          lowestCardId = cardId;
        }
      }
      
      // Offer choice to exchange the cards
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: 'medicine_exchange_choice',
          playerId: targetPlayer,
          source: 'medicine_card_effect',
          type: 'yes_no',
          prompt: `Exchange your highest score card (age ${highestAge}) with the activating player's lowest score card (age ${lowestAge})?`,
          yesText: 'Exchange score cards',
          noText: 'Do not exchange score cards'
        },
        nextState: { 
          step: 'waiting_exchange_choice',
          targetPlayer,
          highestCardId,
          lowestCardId
        }
      };
    }
    
    case 'waiting_exchange_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no' || !choiceAnswer.answer) {
        // Player chose not to exchange, complete immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'medicine_card_effect',
        });
        
        return {
          type: 'complete',
          newState: gameData,
          events: [dogmaEvent],
          effectType: 'demand'
        };
      }
      
      const targetPlayer = state.targetPlayer;
      const highestCardId = state.highestCardId;
      const lowestCardId = state.lowestCardId;
      
      if (targetPlayer === undefined || highestCardId === undefined || lowestCardId === undefined) {
        throw new Error('Required state values not found');
      }
      
      // Exchange the cards
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Remove cards from original locations
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [targetPlayer]: {
            ...newState.players[targetPlayer]!,
            scores: newState.players[targetPlayer]!.scores.filter(id => id !== highestCardId)
          },
          [activatingPlayer]: {
            ...newState.players[activatingPlayer]!,
            scores: newState.players[activatingPlayer]!.scores.filter(id => id !== lowestCardId)
          }
        }
      };
      
      // Add cards to new locations
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [targetPlayer]: {
            ...newState.players[targetPlayer]!,
            scores: [...newState.players[targetPlayer]!.scores, lowestCardId]
          },
          [activatingPlayer]: {
            ...newState.players[activatingPlayer]!,
            scores: [...newState.players[activatingPlayer]!.scores, highestCardId]
          }
        }
      };
      
      // Emit transfer events
      const transferEvent1 = emitEvent(newState, 'transferred', {
        playerId: targetPlayer,
        cardId: highestCardId,
        fromZone: 'score',
        toZone: 'score',
        source: 'medicine_card_effect'
      });
      
      const transferEvent2 = emitEvent(newState, 'transferred', {
        playerId: activatingPlayer,
        cardId: lowestCardId,
        fromZone: 'score',
        toZone: 'score',
        source: 'medicine_card_effect'
      });
      
      events.push(transferEvent1, transferEvent2);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'medicine_card_effect',
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

// ============================================================================
// Age 4 Card Effects
// ============================================================================

// ============================================================================
// Simple Card: Experimentation (ID 39) - Draw and meld a 5
// ============================================================================

export const experimentationEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw and meld a 5 (will fall back to age 6, 7, etc. if age 5 is empty)
  newState = drawAndMeld(newState, activatingPlayer, 5, 1, events);
  
  return [newState, events];
});

// ============================================================================
// Simple Card: Colonialism (ID 37) - Draw and tuck a 3, repeating if Crown
// ============================================================================

export const colonialismEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  
  // For now, just draw and tuck once (repeat logic needs more complex implementation)
  // TODO: Implement proper repeat logic when drawn card has Crown
  let newState = gameData;
  const events: GameEvent[] = [];
  
  newState = drawAndTuck(newState, activatingPlayer, 3, 1, events);
  
  return [newState, events];
});

// ============================================================================
// Complex Card: Anatomy (ID 36) - Demand return from score, then return equal value from board
// ============================================================================

interface AnatomyState {
  step: 'demand_return_score' | 'waiting_score_choice' | 'demand_return_board' | 'waiting_board_choice';
  returnedScoreCardId?: CardId;
  returnedScoreCardValue?: number;
}

export function anatomyEffect(
  context: DogmaContext,
  state: AnatomyState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'demand_return_score': {
      // Find opponents with fewer Leaf icons
      const activatingPlayerLeafs = countIcons(gameData, activatingPlayer, 'Leaf');
      const affectedPlayers: PlayerId[] = [];
      
      for (let playerId = 0; playerId < 2; playerId++) {
        const typedPlayerId = playerId as PlayerId;
        if (typedPlayerId !== activatingPlayer) {
          const playerLeafs = countIcons(gameData, typedPlayerId, 'Leaf');
          if (playerLeafs < activatingPlayerLeafs) {
            affectedPlayers.push(typedPlayerId);
          }
        }
      }
      
      if (affectedPlayers.length === 0) {
        // No one affected by demand - complete immediately
        return {
          type: 'complete',
          newState: gameData,
          events: []
        };
      }
      
      // Start with first affected player
      const targetPlayer = affectedPlayers[0];
      if (targetPlayer === undefined) {
        throw new Error('No affected players found');
      }
      
      const hasScoreCards = gameData.players[targetPlayer]!.scores.length > 0;
      
      if (!hasScoreCards) {
        // Skip to next player or complete
        if (affectedPlayers.length === 1) {
          return {
            type: 'complete',
            newState: gameData,
            events: []
          };
        }
        
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: {
            ...state,
            step: 'demand_return_score'
          }
        };
      }
      
      // Request choice from target player
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice: {
          id: `anatomy_score_${targetPlayer}`,
          type: 'select_cards',
          playerId: targetPlayer,
          prompt: 'Select a card from your score pile to return',
          source: 'anatomy_card_effect',
          from: { playerId: targetPlayer, zone: 'score' },
          minCards: 1,
          maxCards: 1
        },
        nextState: {
          step: 'waiting_score_choice',
          returnedScoreCardId: undefined,
          returnedScoreCardValue: undefined
        }
      };
    }
    
    case 'waiting_score_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        throw new Error('Expected card selection');
      }
      
      const selectedCards = (choiceAnswer as any).selectedCards;
      if (selectedCards.length === 0) {
        return {
          type: 'complete',
          newState: gameData,
          events: []
        };
      }
      
      const returnedScoreCardId = selectedCards[0];
      const returnedScoreCard = CARDS.cardsById.get(returnedScoreCardId);
      const returnedScoreCardValue = returnedScoreCard?.age || 0;
      
      // Return the card from score pile
      let newState = gameData;
      const events: GameEvent[] = [];
      
      if (!returnedScoreCard) {
        throw new Error('Invalid card ID');
      }
      
      newState = returnCard(newState, choiceAnswer.playerId, returnedScoreCardId, returnedScoreCard.age, events);
      
      // Now demand return of equal value card from board
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `anatomy_board_${choiceAnswer.playerId}`,
          type: 'select_cards',
          playerId: choiceAnswer.playerId,
          prompt: `Select a card of age ${returnedScoreCardValue} from your board to return`,
          source: 'anatomy_card_effect',
          from: { playerId: choiceAnswer.playerId, zone: 'board' },
          minCards: 1,
          maxCards: 1
        },
        nextState: {
          step: 'waiting_board_choice',
          returnedScoreCardId,
          returnedScoreCardValue
        }
      };
    }
    
    case 'waiting_board_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        throw new Error('Expected card selection');
      }
      
      const selectedCards = (choiceAnswer as any).selectedCards;
      if (selectedCards.length === 0) {
        return {
          type: 'complete',
          newState: gameData,
          events: []
        };
      }
      
      const returnedBoardCardId = selectedCards[0];
      const returnedBoardCard = CARDS.cardsById.get(returnedBoardCardId);
      if (!returnedBoardCard) {
        throw new Error('Invalid card ID');
      }
      
      // Return the card from board
      let newState = gameData;
      const events: GameEvent[] = [];
      
      newState = returnCard(newState, choiceAnswer.playerId, returnedBoardCardId, returnedBoardCard.age, events);
      
      return {
        type: 'complete',
        newState,
        events
      };
    }
    
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// ============================================================================
// Complex Card: Enterprise (ID 38) - Demand transfer non-purple Crown, then draw and meld 4
// ============================================================================

interface EnterpriseState {
  step: 'demand_transfer' | 'waiting_transfer_choice' | 'draw_and_meld';
  transferredCardId?: CardId;
}

export function enterpriseEffect(
  context: DogmaContext,
  state: EnterpriseState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer, affectedPlayers } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  if (state.step === 'demand_transfer') {
    const targetPlayer = affectedPlayers[0];
    
    if (!targetPlayer) {
      // No affected players, complete immediately
      return {
        type: 'complete',
        newState,
        events
      };
    }
    
    // Check if they have any non-purple Crown cards on their board
    const validCards = gameData.players[targetPlayer]!.colors.filter((colorStack) => {
      if (colorStack.cards.length === 0) return false;
      const topCard = CARDS.cardsById.get(colorStack.cards[colorStack.cards.length - 1]!);
      return topCard && topCard.color !== 'Purple' && hasIcon(gameData, targetPlayer, 'Crown');
    });
    
    if (validCards.length === 0) {
      // No valid cards to transfer, complete immediately  
      return {
        type: 'complete',
        newState,
        events
      };
    }

    return {
      type: 'need_choice',
      newState,
      events,
      choice: {
        id: `enterprise_transfer_${targetPlayer}`,
        type: 'select_cards',
        playerId: targetPlayer,
        prompt: 'Select a non-purple Crown card from your board to transfer',
        source: 'enterprise_card_effect',
        from: { playerId: targetPlayer, zone: 'board' },
        minCards: 1,
        maxCards: 1
      },
      nextState: {
        ...state,
        step: 'waiting_transfer_choice'
      }
    };
  }

  if (state.step === 'waiting_transfer_choice') {
    if (choiceAnswer?.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
      const transferredCardId = choiceAnswer.selectedCards[0];
      const targetPlayer = affectedPlayers[0]!;
      
      // Transfer the card to activating player's score pile
      newState = transferCard(
        newState, 
        targetPlayer,
        activatingPlayer,
        transferredCardId, 
        'board',
        'score',
        events
      );

      return {
        type: 'continue',
        newState,
        events,
        nextState: {
          ...state,
          step: 'draw_and_meld',
          transferredCardId
        }
      };
    }
  }

  if (state.step === 'draw_and_meld') {
    const { transferredCardId } = state;
    
    if (!transferredCardId) {
      // No card was transferred, complete without drawing
      return {
        type: 'complete',
        newState,
        events
      };
    }
    
    // Since a card was transferred, draw and meld a 4
    newState = drawCard(newState, activatingPlayer, 4, events);
    // Get the last drawn card from hand to meld it
    const player = newState.players[activatingPlayer]!;
    const drawnCardId = player.hands[player.hands.length - 1];
    if (drawnCardId !== undefined) {
      newState = meldCard(newState, activatingPlayer, drawnCardId, events);
    }

    return {
      type: 'complete',
      newState,
      events
    };
  }

  return {
    type: 'complete',
    newState,
    events
  };
}

// ============================================================================
// Complex Card: Gunpowder (ID 40) - Demand transfer Castle, then draw and score 2 if transferred
// ============================================================================

interface GunpowderState {
  step: 'demand_transfer' | 'waiting_transfer_choice' | 'check_transfer_and_draw';
  transferredCardId?: CardId;
}

export function gunpowderEffect(
  context: DogmaContext,
  state: GunpowderState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer, affectedPlayers } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  if (state.step === 'demand_transfer') {
    const targetPlayer = affectedPlayers[0];
    
    if (!targetPlayer) {
      // No affected players, complete immediately
      return {
        type: 'complete',
        newState,
        events
      };
    }
    
    // Check if they have any Castle cards on their board
    const hasCastleCards = gameData.players[targetPlayer]!.colors.some((colorStack) => {
      const topCard = CARDS.cardsById.get(colorStack.cards[colorStack.cards.length - 1]);
      return topCard && hasIcon(gameData, targetPlayer, 'Castle');
    });
    
    if (!hasCastleCards) {
      // No Castle cards to transfer, complete immediately
      return {
        type: 'complete',
        newState,
        events
      };
    }

    return {
      type: 'need_choice',
      newState,
      events,
      choice: {
        id: `gunpowder_transfer_${targetPlayer}`,
        type: 'select_cards',
        playerId: targetPlayer,
        prompt: 'Select a Castle card from your board to transfer to opponent\'s score pile',
        source: 'gunpowder_card_effect',
        from: { playerId: targetPlayer, zone: 'board' },
        minCards: 1,
        maxCards: 1
      },
      nextState: {
        ...state,
        step: 'waiting_transfer_choice'
      }
    };
  }

  if (state.step === 'waiting_transfer_choice') {
    if (choiceAnswer?.type === 'select_cards' && choiceAnswer.selectedCards.length > 0) {
      const transferredCardId = choiceAnswer.selectedCards[0];
      const targetPlayer = affectedPlayers[0]!;
      
      // Transfer the card to activating player's score pile
      newState = transferCard(
        newState, 
        targetPlayer,
        activatingPlayer,
        transferredCardId, 
        'board',
        'score',
        events
      );

      return {
        type: 'continue',
        newState,
        events,
        nextState: {
          ...state,
          step: 'check_transfer_and_draw',
          transferredCardId
        }
      };
    }
  }

  if (state.step === 'check_transfer_and_draw') {
    if (state.transferredCardId) {
      // Since a card was transferred, draw and score a 2
      newState = drawCard(newState, activatingPlayer, 2, events);
      // Get the last drawn card from hand to score it
      const player = newState.players[activatingPlayer]!;
      const drawnCardId = player.hands[player.hands.length - 1];
      if (drawnCardId !== undefined) {
        newState = scoreCard(newState, activatingPlayer, drawnCardId, events);
      }
    }
    
    return {
      type: 'complete',
      newState,
      events
    };
  }

  return {
    type: 'complete',
    newState,
    events
  };
}

// ============================================================================
// Complex Card: Invention (ID 41) - Optional splay right (if left), then draw+score 4
// ============================================================================

interface InventionState {
  step: 'check_splay_options' | 'waiting_splay_choice' | 'draw_and_score';
  splayedColor?: string;
}

export function inventionEffect(
  context: DogmaContext,
  state: InventionState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_splay_options': {
      // Find colors currently splayed left
      const leftSplayedColors = gameData.players[activatingPlayer]!.colors
        .filter(colorStack => colorStack.splayDirection === 'left')
        .map(colorStack => colorStack.color);

      if (leftSplayedColors.length === 0) {
        // No colors splayed left, complete immediately
        return { type: 'complete', newState, events };
      }

      // Offer choice to splay one of these colors right
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `invention_splay_${activatingPlayer}`,
          type: 'select_pile',
          playerId: activatingPlayer,
          prompt: 'Select a color currently splayed left to splay right instead',
          source: 'invention_card_effect',
          availableColors: leftSplayedColors,
          operation: 'splay_right'
        },
        nextState: {
          ...state,
          step: 'waiting_splay_choice'
        }
      };
    }

    case 'waiting_splay_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_pile') {
        throw new Error('Expected pile selection');
      }

      const pileAnswer = choiceAnswer as SelectPileAnswer;
      const selectedColor = pileAnswer.selectedColor;
      
      // Splay the selected color right
      newState = splayColor(newState, activatingPlayer, selectedColor, 'right', events);
      
      // Since a color was splayed, draw and score a 4
      newState = drawAndScore(newState, activatingPlayer, 4, 1, events);
      
      // TODO: Check for Wonder achievement (if 5 colors splayed in any direction)
      // This would require checking all color stacks for splay directions
      
      return { type: 'complete', newState, events };
    }

    case 'draw_and_score': {
      // This step is no longer needed since we handle everything in waiting_splay_choice
      throw new Error('Unexpected step: draw_and_score should not be reached');
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// ============================================================================
// Simple Card: Navigation (ID 42) - Demand transfer 2 or 3 from score
// ============================================================================

interface NavigationState {
  step: 'demand_transfer' | 'waiting_transfer_choice';
  targetPlayer?: PlayerId;
  validCards?: CardId[];
}

export function navigationEffect(
  context: DogmaContext,
  state: NavigationState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer, affectedPlayers } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'demand_transfer': {
      // Find target player (should be the opponent with fewer Crown icons)
      const potentialTargets = affectedPlayers.filter(pid => pid !== activatingPlayer);
      const targetPlayer = potentialTargets[0];
      
      if (!targetPlayer) {
        // No potential target players, complete immediately
        return { type: 'complete', newState, events };
      }
      
      // Check if target player has fewer Crown icons (demand condition)
      const activatingPlayerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
      const targetPlayerCrowns = countIcons(gameData, targetPlayer, 'Crown');
      
      if (targetPlayerCrowns >= activatingPlayerCrowns) {
        // Target player is not vulnerable to demand, complete immediately
        return { type: 'complete', newState, events };
      }
      
      // Find age 2 or 3 cards in target player's score pile
      const validCards = gameData.players[targetPlayer]!.scores.filter(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && (card.age === 2 || card.age === 3);
      });
      
      if (validCards.length === 0) {
        // No valid cards to transfer, complete immediately  
        return { type: 'complete', newState, events };
      }

      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `navigation_transfer_${targetPlayer}`,
          type: 'select_cards',
          playerId: targetPlayer,
          prompt: 'Select an age 2 or 3 card from your score pile to transfer',
          source: 'navigation_card_effect',
          from: { zone: 'score', playerId: targetPlayer },
          minCards: 1,
          maxCards: 1,
          filter: { ages: [2, 3] }
        },
        nextState: {
          ...state,
          step: 'waiting_transfer_choice',
          targetPlayer,
          validCards
        }
      };
    }

    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        // No valid selection, complete
        return { type: 'complete', newState, events };
      }

      const transferredCardId = choiceAnswer.selectedCards[0]!;
      const targetPlayer = state.targetPlayer!;
      
      // Transfer the card from target's score to activating player's score
      newState = transferCard(
        newState, 
        targetPlayer,
        activatingPlayer,
        transferredCardId, 
        'score',
        'score',
        events
      );

      return { type: 'complete', newState, events };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// ============================================================================
// Simple Card: Perspective (ID 43) - Optional return hand card, score based on Lightbulb icons
// ============================================================================

interface PerspectiveState {
  step: 'check_hand' | 'waiting_return_choice' | 'score_cards';
}

export function perspectiveEffect(
  context: DogmaContext,
  state: PerspectiveState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_hand': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        return { type: 'complete', newState, events };
      }

      // Offer optional choice to return a card from hand
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `perspective_return_${activatingPlayer}`,
          type: 'select_cards',
          playerId: activatingPlayer,
          prompt: 'You may return a card from your hand. If you do, score cards based on Lightbulb icons.',
          source: 'perspective_card_effect',
          from: { zone: 'hand', playerId: activatingPlayer },
          minCards: 0,
          maxCards: 1
        },
        nextState: {
          ...state,
          step: 'waiting_return_choice'
        }
      };
    }

    case 'waiting_return_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        // No choice made, complete
        return { type: 'complete', newState, events };
      }

      if (choiceAnswer.selectedCards.length === 0) {
        // Player chose not to return a card, complete
        return { type: 'complete', newState, events };
      }

      const returnedCardId = choiceAnswer.selectedCards[0]!;
      const returnedCard = CARDS.cardsById.get(returnedCardId);
      
      if (!returnedCard) {
        throw new Error(`Card ${returnedCardId} not found in database`);
      }

      // Return the card to supply
      newState = returnCard(newState, activatingPlayer, returnedCardId, returnedCard.age, events);

      return {
        type: 'continue',
        newState,
        events,
        nextState: {
          ...state,
          step: 'score_cards'
        }
      };
    }

    case 'score_cards': {
      // Count Lightbulb icons on the board
      const lightbulbCount = countIcons(gameData, activatingPlayer, 'Lightbulb');
      const cardsToScore = Math.floor(lightbulbCount / 2);
      
      const player = newState.players[activatingPlayer]!;
      
      // Score cards from hand (up to the calculated amount)
      for (let i = 0; i < cardsToScore && player.hands.length > 0; i++) {
        const cardToScore = player.hands[player.hands.length - 1]!; // Score from top of hand
        newState = scoreCard(newState, activatingPlayer, cardToScore, events);
      }

      return { type: 'complete', newState, events };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// ============================================================================
// Simple Card: Printing Press (ID 44) - Optional return score card, optional splay blue
// ============================================================================

interface PrintingPressState {
  step: 'check_score_choice' | 'waiting_return_choice' | 'check_splay_choice' | 'waiting_splay_choice';
}

export function printingPressEffect(
  context: DogmaContext,
  state: PrintingPressState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_score_choice': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.scores.length === 0) {
        // No score cards, skip to splay choice
        return {
          type: 'continue',
          newState,
          events,
          nextState: {
            ...state,
            step: 'check_splay_choice'
          }
        };
      }

      // Offer optional choice to return a score card
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `printing_press_return_${activatingPlayer}`,
          type: 'select_cards',
          playerId: activatingPlayer,
          prompt: 'You may return a card from your score pile. If you do, draw based on top purple card.',
          source: 'printing_press_card_effect',
          from: { zone: 'score', playerId: activatingPlayer },
          minCards: 0,
          maxCards: 1
        },
        nextState: {
          ...state,
          step: 'waiting_return_choice'
        }
      };
    }

    case 'waiting_return_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        // No choice made, proceed to splay choice
        return {
          type: 'continue',
          newState,
          events,
          nextState: {
            ...state,
            step: 'check_splay_choice'
          }
        };
      }

      if (choiceAnswer.selectedCards.length === 0) {
        // Player chose not to return a card, proceed to splay choice
        return {
          type: 'continue',
          newState,
          events,
          nextState: {
            ...state,
            step: 'check_splay_choice'
          }
        };
      }

      const returnedCardId = choiceAnswer.selectedCards[0]!;
      const returnedCard = CARDS.cardsById.get(returnedCardId);
      
      if (!returnedCard) {
        throw new Error(`Card ${returnedCardId} not found in database`);
      }

      // Return the card to supply
      newState = returnCard(newState, activatingPlayer, returnedCardId, returnedCard.age, events);

      // Find top purple card age (or 0 if no purple cards)
      const purpleStack = newState.players[activatingPlayer]!.colors.find(
        stack => stack.color === 'Purple' && stack.cards.length > 0
      );
      
      let purpleAge = 0;
      if (purpleStack) {
        const topPurpleCardId = purpleStack.cards[purpleStack.cards.length - 1]!;
        const topPurpleCard = CARDS.cardsById.get(topPurpleCardId);
        if (topPurpleCard) {
          purpleAge = topPurpleCard.age;
        }
      }

      // Draw card of value two higher than top purple card
      const drawAge = purpleAge + 2;
      newState = drawCard(newState, activatingPlayer, drawAge, events);

      return {
        type: 'continue',
        newState,
        events,
        nextState: {
          ...state,
          step: 'check_splay_choice'
        }
      };
    }

    case 'check_splay_choice': {
      // Check if player has blue cards to splay
      const blueStack = gameData.players[activatingPlayer]!.colors.find(
        stack => stack.color === 'Blue'
      );
      
      if (!blueStack || blueStack.cards.length <= 1) {
        // No blue cards or only one blue card, cannot splay
        return { type: 'complete', newState, events };
      }

      // Offer optional choice to splay blue right
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `printing_press_splay_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may splay your blue cards right.',
          source: 'printing_press_card_effect',
          yesText: 'Splay blue right',
          noText: 'Skip'
        },
        nextState: {
          ...state,
          step: 'waiting_splay_choice'
        }
      };
    }

    case 'waiting_splay_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        // No choice made, complete
        return { type: 'complete', newState, events };
      }

      if (choiceAnswer.answer === true) {
        // Player chose to splay blue right
        newState = splayColor(newState, activatingPlayer, 'Blue', 'right', events);
      }

      return { type: 'complete', newState, events };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// ============================================================================
// Simple Card: Reformation (ID 45) - Optional tuck based on Leaf icons, optional splay
// ============================================================================

export const reformationEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  const player = newState.players[activatingPlayer]!;
  
  // Count Leaf icons and calculate how many cards to tuck
  const leafCount = countIcons(gameData, activatingPlayer, 'Leaf');
  const cardsToTuck = Math.floor(leafCount / 2);
  
  // Tuck cards from hand (up to the calculated amount)
  for (let i = 0; i < cardsToTuck && player.hands.length > 0; i++) {
    const cardToTuck = player.hands[player.hands.length - 1]!; // Tuck from top of hand
    const card = CARDS.cardsById.get(cardToTuck);
    if (!card) {
      throw new Error(`Card ${cardToTuck} not found in database`);
    }
    newState = tuckCard(newState, activatingPlayer, cardToTuck, card.color, events);
  }
  
  // Optional splay yellow and purple right (simplified - just do it if possible)
  const yellowStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Yellow' && stack.cards.length > 1
  );
  if (yellowStack) {
    newState = splayColor(newState, activatingPlayer, 'Yellow', 'right', events);
  }
  
  const purpleStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Purple' && stack.cards.length > 1
  );
  if (purpleStack) {
    newState = splayColor(newState, activatingPlayer, 'Purple', 'right', events);
  }
  
  return [newState, events];
});

// ============================================================================
// Age 5 Cards
// ============================================================================

// Simple Card: Coal (ID 49) - Draw and tuck a 5
export const coalEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw and tuck a 5
  newState = drawAndTuck(newState, activatingPlayer, 5, 1, events);
  
  // TODO: Add optional splay red right
  // TODO: Add optional score top card and card beneath it
  
  return [newState, events];
});

// Simple Card: Steam Engine (ID 55) - Draw and tuck two 4s, then score bottom yellow card
export const steamEngineEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw and tuck two 4s
  newState = drawAndTuck(newState, activatingPlayer, 4, 2, events);
  
  // Score bottom yellow card if player has yellow cards
  const yellowColorStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Yellow' && stack.cards.length > 0
  );
  
  if (yellowColorStack) {
    const bottomYellowCard = yellowColorStack.cards[0]; // Bottom card is first in array
    // Remove from board
    yellowColorStack.cards.shift();
    if (yellowColorStack.cards.length === 0) {
      // Remove empty color stack
      const stackIndex = newState.players[activatingPlayer]!.colors.indexOf(yellowColorStack);
      newState.players[activatingPlayer]!.colors.splice(stackIndex, 1);
    }
    // Add to score pile
    newState.players[activatingPlayer]!.scores.push(bottomYellowCard);
    
    events.push({
      id: Math.random(), // TODO: Better ID generation
      type: 'scored',
      playerId: activatingPlayer,
      cardId: bottomYellowCard,
      fromZone: 'board',
      timestamp: Date.now()
    });
  }
  
  return [newState, events];
});

// ============================================================================
// Simple Card: Physics (ID 51) - Draw three 6s, return all if 2+ same color
// ============================================================================

export const physicsEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  const drawnCards: CardId[] = [];
  
  // Draw three 6s and reveal them
  for (let i = 0; i < 3; i++) {
    newState = drawCard(newState, activatingPlayer, 6, events);
    const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
    drawnCards.push(drawnCardId);
    
    // Reveal the drawn card
    newState = revealCard(newState, activatingPlayer, drawnCardId, events);
  }
  
  // Check if two or more drawn cards are of the same color
  const colors = drawnCards.map(cardId => {
    const card = CARDS.cardsById.get(cardId);
    return card?.color;
  }).filter(color => color !== undefined);
  
  const colorCounts = new Map<string, number>();
  for (const color of colors) {
    colorCounts.set(color!, (colorCounts.get(color!) || 0) + 1);
  }
  
  const hasDuplicateColors = Array.from(colorCounts.values()).some(count => count >= 2);
  
  if (hasDuplicateColors) {
    // Return all drawn cards and all cards in hand
    const player = newState.players[activatingPlayer]!;
    
    // Return drawn cards first
    for (const cardId of drawnCards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
      }
    }
    
    // Return all remaining cards in hand
    const handCards = [...player.hands];
    for (const cardId of handCards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
      }
    }
  }
  // Otherwise, keep the drawn cards (they're already in hand)
  
  return [newState, events];
});

// ============================================================================
// Age 5 Card: Measurement (ID 50) - Optional return hand, splay color right, draw based on count
// ============================================================================

export const measurementEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  const player = newState.players[activatingPlayer]!;
  
  // Simplified: if player has hand cards, return one and splay any available color right
  if (player.hands.length > 0) {
    const cardToReturn = player.hands[player.hands.length - 1]!;
    const card = CARDS.cardsById.get(cardToReturn);
    if (card) {
      newState = returnCard(newState, activatingPlayer, cardToReturn, card.age, events);
      
      // Find a color with 2+ cards to splay right
      const colorToSplay = newState.players[activatingPlayer]!.colors.find(
        stack => stack.cards.length > 1
      );
      
      if (colorToSplay) {
        newState = splayColor(newState, activatingPlayer, colorToSplay.color, 'right', events);
        
        // Draw cards equal to the number of cards in that color
        const cardCount = colorToSplay.cards.length;
        for (let i = 0; i < cardCount; i++) {
          newState = drawCard(newState, activatingPlayer, cardCount, events);
        }
      }
    }
  }
  
  return [newState, events];
});

// ============================================================================
// Age 5 Card: Astronomy (ID 46) - Draw/reveal 6, meld if green/blue, repeat
// ============================================================================

export const astronomyEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Simplified: Draw and reveal a 6, meld if green or blue (no repeat for now)
  newState = drawCard(newState, activatingPlayer, 6, events);
  
  const player = newState.players[activatingPlayer]!;
  const drawnCardId = player.hands[player.hands.length - 1];
  
  if (drawnCardId !== undefined) {
    const drawnCard = CARDS.cardsById.get(drawnCardId);
    
    // Emit reveal event
    const revealEvent = emitEvent(newState, 'card_revealed', {
      playerId: activatingPlayer,
      cardId: drawnCardId,
      fromZone: 'hand'
    });
    events.push(revealEvent);
    
    // If green or blue, meld it
    if (drawnCard && (drawnCard.color === 'Green' || drawnCard.color === 'Blue')) {
      newState = meldCard(newState, activatingPlayer, drawnCardId, events);
    }
    
    // TODO: Check Universe achievement (if all non-purple top cards are age 6+)
    // TODO: Add repeat logic for green/blue cards
  }
  
  return [newState, events];
});

// ============================================================================
// Age 5 Card: Chemistry (ID 48) - Optional splay blue right, draw/score higher, return score card
// ============================================================================

export const chemistryEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Level 1: Optional splay blue right
  const blueStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Blue' && stack.cards.length > 1
  );
  if (blueStack) {
    newState = splayColor(newState, activatingPlayer, 'Blue', 'right', events);
  }
  
  // Level 2: Draw and score card one higher than highest top card, then return score card
  // Find highest top card age
  let highestAge = 0;
  for (const colorStack of newState.players[activatingPlayer]!.colors) {
    if (colorStack.cards.length > 0) {
      const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
      const topCard = CARDS.cardsById.get(topCardId);
      if (topCard && topCard.age > highestAge) {
        highestAge = topCard.age;
      }
    }
  }
  
  // Draw and score one higher than highest
  const drawAge = highestAge + 1;
  newState = drawAndScore(newState, activatingPlayer, drawAge, 1, events);
  
  // Return a card from score pile (simplified - return the first one if any)
  const player = newState.players[activatingPlayer]!;
  if (player.scores.length > 0) {
    const cardToReturn = player.scores[0]!;
    const card = CARDS.cardsById.get(cardToReturn);
    if (card) {
      // Remove from score pile
      const scoreIndex = newState.players[activatingPlayer]!.scores.indexOf(cardToReturn);
      newState.players[activatingPlayer]!.scores.splice(scoreIndex, 1);
      
      // Add to supply pile
      const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
      if (supplyPile) {
        supplyPile.cards.push(cardToReturn);
        
        // Emit return event
        const returnEvent = emitEvent(newState, 'returned', {
          playerId: activatingPlayer,
          cardId: cardToReturn,
          fromZone: { playerId: activatingPlayer, zone: 'score' },
          toAge: card.age,
        });
        events.push(returnEvent);
      }
    }
  }
  
  return [newState, events];
});

// ============================================================================
// Age 6 Cards
// ============================================================================

// Age 6 Card: Atomic Theory (ID 56) - Optional splay blue right, draw and meld 7
export const atomicTheoryEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Level 1: Optional splay blue right
  const blueStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Blue' && stack.cards.length > 1
  );
  if (blueStack) {
    newState = splayColor(newState, activatingPlayer, 'Blue', 'right', events);
  }
  
  // Level 2: Draw and meld a 7
  newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
  
  return [newState, events];
});

