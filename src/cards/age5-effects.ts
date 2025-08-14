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
  meldCard,
  findNonGreenFactoryCards,
  moveCardBetweenZones,
  cardHasIcon
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
    
    // Auto-emit dogma_activated event for simple effects
    emitDogmaEvent(newState, context, events);
    
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
export const bankingEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

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
  
  // Execute demand effect for affected players
  for (const targetPlayer of affectedPlayers) {
    const validCards = findNonGreenFactoryCards(newState, targetPlayer);
    
    if (validCards.length > 0) {
      // Transfer the first valid card found
      const cardToTransfer = validCards[0]!;
      newState = transferCard(newState, targetPlayer, activatingPlayer, cardToTransfer, 'board', 'board', events);
      
      // Activating player draws and scores a 5
      newState = drawAndScore(newState, activatingPlayer, 5, 1, events);
    }
  }
  
  // Non-demand effect: Optional splay green cards right
  const greenStack = newState.players[activatingPlayer]!.colors.find(
    stack => stack.color === 'Green'
  );
  
  if (greenStack && greenStack.cards.length >= 2) {
    // For now, auto-splay for testing purposes
    // In a real implementation, this would be a choice
    newState = splayColor(newState, activatingPlayer, 'Green', 'right', events);
  }
  
  return [newState, events];
});

// The Pirate Code (ID 52) - Demand transfer two value ≤4 from score, score Crown card
export const piratecodeEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];
  let anyTransferred = false;

  // Find players with fewer Crown icons than the activating player
  const activatingPlayerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
  
  // Execute demand effect for affected players
  for (let playerId = 0; playerId < 2; playerId++) {
    const typedPlayerId = playerId as PlayerId;
    if (typedPlayerId !== activatingPlayer) {
      const playerCrowns = countIcons(gameData, typedPlayerId, 'Crown');
      if (playerCrowns < activatingPlayerCrowns) {
        const player = newState.players[typedPlayerId]!;
        
        // Find cards of value 4 or less in score pile
        const validCards = player.scores.filter(cardId => {
          const card = CARDS.cardsById.get(cardId);
          return card && card.age <= 4;
        });
        
        // Transfer up to 2 cards
        const cardsToTransfer = validCards.slice(0, 2);
        for (const cardId of cardsToTransfer) {
          newState = transferCard(newState, typedPlayerId, activatingPlayer, cardId, 'score', 'score', events);
          anyTransferred = true;
        }
      }
    }
  }
  
  // If any cards were transferred, score the lowest top card with Crown
  if (anyTransferred) {
    const player = newState.players[activatingPlayer]!;
    const topCardsWithCrowns: { cardId: CardId; age: number }[] = [];
    
    // Find all top cards with Crown icons
    for (const colorStack of player.colors) {
      if (colorStack.cards.length > 0) {
        const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
        const card = CARDS.cardsById.get(topCardId);
        if (card && cardHasIcon(topCardId, 'Crown')) {
          topCardsWithCrowns.push({ cardId: topCardId, age: card.age });
        }
      }
    }
    
    if (topCardsWithCrowns.length > 0) {
      // Find the lowest age Crown card
      topCardsWithCrowns.sort((a, b) => a.age - b.age);
      const lowestCrownCard = topCardsWithCrowns[0]!;
      
      // Score it manually (remove from board, add to score pile)
      const playerRef = newState.players[activatingPlayer]!;
      
      // Remove from board
      for (const colorStack of playerRef.colors) {
        const cardIndex = colorStack.cards.indexOf(lowestCrownCard.cardId);
        if (cardIndex !== -1) {
          colorStack.cards.splice(cardIndex, 1);
          break;
        }
      }
      
      // Add to score pile
      playerRef.scores.push(lowestCrownCard.cardId);
      
      // Emit scored event
      const scoredEvent = emitEvent(newState, 'scored', {
        playerId: activatingPlayer,
        cardIds: [lowestCrownCard.cardId],
        pointsGained: 0, // Will be calculated later
        fromZone: { playerId: activatingPlayer, zone: 'board' },
      });
      events.push(scoredEvent);
    }
  }
  
  return [newState, events];
});

// Societies (ID 53) - Demand transfer non-purple Lightbulb from board, draw 5
export const societiesEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  // Find players with fewer Crown icons than the activating player
  const activatingPlayerCrowns = countIcons(gameData, activatingPlayer, 'Crown');
  
  // Execute demand effect for affected players
  for (let playerId = 0; playerId < 2; playerId++) {
    const typedPlayerId = playerId as PlayerId;
    if (typedPlayerId !== activatingPlayer) {
      const playerCrowns = countIcons(gameData, typedPlayerId, 'Crown');
      if (playerCrowns < activatingPlayerCrowns) {
        const player = newState.players[typedPlayerId]!;
        
        // Find top non-purple cards with Lightbulb icons
        const validCards: CardId[] = [];
        for (const colorStack of player.colors) {
          if (colorStack.color !== 'Purple' && colorStack.cards.length > 0) {
            const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
            if (cardHasIcon(topCardId, 'Lightbulb')) {
              validCards.push(topCardId);
            }
          }
        }
        
        // Transfer the first valid card found
        if (validCards.length > 0) {
          const cardToTransfer = validCards[0]!;
          newState = transferCard(newState, typedPlayerId, activatingPlayer, cardToTransfer, 'board', 'board', events);
          
          // Draw a 5 since transfer occurred
          newState = drawCard(newState, typedPlayerId, 5, events);
        }
      }
    }
  }
  
  return [newState, events];
});

// TODO: Add other Age 5 effects here when moved from effect-handlers.ts
// - physicsEffect
// - measurementEffect
// - astronomyEffect
// - chemistryEffect 