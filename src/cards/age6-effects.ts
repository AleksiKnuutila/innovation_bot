// Age 6 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import { drawAndMeld, splayColor } from '../engine/state-manipulation.js';
import { emitEvent } from '../engine/events.js';

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

// ============================================================================
// Age 6 Cards
// ============================================================================

interface AtomicTheoryState {
  step: 'check_splay_choice' | 'waiting_splay_choice' | 'draw_and_meld';
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
      // Check if player has blue cards to splay
      const blueStack = gameData.players[activatingPlayer]!.colors.find(
        stack => stack.color === 'Blue' && stack.cards.length > 1
      );
      
      if (!blueStack) {
        // No blue cards to splay, execute draw/meld immediately
        newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
        return { type: 'complete', newState, events };
      }

      // Offer choice to splay blue right
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
      if (choiceAnswer && choiceAnswer.type === 'yes_no' && choiceAnswer.answer === true) {
        // Player chose to splay blue right
        newState = splayColor(newState, activatingPlayer, 'Blue', 'right', events);
      }

      // Execute draw and meld immediately
      newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
      
      return { type: 'complete', newState, events };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 