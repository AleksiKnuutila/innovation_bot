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
  meldCard,
  countIcons,
  returnCard,
  drawCard
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

// Encyclopedia (ID 61) - Optional meld all highest cards from score pile
interface EncyclopediaState {
  step: 'check_score' | 'waiting_meld_choice';
}

export function encyclopediaEffect(
  context: DogmaContext,
  state: EncyclopediaState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_score': {
      const player = gameData.players[activatingPlayer]!;
      
      if (player.scores.length === 0) {
        // No score cards, complete immediately
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Find the highest age among score cards
      let highestAge = 0;
      for (const cardId of player.scores) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.age > highestAge) {
          highestAge = card.age;
        }
      }

      // Count how many cards have the highest age
      const highestCards: number[] = [];
      for (const cardId of player.scores) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.age === highestAge) {
          highestCards.push(cardId);
        }
      }

      if (highestCards.length === 0) {
        // No cards found (shouldn't happen), complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Offer choice to meld all highest cards
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `encyclopedia_meld_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may meld all the highest cards in your score pile.',
          source: 'encyclopedia_card_effect',
          yesText: `Meld ${highestCards.length} highest card${highestCards.length > 1 ? 's' : ''}`,
          noText: 'Skip melding'
        },
        nextState: {
          ...state,
          step: 'waiting_meld_choice'
        }
      };
    }

    case 'waiting_meld_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        // No choice made, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      if (!choiceAnswer.answer) {
        // Player chose not to meld, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Player chose to meld - find all highest cards again
      const player = newState.players[activatingPlayer]!;
      
      let highestAge = 0;
      for (const cardId of player.scores) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.age > highestAge) {
          highestAge = card.age;
        }
      }

      const highestCards: number[] = [];
      for (const cardId of player.scores) {
        const card = CARDS.cardsById.get(cardId);
        if (card && card.age === highestAge) {
          highestCards.push(cardId);
        }
      }

      // Move each highest card from score pile to board (meld them)
      for (const cardId of highestCards) {
        // Get card data to determine color
        const card = CARDS.cardsById.get(cardId);
        if (!card) {
          throw new Error(`Card ${cardId} not found in database`);
        }

        // Remove from score pile
        const scoreIndex = player.scores.indexOf(cardId);
        if (scoreIndex !== -1) {
          player.scores.splice(scoreIndex, 1);
          
          // Add to appropriate color stack on board
          const existingColorStack = player.colors.find(stack => stack.color === card.color);
          if (existingColorStack) {
            existingColorStack.cards.push(cardId);
          } else {
            player.colors.push({
              color: card.color,
              cards: [cardId],
            });
          }
          
          // Emit melded event
          const meldedEvent = emitEvent(newState, 'melded', {
            playerId: activatingPlayer,
            cardId,
            color: card.color,
            fromHand: false, // From score pile, not hand
          });
          events.push(meldedEvent);
        }
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Industrialization (ID 62) - Draw/tuck 6s based on Factory icons, optional splay red/purple right
interface IndustrializationState {
  step: 'draw_tuck_phase' | 'check_splay_choice' | 'waiting_splay_choice';
}

export function industrializationEffect(
  context: DogmaContext,
  state: IndustrializationState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'draw_tuck_phase': {
      // Count Factory icons on the board
      const factoryCount = countIcons(newState, activatingPlayer, 'Factory');
      const drawTuckCount = Math.floor(factoryCount / 2);
      
      // Draw and tuck 6s for every two Factory icons
      for (let i = 0; i < drawTuckCount; i++) {
        newState = drawAndTuck(newState, activatingPlayer, 6, 1, events);
      }

      // Now check for splay choice
      // Check if player has red or purple cards to splay (with 2+ cards)
      const redStack = newState.players[activatingPlayer]!.colors.find(
        (stack: any) => stack.color === 'Red' && stack.cards.length > 1
      );
      const purpleStack = newState.players[activatingPlayer]!.colors.find(
        (stack: any) => stack.color === 'Purple' && stack.cards.length > 1
      );
      
      if (!redStack && !purpleStack) {
        // No eligible red or purple cards, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Offer optional choice to splay red or purple right
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `industrialization_splay_${activatingPlayer}`,
          type: 'yes_no',
          playerId: activatingPlayer,
          prompt: 'You may splay your red or purple cards right.',
          source: 'industrialization_card_effect',
          yesText: 'Splay red or purple cards right',
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

      if (!choiceAnswer.answer) {
        // Player chose not to splay, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Player chose to splay - splay both red and purple if available
      const player = newState.players[activatingPlayer]!;
      
      const redStack = player.colors.find(
        (stack: any) => stack.color === 'Red' && stack.cards.length > 1
      );
      if (redStack) {
        newState = splayColor(newState, activatingPlayer, 'Red', 'right', events);
      }
      
      const purpleStack = player.colors.find(
        (stack: any) => stack.color === 'Purple' && stack.cards.length > 1
      );
      if (purpleStack) {
        newState = splayColor(newState, activatingPlayer, 'Purple', 'right', events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 

// Metric System (ID 64) - Conditional splay any color, optional splay green right
interface MetricSystemState {
  step: 'check_green_condition' | 'waiting_any_color_choice' | 'waiting_green_choice';
}

export function metricSystemEffect(
  context: DogmaContext,
  state: MetricSystemState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'check_green_condition': {
      const player = gameData.players[activatingPlayer]!;
      
      // Check if green cards are splayed right
      const greenStack = player.colors.find(
        stack => stack.color === 'Green' && stack.splayDirection === 'right'
      );
      
      if (greenStack) {
        // Green cards are splayed right, offer choice to splay any color
        // Find available color stacks with 2+ cards that can be splayed
        const availableColors: string[] = [];
        for (const colorStack of player.colors) {
          if (colorStack.cards.length > 1) {
            availableColors.push(colorStack.color);
          }
        }
        
        if (availableColors.length === 0) {
          // No stacks available for splaying, skip to green choice
          return checkGreenChoiceInternal(newState, events, activatingPlayer);
        }
        
        // Offer choice to splay any color right
        return {
          type: 'need_choice',
          newState,
          events,
          choice: {
            id: `metric_system_any_color_${activatingPlayer}`,
            type: 'select_pile',
            playerId: activatingPlayer,
            prompt: 'You may splay any color of your cards right.',
            source: 'metric_system_card_effect',
            availableColors: availableColors as any,
            operation: 'splay right'
          },
          nextState: {
            ...state,
            step: 'waiting_any_color_choice'
          }
        };
      } else {
        // Green cards not splayed right, skip to green choice
        return checkGreenChoiceInternal(newState, events, activatingPlayer);
      }
    }

    case 'waiting_any_color_choice': {
      if (choiceAnswer && choiceAnswer.type === 'select_pile' && choiceAnswer.selectedColor) {
        // Player chose to splay a color
        const selectedColor = choiceAnswer.selectedColor;
        newState = splayColor(newState, activatingPlayer, selectedColor, 'right', events);
      }
      
      // Now proceed to green choice
      return checkGreenChoiceInternal(newState, events, activatingPlayer);
    }

    case 'waiting_green_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        // No choice made, complete
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      if (choiceAnswer.answer) {
        // Player chose to splay green right
        newState = splayColor(newState, activatingPlayer, 'Green', 'right', events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Helper method for checking green choice internally
function checkGreenChoiceInternal(
  newState: any,
  events: GameEvent[],
  activatingPlayer: PlayerId
): EffectResult {
  const player = newState.players[activatingPlayer]!;
  
  // Check if green cards can be splayed right (2+ cards and not already splayed right)
  const greenStack = player.colors.find((stack: any) => stack.color === 'Green');
  
  if (!greenStack || greenStack.cards.length < 2) {
    // No green stack or single card, complete
    return { type: 'complete', newState, events, effectType: 'non-demand' };
  }
  
  if (greenStack.splayDirection === 'right') {
    // Already splayed right, complete
    return { type: 'complete', newState, events, effectType: 'non-demand' };
  }
  
  // Offer choice to splay green right
  return {
    type: 'need_choice',
    newState,
    events,
    choice: {
      id: `metric_system_green_${activatingPlayer}`,
      type: 'yes_no',
      playerId: activatingPlayer,
      prompt: 'You may splay your green cards right.',
      source: 'metric_system_card_effect',
      yesText: 'Splay green cards right',
      noText: 'Skip splaying green'
    },
    nextState: {
      step: 'waiting_green_choice'
    }
  };
} 

// Democracy (ID 59) - Optional return cards, conditional draw/score 8 if most returned
interface DemocracyState {
  step: 'check_hand' | 'waiting_return_choice';
  returnsPerPlayer?: Record<PlayerId, number>; // Track returns for each player in this Democracy activation
}

export function democracyEffect(
  context: DogmaContext,
  state: DemocracyState,
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
        // No cards in hand, record 0 returns for this player and complete
        const globalState = gameData.currentEffect?.state || {};
        const returnsPerPlayer = globalState.democracyReturns || {};
        returnsPerPlayer[activatingPlayer] = 0;
        
        // Update global state
        newState = {
          ...newState,
          currentEffect: {
            ...newState.currentEffect!,
            state: {
              ...globalState,
              democracyReturns: returnsPerPlayer
            }
          }
        };
        
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      // Initialize or get existing returns tracking from global state
      const globalState = gameData.currentEffect?.state || {};
      const returnsPerPlayer = globalState.democracyReturns || {};

      // Offer optional choice to return any number of cards from hand
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `democracy_return_${activatingPlayer}`,
          type: 'select_cards',
          playerId: activatingPlayer,
          prompt: 'You may return any number of cards from your hand.',
          source: 'democracy_card_effect',
          from: { zone: 'hand', playerId: activatingPlayer },
          minCards: 0,
          maxCards: player.hands.length
        },
        nextState: {
          ...state,
          step: 'waiting_return_choice',
          returnsPerPlayer
        }
      };
    }

    case 'waiting_return_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
        // No choice made, record 0 returns and complete
        const globalState = gameData.currentEffect?.state || {};
        const returnsPerPlayer = globalState.democracyReturns || {};
        returnsPerPlayer[activatingPlayer] = 0;
        
        // Update global state
        newState = {
          ...newState,
          currentEffect: {
            ...newState.currentEffect!,
            state: {
              ...globalState,
              democracyReturns: returnsPerPlayer
            }
          }
        };
        
        return { type: 'complete', newState, events, effectType: 'non-demand' };
      }

      const returnedCards = choiceAnswer.selectedCards;
      
      // Get existing returns tracking from global state
      const globalState = gameData.currentEffect?.state || {};
      const returnsPerPlayer = globalState.democracyReturns || {};
      
      if (returnedCards.length === 0) {
        // Player chose not to return any cards, record 0 returns
        returnsPerPlayer[activatingPlayer] = 0;
      } else {
        // Return the selected cards
        for (const cardId of returnedCards) {
          const card = CARDS.cardsById.get(cardId);
          if (!card) {
            throw new Error(`Card ${cardId} not found in database`);
          }
          newState = returnCard(newState, activatingPlayer, cardId, card.age, events);
        }
        
        // Track the number of cards returned by this player
        returnsPerPlayer[activatingPlayer] = returnedCards.length;
      }

      // Update global state with new returns
      newState = {
        ...newState,
        currentEffect: {
          ...newState.currentEffect!,
          state: {
            ...globalState,
            democracyReturns: returnsPerPlayer
          }
        }
      };

      // Check if this player returned more cards than any other player in this Democracy activation
      const thisPlayerReturns = returnsPerPlayer[activatingPlayer] || 0;
      const otherPlayerReturns = Object.entries(returnsPerPlayer)
        .filter(([playerId]) => parseInt(playerId) !== activatingPlayer)
        .map(([, returns]) => returns);
      
      const maxOtherReturns = Math.max(0, ...otherPlayerReturns);
      
      // Player gets bonus if they returned more cards than any other player AND returned at least 1 card
      if (thisPlayerReturns > 0 && thisPlayerReturns > maxOtherReturns) {
        // Draw and score an 8
        newState = drawAndScore(newState, activatingPlayer, 8, 1, events);
      }

      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
} 

// Emancipation (ID 60) - Demand transfer card to score, optional splay red/purple right
interface EmancipationState {
  step: 'execute_demand' | 'waiting_transfer_choice' | 'check_splay_choice' | 'waiting_splay_choice';
  affectedPlayers?: PlayerId[];
  currentPlayerIndex?: number;
  cardTransferred?: boolean;
}

export function emancipationEffect(
  context: DogmaContext,
  state: EmancipationState,
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Emit dogma_activated event
  emitDogmaEvent(gameData, context, events);

  switch (state.step) {
    case 'execute_demand': {
      // Find players with fewer Factory icons (demand effect)
      const activatingPlayerFactories = countIcons(gameData, activatingPlayer, 'Factory');
      const affectedPlayers: PlayerId[] = [];
      
      for (let playerId = 0; playerId < 2; playerId++) {
        const typedPlayerId = playerId as PlayerId;
        if (typedPlayerId !== activatingPlayer) {
          const playerFactories = countIcons(gameData, typedPlayerId, 'Factory');
          if (playerFactories < activatingPlayerFactories) {
            affectedPlayers.push(typedPlayerId);
          }
        }
      }
      
      if (affectedPlayers.length === 0) {
        // No one affected by demand, proceed to splay choice
        return checkSplayChoiceInternal(newState, events, activatingPlayer, false);
      }
      
      // Start with first affected player
      const targetPlayer = affectedPlayers[0]!;
      const hasCards = gameData.players[targetPlayer]!.hands.length > 0;
      
      if (!hasCards) {
        // Player has no cards to transfer, proceed to splay choice
        return checkSplayChoiceInternal(newState, events, activatingPlayer, false);
      }
      
      // Request card transfer from target player
      return {
        type: 'need_choice',
        newState,
        events,
        choice: {
          id: `emancipation_transfer_${targetPlayer}`,
          type: 'select_cards',
          playerId: targetPlayer,
          prompt: 'I demand you transfer a card from your hand to my score pile!',
          source: 'emancipation_card_effect',
          from: { zone: 'hand', playerId: targetPlayer },
          minCards: 1,
          maxCards: 1
        },
        nextState: {
          ...state,
          step: 'waiting_transfer_choice',
          affectedPlayers,
          currentPlayerIndex: 0,
          cardTransferred: false
        }
      };
    }

    case 'waiting_transfer_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'select_cards' || choiceAnswer.selectedCards.length === 0) {
        // No card transferred, proceed to splay choice
        return checkSplayChoiceInternal(newState, events, activatingPlayer, false);
      }

      const transferredCardId = choiceAnswer.selectedCards[0]!;
      const targetPlayer = state.affectedPlayers![0]!;
      
      // Transfer card from target player's hand to activating player's score pile
      newState = transferCard(newState, targetPlayer, activatingPlayer, transferredCardId, 'hand', 'score', events);
      
      // Since a card was transferred, draw a 6
      newState = drawCard(newState, activatingPlayer, 6, events);
      
      // Proceed to splay choice
      return checkSplayChoiceInternal(newState, events, activatingPlayer, true);
    }

    case 'waiting_splay_choice': {
      if (!choiceAnswer || choiceAnswer.type !== 'yes_no') {
        // No choice made, complete
        return { type: 'complete', newState, events, effectType: 'demand' };
      }

      if (choiceAnswer.answer) {
        // Player chose to splay - splay both red and purple if available
        const player = newState.players[activatingPlayer]!;
        
        const redStack = player.colors.find(
          (stack: any) => stack.color === 'Red' && stack.cards.length > 1
        );
        if (redStack) {
          newState = splayColor(newState, activatingPlayer, 'Red', 'right', events);
        }
        
        const purpleStack = player.colors.find(
          (stack: any) => stack.color === 'Purple' && stack.cards.length > 1
        );
        if (purpleStack) {
          newState = splayColor(newState, activatingPlayer, 'Purple', 'right', events);
        }
      }

      return { type: 'complete', newState, events, effectType: 'demand' };
    }

    default:
      throw new Error(`Unknown step: ${(state as any).step}`);
  }
}

// Helper function for checking splay choice
function checkSplayChoiceInternal(
  newState: any,
  events: GameEvent[],
  activatingPlayer: PlayerId,
  cardTransferred: boolean
): EffectResult {
  const player = newState.players[activatingPlayer]!;
  
  // Check if red or purple cards can be splayed (2+ cards)
  const redStack = player.colors.find((stack: any) => stack.color === 'Red' && stack.cards.length > 1);
  const purpleStack = player.colors.find((stack: any) => stack.color === 'Purple' && stack.cards.length > 1);
  
  if (!redStack && !purpleStack) {
    // No eligible cards for splaying, complete
    return { type: 'complete', newState, events, effectType: 'demand' };
  }
  
  // Offer choice to splay red or purple right
  return {
    type: 'need_choice',
    newState,
    events,
    choice: {
      id: `emancipation_splay_${activatingPlayer}`,
      type: 'yes_no',
      playerId: activatingPlayer,
      prompt: 'You may splay your red or purple cards right.',
      source: 'emancipation_card_effect',
      yesText: 'Splay red or purple cards right',
      noText: 'Skip splaying'
    },
    nextState: {
      step: 'waiting_splay_choice',
      cardTransferred
    }
  };
} 

// Vaccination (ID 65) - Demand return all lowest score cards, conditional draw/meld 6 and 7
export const vaccinationEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  
  // Find players with fewer Leaf icons (demand effect)
  const activatingPlayerLeaves = countIcons(gameData, activatingPlayer, 'Leaf');
  let anyCardsReturned = false;
  
  for (let playerId = 0; playerId < 2; playerId++) {
    const typedPlayerId = playerId as PlayerId;
    if (typedPlayerId !== activatingPlayer) {
      const playerLeaves = countIcons(gameData, typedPlayerId, 'Leaf');
      if (playerLeaves < activatingPlayerLeaves) {
        // This player is affected by the demand
        const player = newState.players[typedPlayerId]!;
        
        if (player.scores.length > 0) {
          // Find the lowest age among score cards
          let lowestAge = Infinity;
          for (const cardId of player.scores) {
            const card = CARDS.cardsById.get(cardId);
            if (card && card.age < lowestAge) {
              lowestAge = card.age;
            }
          }
          
          // Find all cards with the lowest age
          const lowestCards: number[] = [];
          for (const cardId of player.scores) {
            const card = CARDS.cardsById.get(cardId);
            if (card && card.age === lowestAge) {
              lowestCards.push(cardId);
            }
          }
          
          // Return all lowest cards
          for (const cardId of lowestCards) {
            const card = CARDS.cardsById.get(cardId);
            if (!card) {
              throw new Error(`Card ${cardId} not found in database`);
            }
            
            // Remove from score pile
            const scoreIndex = player.scores.indexOf(cardId);
            if (scoreIndex !== -1) {
              player.scores.splice(scoreIndex, 1);
              
              // Add back to supply pile
              const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
              if (supplyPile) {
                supplyPile.cards.push(cardId);
              }
              
              // Emit return event
              const returnEvent = emitEvent(newState, 'returned', {
                playerId: typedPlayerId,
                cardId,
                fromZone: { playerId: typedPlayerId, zone: 'score' },
                toAge: card.age,
              });
              events.push(returnEvent);
              
              anyCardsReturned = true;
            }
          }
          
          // If any cards were returned, draw and meld a 6
          if (lowestCards.length > 0) {
            newState = drawAndMeld(newState, typedPlayerId, 6, 1, events);
          }
        }
      }
    }
  }
  
  // If any card was returned as a result of the demand, draw and meld a 7
  if (anyCardsReturned) {
    newState = drawAndMeld(newState, activatingPlayer, 7, 1, events);
  }
  
  return [newState, events];
}); 