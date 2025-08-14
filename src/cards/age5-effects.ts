// Age 5 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId, CardId } from '../types/index.js';
import { 
  drawAndMeld, 
  drawAndTuck, 
  drawAndScore,
  splayColor, 
  countIcons,
  hasIcon,
  drawCard,
  transferCard,
  returnCard,
  revealCard,
  meldCard
} from '../engine/state-manipulation.js';
import { emitEvent } from '../engine/events.js';
import { CARDS } from '../cards/database.js';

// Helper function to emit dogma events
function emitDogmaEvent(
  gameData: any,
  context: DogmaContext,
  events: GameEvent[]
): void {
  const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
    playerId: context.activatingPlayer,
    cardId: context.cardId,
    dogmaLevel: context.dogmaLevel,
    source: `${context.cardId}_card_effect`
  });
  events.push(dogmaEvent);
}

// Helper function to check if a card has a specific icon
function cardHasIcon(cardId: CardId, icon: string): boolean {
  const card = CARDS.cardsById.get(cardId);
  if (!card) return false;
  
  const positions = card.positions;
  return positions.top === icon || 
         positions.left === icon || 
         positions.middle === icon || 
         positions.right === icon;
}

// Simple effect wrapper helper
function createSimpleEffect(
  effectFn: (context: DogmaContext) => [any, GameEvent[]]
): (context: DogmaContext, state: any, choiceAnswer?: any) => EffectResult {
  return (context: DogmaContext, state: any, _choiceAnswer?: any): EffectResult => {
    const [newState, events] = effectFn(context);
    return { 
      type: 'complete', 
      newState, 
      events, 
      effectType: 'non-demand' 
    };
  };
}

// ============================================================================
// Age 5 Cards
// ============================================================================

// Coal (ID 49) - Draw and tuck a 5
export const coalEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  newState = drawAndTuck(newState, activatingPlayer, 5, 1, events);
  
  return [newState, events];
});

// Steam Engine (ID 55) - Draw and tuck two 4s, then score bottom yellow card
export const steamEngineEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Draw and tuck two 4s
  newState = drawAndTuck(newState, activatingPlayer, 4, 2, events);
  
  // Score bottom yellow card
  const yellowStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Yellow'
  );
  
  if (yellowStack && yellowStack.cards.length > 0) {
    const bottomYellowCard = yellowStack.cards[0]!;
    
    // Remove from yellow stack
    yellowStack.cards.shift();
    
    // Add to score pile
    newState.players[activatingPlayer]!.scores.push(bottomYellowCard);
    
    // Emit scored event
    const scoredEvent = emitEvent(newState, 'scored', {
      playerId: activatingPlayer,
      cardIds: [bottomYellowCard]
    });
    events.push(scoredEvent);
  }
  
  return [newState, events];
});

// Banking (ID 47) - Demand transfer non-green Factory card, optional splay green right  
interface BankingState {
  step: 'execute_demand' | 'waiting_transfer_choice' | 'check_non_demand' | 'complete_splay_choice';
  affectedPlayers: PlayerId[];
  currentPlayerIndex: number;
  anyTransferred: boolean;
}

export function bankingEffect(
  context: DogmaContext,
  state: BankingState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer, cardId, dogmaLevel } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  switch (state.step) {
    case 'execute_demand': {
      // Find players with fewer Crown icons than the activating player
      const activatingPlayerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
      const affectedPlayers: PlayerId[] = [];
      
      // Iterate over all players (hardcoded for 2-player game like other effects)
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
        // No players affected by demand - go to non-demand effect
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: {
            step: 'check_non_demand',
            affectedPlayers: [],
            currentPlayerIndex: 0,
            anyTransferred: false
          }
        };
      }
      
      // Start processing first affected player
      const firstPlayer = affectedPlayers[0]!;
      
      // Find non-green top cards with Factory icons on their board
      const validCards: CardId[] = [];
      for (const colorStack of newState.players[firstPlayer]!.colors) {
        if (colorStack.color !== 'Green' && colorStack.cards.length > 0) {
          const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
          if (cardHasIcon(topCardId, 'Factory')) {
            validCards.push(topCardId);
          }
        }
      }
      
      if (validCards.length === 0) {
        // Skip to next player
        if (affectedPlayers.length === 1) {
          // No more players - go to non-demand effect
          return {
            type: 'continue',
            newState: gameData,
            events: [],
            nextState: {
              step: 'check_non_demand',
              affectedPlayers: [],
              currentPlayerIndex: 0,
              anyTransferred: false
            }
          };
        }
        
        return {
          type: 'continue',
          newState: gameData,
          events: [],
          nextState: {
            step: 'execute_demand',
            affectedPlayers: affectedPlayers.slice(1),
            currentPlayerIndex: 0,
            anyTransferred: false
          }
        };
      }
      
      // Offer choice to first affected player
      const choice = {
        id: 'banking_transfer_choice',
        playerId: firstPlayer,
        type: 'select_cards' as const,
        prompt: 'Select a non-green top card with Factory icon to transfer',
        source: 'banking_card_effect',
        from: { playerId: firstPlayer, zone: 'board' as const },
        minCards: 1,
        maxCards: 1,
        allowedCards: validCards
      };
      
      return {
        type: 'need_choice',
        newState: gameData,
        events: [],
        choice,
        nextState: {
          step: 'waiting_transfer_choice',
          affectedPlayers,
          currentPlayerIndex: 0,
          anyTransferred: false
        }
      };
    }

    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        throw new Error('Expected card selection choice answer');
      }
      
      const selectedCards = choiceAnswer.selectedCards;
      const currentPlayer = state.affectedPlayers[state.currentPlayerIndex]!;
      
      if (selectedCards.length === 0) {
        // Player chose not to transfer - skip to next player
        if (state.currentPlayerIndex < state.affectedPlayers.length - 1) {
          const nextPlayer = state.affectedPlayers[state.currentPlayerIndex + 1]!;
          
          // Find valid cards for next player
          const validCards: CardId[] = [];
          for (const colorStack of newState.players[nextPlayer]!.colors) {
            if (colorStack.color !== 'Green' && colorStack.cards.length > 0) {
              const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
              if (cardHasIcon(topCardId, 'Factory')) {
                validCards.push(topCardId);
              }
            }
          }
          
          if (validCards.length === 0) {
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
          
          const choice = {
            id: 'banking_transfer_choice',
            playerId: nextPlayer,
            type: 'select_cards' as const,
            prompt: 'Select a non-green top card with Factory icon to transfer',
            source: 'banking_card_effect',
            from: { playerId: nextPlayer, zone: 'board' as const },
            minCards: 1,
            maxCards: 1,
            allowedCards: validCards
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
        } else {
          // All players processed - go to non-demand effect
          return {
            type: 'continue',
            newState,
            events,
            nextState: {
              step: 'check_non_demand',
              affectedPlayers: [],
              currentPlayerIndex: 0,
              anyTransferred: state.anyTransferred
            }
          };
        }
      }
      
      // Transfer the selected card
      const cardToTransfer = selectedCards[0]!;
      newState = transferCard(newState, currentPlayer, activatingPlayer, cardToTransfer, 'board', 'board', events);
      
      // Activating player draws and scores a 5
      newState = drawAndScore(newState, activatingPlayer, 5, 1, events);
      
      // Check if more players need to be processed
      if (state.currentPlayerIndex < state.affectedPlayers.length - 1) {
        const nextPlayer = state.affectedPlayers[state.currentPlayerIndex + 1]!;
        
        // Find valid cards for next player
        const validCards: CardId[] = [];
        for (const colorStack of newState.players[nextPlayer]!.colors) {
          if (colorStack.color !== 'Green' && colorStack.cards.length > 0) {
            const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
            if (cardHasIcon(topCardId, 'Factory')) {
              validCards.push(topCardId);
            }
          }
        }
        
        if (validCards.length === 0) {
          // Skip to next player
          return {
            type: 'continue',
            newState,
            events,
            nextState: {
              ...state,
              currentPlayerIndex: state.currentPlayerIndex + 1,
              anyTransferred: true
            }
          };
        }
        
        const choice = {
          id: 'banking_transfer_choice',
          playerId: nextPlayer,
          type: 'select_cards' as const,
          prompt: 'Select a non-green top card with Factory icon to transfer',
          source: 'banking_card_effect',
          from: { playerId: nextPlayer, zone: 'board' as const },
          minCards: 1,
          maxCards: 1,
          allowedCards: validCards
        };
        
        return {
          type: 'need_choice',
          newState,
          events,
          choice,
          nextState: {
            ...state,
            currentPlayerIndex: state.currentPlayerIndex + 1,
            anyTransferred: true
          }
        };
      } else {
        // All players processed - go to non-demand effect
        return {
          type: 'continue',
          newState,
          events,
          nextState: {
            step: 'check_non_demand',
            affectedPlayers: [],
            currentPlayerIndex: 0,
            anyTransferred: true
          }
        };
      }
    }

    case 'check_non_demand': {
      // Non-demand effect: You may splay your green cards right
      const greenStack = newState.players[activatingPlayer]!.colors.find(
        stack => stack.color === 'Green'
      );
      
      if (!greenStack || greenStack.cards.length < 2) {
        // Cannot splay - complete effect
        emitDogmaEvent(newState, context, events);
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }
      
      const choice = {
        id: 'banking_splay_choice',
        playerId: activatingPlayer,
        type: 'yes_no' as const,
        prompt: 'You may splay your green cards right',
        source: 'banking_card_effect',
        yesText: 'Splay green cards right',
        noText: 'Do not splay'
      };
      
      return {
        type: 'need_choice',
        newState,
        events,
        choice,
        nextState: {
          step: 'complete_splay_choice',
          affectedPlayers: [],
          currentPlayerIndex: 0,
          anyTransferred: state.anyTransferred
        } as any
      };
    }
  }
  
  // Handle splay choice completion (additional state needed)
  if (state.step === 'complete_splay_choice') {
    if (choiceAnswer && choiceAnswer.type === 'yes_no' && choiceAnswer.answer) {
      newState = splayColor(newState, activatingPlayer, 'Green', 'right', events);
    }
    
    emitDogmaEvent(newState, context, events);
    return { type: 'complete', newState, events, effectType: 'non-demand' };
  }
  
  throw new Error(`Unknown Banking step: ${state.step}`);
}

// TODO: Add other Age 5 effects here when moved from effect-handlers.ts
// - physicsEffect
// - measurementEffect
// - astronomyEffect
// - chemistryEffect 