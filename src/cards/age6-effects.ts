// Age 6 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId } from '../types/index.js';
import { 
  drawAndMeld, 
  splayColor, 
  drawAndScore, 
  drawAndTuck, 
  getTopCards,
  moveCardBetweenZones,
  hasIcon,
  scoreCardsFromBoard,
  revealCard,
  transferCard,
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

// Canning (ID 57) - Optional draw/tuck 6, score cards without Factory, optional splay yellow right
interface CanningState {
  step: 'check_draw_choice' | 'waiting_draw_choice' | 'check_splay_choice' | 'waiting_splay_choice';
}

export function canningEffect(
  context: DogmaContext,
  state: CanningState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_draw_choice': {
      // Offer optional choice to draw and tuck a 6
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `canning_draw_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may draw and tuck a 6.',
          source: 'canning_card_effect',
          yesText: 'Draw and tuck a 6',
          noText: 'Skip drawing'
        },
        nextState: {
          ...state,
          step: 'waiting_draw_choice'
        }
      };
    }

    case 'waiting_draw_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        // No choice made, proceed to splay choice
        // Check if player has yellow cards to splay (with 2+ cards)
        const yellowStack = newState.players[activatingPlayer]!.colors.find(
          (stack: any) => stack.color === 'Yellow' && stack.cards.length > 1
        );
        
        if (!yellowStack) {
          // No eligible yellow cards, complete
          return { type: 'complete', newState, events, effectType: 'non-demand' };
        }

        // Offer optional choice to splay yellow right
        return {
          type: 'need_choice',
          newState,
          events,
          choice: {
            id: `canning_splay_${activatingPlayer}`,
            type: 'yes_no',
            playerId: activatingPlayer,
            prompt: 'You may splay your yellow cards right.',
            source: 'canning_card_effect',
            yesText: 'Splay yellow cards right',
            noText: 'Skip splaying'
          },
          nextState: {
            ...state,
            step: 'waiting_splay_choice'
          }
        };
      }

      if (choiceAnswer.answer) {
        // Player chose to draw and tuck a 6
        newState = drawAndTuck(newState, activatingPlayer, 6, 1, events);
        
        // Score all top cards without Factory icons
        const topCards = getTopCards(newState, activatingPlayer);
        const cardsToScore: number[] = [];
        
        for (const cardId of topCards) {
          const card = CARDS.cardsById.get(cardId);
          if (card) {
            // Check if this card has a Factory icon in any position
            const hasFactoryIcon = Object.values(card.positions).includes('Factory');
            if (!hasFactoryIcon) {
              cardsToScore.push(cardId);
            }
          }
        }
        
        // Score the cards without Factory icons using the primitive
        newState = scoreCardsFromBoard(newState, activatingPlayer, cardsToScore, events);
      }

      // Now check for splay choice
      // Check if player has yellow cards to splay (with 2+ cards)
      const yellowStack = newState.players[activatingPlayer]!.colors.find(
        (stack: any) => stack.color === 'Yellow' && stack.cards.length > 1
      );
      
      if (!yellowStack) {
        // No eligible yellow cards, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Offer optional choice to splay yellow right
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `canning_splay_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may splay your yellow cards right.',
          source: 'canning_card_effect',
          yesText: 'Splay yellow cards right',
          noText: 'Skip splaying'
        },
        nextState: {
          ...state,
          step: 'waiting_splay_choice'
        }
      };
    }

    case 'check_splay_choice': {
      // Check if player has yellow cards to splay (with 2+ cards)
      const yellowStack = newState.players[activatingPlayer]!.colors.find(
        (stack: any) => stack.color === 'Yellow' && stack.cards.length > 1
      );
      
      if (!yellowStack) {
        // No eligible yellow cards, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Offer optional choice to splay yellow right
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `canning_splay_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may splay your yellow cards right.',
          source: 'canning_card_effect',
          yesText: 'Splay yellow cards right',
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
        // No choice made, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      if (choiceAnswer.answer) {
        // Player chose to splay yellow right
        newState = splayColor(newState, activatingPlayer, 'Yellow', 'right', events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Classification (ID 58) - Reveal hand color, take all cards of that color from opponents, meld all
interface ClassificationState {
  step: 'check_hand' | 'waiting_reveal_choice';
}

export function classificationEffect(
  context: DogmaContext,
  state: ClassificationState,
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
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Offer choice to reveal a card from hand
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `classification_reveal_${activatingPlayer}`,
          type: 'select_cards',
          playerId: activatingPlayer,
          prompt: 'Reveal the color of a card from your hand',
          source: 'classification_card_effect',
          from: { zone: 'hand', playerId: activatingPlayer },
          minCards: 1,
          maxCards: 1
        },
        nextState: {
          ...state,
          step: 'waiting_reveal_choice'
        }
      };
    }

    case 'waiting_reveal_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        // No choice made, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      const revealedCardId = choiceAnswer.selectedCards[0]!;
      const revealedCard = CARDS.cardsById.get(revealedCardId);
      
      if (!revealedCard) {
        throw new Error(`Card ${revealedCardId} not found in database`);
      }

      // Reveal the card
      newState = revealCard(newState, activatingPlayer, revealedCardId, events);
      
      const revealedColor = revealedCard.color;

      // Take all cards of that color from all other players' hands
      for (const opponentId of [0, 1] as PlayerId[]) {
        if (opponentId === activatingPlayer) continue;
        
        const opponent = newState.players[opponentId]!;
        const cardsToTake: number[] = [];
        
        // Find all cards of the revealed color in opponent's hand
        for (const cardId of opponent.hands) {
          const card = CARDS.cardsById.get(cardId);
          if (card && card.color === revealedColor) {
            cardsToTake.push(cardId);
          }
        }
        
        // Transfer each card from opponent to activating player
        for (const cardId of cardsToTake) {
          newState = transferCard(newState, opponentId, activatingPlayer, cardId, 'hand', 'hand', events);
        }
      }

      // Meld all cards of that color from activating player's hand
      const player = newState.players[activatingPlayer]!;
      const cardsToMeld: number[] = [];
      
      // Find all cards of the revealed color in activating player's hand
      for (const cardId of player.hands) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.color === revealedColor) {
          cardsToMeld.push(cardId);
        }
      }
      
      // Meld each card
      for (const cardId of cardsToMeld) {
        newState = meldCard(newState, activatingPlayer, cardId, events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 