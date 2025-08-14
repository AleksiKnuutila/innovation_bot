// Age 7 Card Effects
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
  returnCardFromBoard,
  returnCardFromScore,
  revealCard,
  meldCard,
  findNonGreenFactoryCards,
  cardHasIcon,
  findTopCardsWithoutIcon
} from '../engine/state-manipulation.js';
import { emitEvent } from '../engine/events.js';
import { CARDS } from '../cards/database.js';
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId } from '../types/core.js';
import { createYesNoChoice } from '../types/choices.js';
import type { CardId } from '../types/core.js';

// Helper function to emit dogma events
function emitDogmaEvent(
  gameData: any,
  context: DogmaContext,
  events: GameEvent[]
): void {
  const dogmaEvent = emitEvent(gameData, 'dogma_activated', {
    playerId: context.activatingPlayer,
    cardId: context.cardId,
  });
  events.push(dogmaEvent);
}

// Helper function to create simple effects that auto-execute and emit dogma_activated
function createSimpleEffect(
  effectFn: (context: DogmaContext) => [any, GameEvent[]]
): (context: DogmaContext, state: any, choiceAnswer?: any) => EffectResult {
  return (context: DogmaContext, state: any, choiceAnswer?: any): EffectResult => {
    // Execute the effect function
    const [newState, events] = effectFn(context);
    
    // Emit dogma_activated event
    emitDogmaEvent(newState, context, events);
    
    return { type: 'complete', newState, events };
  };
}

// ============================================================================
// Age 7 Cards
// ============================================================================

// Bicycle (ID 66) - Exchange all hand cards with all score cards
export const bicycleEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  const player = newState.players[activatingPlayer]!;
  
  // Get all cards from hand and score pile
  const handCards = [...player.hands];
  const scoreCards = [...player.scores];
  
  // Clear both zones
  player.hands.splice(0);
  player.scores.splice(0);
  
  // Exchange: hand cards go to score, score cards go to hand
  player.hands.push(...scoreCards);
  player.scores.push(...handCards);
  
  return [newState, events];
});

// Combustion (ID 67) - Demand transfer two cards from score pile
export const combustionEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  const activatingPlayerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
  
  // Execute demand effect for affected players
  for (let playerId = 0; playerId < 2; playerId++) {
    const typedPlayerId = playerId as PlayerId;
    if (typedPlayerId !== activatingPlayer) {
      const playerCrowns = countIcons(gameData, typedPlayerId, 'Crown');
      if (playerCrowns < activatingPlayerCrowns) {
        const player = newState.players[typedPlayerId]!;
        
        // Transfer up to 2 cards from score pile
        const cardsToTransfer = player.scores.slice(0, 2);
        for (const cardId of cardsToTransfer) {
          newState = transferCard(newState, typedPlayerId, activatingPlayer, cardId, 'score', 'score', events);
        }
      }
    }
  }
  
  return [newState, events];
});

// Electricity (ID 68) - Return non-Factory top cards, draw 8s for each
export const electricityEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Find all top cards without Factory icons using helper function
  const cardsToReturn = findTopCardsWithoutIcon(newState, activatingPlayer, 'Factory');
  
  // Return the cards from board to supply using the new primitive
  for (const cardId of cardsToReturn) {
    newState = returnCardFromBoard(newState, activatingPlayer, cardId, events);
  }
  
  // Draw an 8 for each card returned
  for (let i = 0; i < cardsToReturn.length; i++) {
    newState = drawCard(newState, activatingPlayer, 8, events);
  }
  
  return [newState, events];
});

// Evolution (ID 69) - Choice between two actions
export const evolutionEffect = (context: DogmaContext, state: any, choiceAnswer?: any): EffectResult => {
  const { gameData, activatingPlayer } = context;

  switch (state.step) {
    case 'start': {
      // Emit dogma activated event first
      const events: GameEvent[] = [];
      emitDogmaEvent(gameData, context, events);

      // Offer choice between two options
      return {
        type: 'need_choice',
        newState: gameData,
        events,
        choice: createYesNoChoice(
          'evolution_choice',
          activatingPlayer,
          'Choose your Evolution strategy:',
          'evolution_effect',
          'Draw and score an 8, then return a card from score pile',
          'Draw a card of value one higher than highest in score pile'
        ),
        nextState: { step: 'waiting_choice' }
      };
    }

    case 'waiting_choice': {
      let newState = gameData;
      const events: GameEvent[] = [];
      
      if (choiceAnswer?.answer === true) {
        // Option 1: Draw and score an 8, then return a card from score pile
        const player = newState.players[activatingPlayer]!;
        let cardToReturn: CardId | null = null;
        
        // Check if player has cards in score pile to return BEFORE drawing/scoring
        if (player.scores.length > 0) {
          cardToReturn = player.scores[player.scores.length - 1]!; // Remember the most recent
        }
        
        // Draw and score the 8
        newState = drawAndScore(newState, activatingPlayer, 8, 1, events);
        
        // Now return the card we remembered (if any)
        if (cardToReturn !== null) {
          newState = returnCardFromScore(newState, activatingPlayer, cardToReturn, events);
        }
      } else {
        // Option 2: Draw a card of value one higher than highest in score pile
        const player = newState.players[activatingPlayer]!;
        let highestValue = 0;
        
        // Find highest value in score pile
        for (const cardId of player.scores) {
          const card = CARDS.cardsById.get(cardId);
          if (card && card.age > highestValue) {
            highestValue = card.age;
          }
        }
        
        // Draw card of value one higher (minimum 1)
        const drawAge = Math.max(1, highestValue + 1);
        newState = drawCard(newState, activatingPlayer, drawAge, events);
      }
      
      return { type: 'complete', newState, events, effectType: 'non-demand' };
    }

    default:
      throw new Error(`Unknown step: ${state.step}`);
  }
};

// TODO: Add other Age 7 effects here as they are implemented