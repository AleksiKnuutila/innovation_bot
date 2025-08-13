// Age 4 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId, CardId } from '../types/index.js';
import { 
  drawAndMeld, 
  drawAndTuck, 
  splayColor, 
  countIcons,
  hasIcon,
  drawCard,
  transferCard,
  returnCard,
  drawAndScore,
  scoreCard,
  tuckCard,
  moveCardBetweenZones
} from '../engine/state-manipulation.js';
import { emitEvent } from '../engine/events.js';
import { CARDS } from '../cards/database.js';
import { deepClone } from '../engine/utils.js';

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

// Helper function to return a card from score pile to supply pile
function returnCardFromScore(
  gameData: any,
  playerId: PlayerId,
  cardId: CardId,
  age: number,
  events: GameEvent[]
): any {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from score pile
  const scoreIndex = player.scores.indexOf(cardId);
  if (scoreIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s score pile`);
  }
  player.scores.splice(scoreIndex, 1);
  
  // Add card back to supply pile
  const supplyPile = newState.shared.supplyPiles.find((pile: any) => pile.age === age);
  if (!supplyPile) {
    throw new Error(`Supply pile for age ${age} not found`);
  }
  
  supplyPile.cards.push(cardId);
  
  // Emit return event
  const event = emitEvent(newState, 'returned', {
    playerId,
    cardId,
    fromZone: { playerId, zone: 'score' },
    toAge: age,
  });
  events.push(event);
  
  return newState;
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
// Age 4 Cards
// ============================================================================

// Experimentation (ID 39) - Draw and meld a 5
export const experimentationEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  newState = drawAndMeld(newState, activatingPlayer, 5, 1, events);
  
  return [newState, events];
});

// Colonialism (ID 37) - Draw and tuck a 3 (simplified version)
export const colonialismEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  newState = drawAndTuck(newState, activatingPlayer, 3, 1, events);
  
  return [newState, events];
});

// Perspective (ID 43) - Return card from hand, score cards based on Lightbulb icons
interface PerspectiveState {
  step: 'check_hand' | 'waiting_return_choice';
}

export function perspectiveEffect(
  context: DogmaContext,
  state: PerspectiveState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  switch (state.step) {
    case 'check_hand': {
      // Emit dogma_activated event at the start
      emitDogmaEvent(gameData, context, events);
      
      const player = gameData.players[activatingPlayer]!;
      
      if (player.hands.length === 0) {
        // No cards in hand, complete immediately
        return { type: 'complete', newState, events, effectType: 'non-demand' };
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
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      if (choiceAnswer.selectedCards.length === 0) {
        // Player chose not to return a card, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      const returnedCardId = choiceAnswer.selectedCards[0]!;
      const returnedCard = CARDS.cardsById.get(returnedCardId);
      
      if (!returnedCard) {
        throw new Error(`Card ${returnedCardId} not found in database`);
      }

      // Return the card to supply
      newState = returnCard(newState, activatingPlayer, returnedCardId, returnedCard.age, events);

      // Now immediately execute the scoring logic
      // Count Lightbulb icons on the board
      const lightbulbCount = countIcons(newState, activatingPlayer, 'Lightbulb');
      const cardsToScore = Math.floor(lightbulbCount / 2);
      
      const player = newState.players[activatingPlayer]!;
      
      // Score cards from hand (up to the calculated amount)
      for (let i = 0; i < cardsToScore && player.hands.length > 0; i++) {
        const cardToScore = player.hands[player.hands.length - 1]!; // Score from top of hand
        newState = scoreCard(newState, activatingPlayer, cardToScore, events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Printing Press (ID 44) - Optional return score card, optional splay blue
interface PrintingPressState {
  step: 'check_score_choice' | 'waiting_return_choice' | 'waiting_splay_choice';
}

export function printingPressEffect(
  context: DogmaContext,
  state: PrintingPressState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  switch (state.step) {
    case 'check_score_choice': {
      // Emit dogma_activated event at the start
      emitDogmaEvent(gameData, context, events);
      
      const player = gameData.players[activatingPlayer]!;
      
      if (player.scores.length === 0) {
        // No score cards, skip to splay choice
        // Check if player has blue cards to splay (with 2+ cards)
        const blueStack = gameData.players[activatingPlayer]!.colors.find(
          (stack: any) => stack.color === 'Blue' && stack.cards.length > 1
        );
        
        if (!blueStack) {
          // No eligible blue cards, complete
          return { type: 'complete', newState, events, effectType: 'non-demand' };
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
            yesText: 'Splay blue cards right',
            noText: 'Skip splaying'
          },
          nextState: {
            ...state,
            step: 'waiting_splay_choice'
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
        // Check if player has blue cards to splay (with 2+ cards)
        const blueStack = gameData.players[activatingPlayer]!.colors.find(
          (stack: any) => stack.color === 'Blue' && stack.cards.length > 1
        );
        
        if (!blueStack) {
          // No eligible blue cards, complete
          return { type: 'complete', newState, events, effectType: 'non-demand' };
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
            yesText: 'Splay blue cards right',
            noText: 'Skip splaying'
          },
          nextState: {
            ...state,
            step: 'waiting_splay_choice'
          }
        };
      }

      if (choiceAnswer.selectedCards.length === 0) {
        // Player chose not to return a card, proceed to splay choice
        // Check if player has blue cards to splay (with 2+ cards)
        const blueStack = gameData.players[activatingPlayer]!.colors.find(
          (stack: any) => stack.color === 'Blue' && stack.cards.length > 1
        );
        
        if (!blueStack) {
          // No eligible blue cards, complete
          return { type: 'complete', newState, events, effectType: 'non-demand' };
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
            yesText: 'Splay blue cards right',
            noText: 'Skip splaying'
          },
          nextState: {
            ...state,
            step: 'waiting_splay_choice'
          }
        };
      }

      const returnedCardId = choiceAnswer.selectedCards[0]!;
      const returnedCard = CARDS.cardsById.get(returnedCardId);
      
      if (!returnedCard) {
        throw new Error(`Card ${returnedCardId} not found in database`);
      }

      // Return the card from score pile to supply
      newState = returnCardFromScore(newState, activatingPlayer, returnedCardId, returnedCard.age, events);

      // Find top purple card age (or 0 if no purple cards)
      const purpleStack = newState.players[activatingPlayer]!.colors.find(
        (stack: any) => stack.color === 'Purple' && stack.cards.length > 0
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

      // Now immediately check for splay choice instead of continuing
      // Check if player has blue cards to splay (with 2+ cards)
      const blueStack = newState.players[activatingPlayer]!.colors.find(
        (stack: any) => stack.color === 'Blue' && stack.cards.length > 1
      );
      
      if (!blueStack) {
        // No eligible blue cards, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
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
        // No choice made, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      if (choiceAnswer.answer) {
        // Player chose to splay blue right
        newState = splayColor(newState, activatingPlayer, 'Blue', 'right', events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Reformation (ID 45) - Tuck cards based on Leaf icons, splay yellow/purple right
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
    (stack: any) => stack.color === 'Yellow' && stack.cards.length > 1
  );
  if (yellowStack) {
    newState = splayColor(newState, activatingPlayer, 'Yellow', 'right', events);
  }
  
  const purpleStack = newState.players[activatingPlayer]!.colors.find(
    (stack: any) => stack.color === 'Purple' && stack.cards.length > 1
  );
  if (purpleStack) {
    newState = splayColor(newState, activatingPlayer, 'Purple', 'right', events);
  }
  
  return [newState, events];
});

// TODO: Add other Age 4 effects here when moved from effect-handlers.ts
// - inventionEffect
// - navigationEffect  
// - anatomyEffect
// - enterpriseEffect
// - gunpowderEffect 