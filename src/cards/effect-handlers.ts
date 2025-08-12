// Card effect handlers using callback-based state machine pattern

import type { 
  DogmaContext, 
  CardEffectFunction, 
  EffectResult 
} from '../types/dogma.js';
import type { GameData, PlayerId } from '../types/index.js';
import type { GameEvent } from '../types/events.js';
import type { YesNoChoice, SelectCardsChoice } from '../types/choices.js';
import { emitEvent } from '../engine/events.js';
import { 
  drawCard, 
  tuckCard, 
  transferCard, 
  scoreCard 
} from '../engine/state-manipulation.js';

// ============================================================================
// Simple Card: Writing (No Choices)
// ============================================================================

interface WritingState {
  step: 'start';
}

export function writingEffect(
  context: DogmaContext, 
  state: WritingState, 
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'start': {
      // Writing: "Draw a 2" - should draw 2 cards from age 2
      let newState = gameData;
      const events: GameEvent[] = [];
      
      // Draw 2 cards from age 2 (or next available age)
      newState = drawCard(newState, activatingPlayer, 2, events);
      newState = drawCard(newState, activatingPlayer, 2, events);
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'writing_card_effect',
      });
      events.push(dogmaEvent);
      
      return { 
        type: 'complete', 
        newState, 
        events,
        effectType: 'non-demand' // This effect can be shared
      };
    }
    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// ============================================================================
// Medium Card: Code of Laws (Single Choice)
// ============================================================================

interface CodeOfLawsState {
  step: 'check_condition' | 'waiting_choice';
}

export function codeOfLawsEffect(
  context: DogmaContext, 
  state: CodeOfLawsState, 
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Check if player has the highest crown count
      const playerCrowns = countPlayerIcons(gameData, activatingPlayer, 'crown');
      const otherPlayerId: PlayerId = activatingPlayer === 0 ? 1 : 0;
      const otherPlayerCrowns = countPlayerIcons(gameData, otherPlayerId, 'crown');
      
      if (playerCrowns <= otherPlayerCrowns) {
        // Player doesn't have highest crown count - effect completes immediately
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'codeOfLaws_card_effect',
        });
        
        return { 
          type: 'complete', 
          newState: gameData, 
          events: [dogmaEvent],
          effectType: 'non-demand' // This effect can be shared
        };
      }
      
      // Player has highest crown count - offer choice
      const choice: YesNoChoice = {
        id: 'codeOfLaws_tuck_choice',
        playerId: activatingPlayer,
        type: 'yes_no',
        prompt: 'Tuck all cards from your hand?',
        source: 'codeOfLaws_card_effect',
        yesText: 'Tuck all cards from hand',
        noText: 'Do not tuck any cards'
      };
      
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice,
        nextState: { step: 'waiting_choice' }
      };
    }
    
    case 'waiting_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        throw new Error('Expected yes/no choice answer');
      }
      
      if (!choiceAnswer.answer) {
        // Player chose no - effect completes without action
        const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
          playerId: activatingPlayer,
          cardId: context.cardId,
          dogmaLevel: context.dogmaLevel,
          source: 'codeOfLaws_card_effect',
        });
        
        return { 
          type: 'complete', 
          newState: gameData, 
          events: [dogmaEvent] 
        };
      }
      
      // Player chose yes - tuck all cards from hand
      let newState = gameData;
      const events: GameEvent[] = [];
      
      const player = newState.players[activatingPlayer]!;
      const handCards = [...player.hands]; // Copy to avoid mutation during iteration
      
      for (const cardId of handCards) {
        // Get card color for tucking
        // TODO: Get actual card data - for now use a placeholder color
        const color = 'blue' as any; // Placeholder
        newState = tuckCard(newState, activatingPlayer, cardId, color, events);
      }
      
      // Emit dogma event
      const dogmaEvent = emitEvent(newState, 'dogma_activated', {
        playerId: activatingPlayer,
        cardId: context.cardId,
        dogmaLevel: context.dogmaLevel,
        source: 'codeOfLaws_card_effect',
      });
      events.push(dogmaEvent);
      
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
  choiceAnswer?: any
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'execute_demand': {
      // Find players with fewer crown icons than the activating player
      const activatingPlayerCrowns = countPlayerIcons(gameData, activatingPlayer, 'crown');
      const affectedPlayers: PlayerId[] = [];
      
      for (let playerId = 0; playerId < 2; playerId++) {
        const typedPlayerId = playerId as PlayerId;
        if (typedPlayerId !== activatingPlayer) {
          const playerCrowns = countPlayerIcons(gameData, typedPlayerId, 'crown');
          if (playerCrowns < activatingPlayerCrowns) {
            affectedPlayers.push(typedPlayerId);
          }
        }
      }
      
      if (affectedPlayers.length === 0) {
        // No players affected by demand - execute non-demand effect
        let newState = gameData;
        const events: GameEvent[] = [];
        
        newState = drawCard(newState, activatingPlayer, 1, events);
        const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
        newState = scoreCard(newState, activatingPlayer, drawnCardId, events);
        
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
          
          newState = drawCard(newState, activatingPlayer, 1, events);
          const drawnCardId = newState.players[activatingPlayer]!.hands[newState.players[activatingPlayer]!.hands.length - 1]!;
          newState = scoreCard(newState, activatingPlayer, drawnCardId, events);
          
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
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        throw new Error('Expected card selection choice answer');
      }
      
      const selectedCards = choiceAnswer.selectedCards;
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
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        throw new Error('Expected yes/no choice answer');
      }
      
      if (!choiceAnswer.answer) {
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
      
      newState = drawCard(newState, context.activatingPlayer, 1, events);
      const drawnCardId = newState.players[context.activatingPlayer]!.hands[newState.players[context.activatingPlayer]!.hands.length - 1]!;
      newState = scoreCard(newState, context.activatingPlayer, drawnCardId, events);
      
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

// Count icons for a specific player
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

// Export all effect functions for registration
export const CARD_EFFECT_HANDLERS = {
  writing: writingEffect,
  codeOfLaws: codeOfLawsEffect,
  oars: oarsEffect
}; 