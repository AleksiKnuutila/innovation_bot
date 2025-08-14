// Age 6 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId } from '../types/index.js';
import { drawAndMeld, splayColor, drawAndScore } from '../engine/state-manipulation.js';
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

// Simple effect wrapper helper
function createSimpleEffect(
  effectFn: (context: DogmaContext) => [any, GameEvent[]]
): (context: DogmaContext, state: any, choiceAnswer?: any) => EffectResult {
  return (context: DogmaContext, state: any, _choiceAnswer?: any): EffectResult => {
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
      effectType: 'non-demand' 
    };
  };
}

// ============================================================================
// Age 6 Cards
// ============================================================================

// Atomic Theory (ID 56) - Optional splay blue right, draw and meld a 7
interface AtomicTheoryState {
  step: 'check_splay_choice' | 'waiting_splay_choice';
}

export function atomicTheoryEffect(
  context: DogmaContext,
  state: AtomicTheoryState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_splay_choice': {
      // Check if player has blue cards to splay (with 2+ cards)
      const blueStack = gameData.players[activatingPlayer]!.colors.find(
        stack => stack.color === 'Blue' && stack.cards.length > 1
      );
      
      if (!blueStack) {
        // No eligible blue cards, skip to draw and meld immediately
        newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Offer optional choice to splay blue right
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `atomic_theory_splay_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may splay your blue cards right.',
          source: 'atomic_theory_card_effect',
          yesText: 'Splay blue cards right',
          noText: 'Skip splaying'
        },
        nextState: {
          ...state,
          step: 'waiting_splay_choice'
        }
      };
    }

    case 'waiting_splay_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        // No choice made, proceed to draw and meld immediately
        newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      if (choiceAnswer.answer) {
        // Player chose to splay blue right
        newState = splayColor(newState, activatingPlayer, 'Blue', 'right', events);
      }

      // Now immediately draw and meld a 7
      newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Machine Tools (ID 63) - Draw and score a card equal to highest score card value
export const machineToolsEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  const player = newState.players[activatingPlayer]!;
  
  // Find the highest age card in score pile
  let highestAge = 0;
  for (const cardId of player.scores) {
    const card = CARDS.cardsById.get(cardId);
    if (card && card.age > highestAge) {
      highestAge = card.age;
    }
  }
  
  // If there are score cards, draw and score a card of that age
  if (highestAge > 0) {
    newState = drawAndScore(newState, activatingPlayer, highestAge, 1, events);
  }
  
  return [newState, events];
}); 