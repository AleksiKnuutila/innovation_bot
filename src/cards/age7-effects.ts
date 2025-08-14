// Age 7 Card Effects
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
  returnCardFromBoard,
  revealCard,
  meldCard,
  findNonGreenFactoryCards,
  cardHasIcon,
  findTopCardsWithoutIcon
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
// Age 7 Cards
// ============================================================================

// Bicycle (ID 66) - Exchange all hand cards with all score cards
export const bicycleEffect = createSimpleEffect((context: DogmaContext) => {
  const { gameData, activatingPlayer } = context;
  let newState = gameData;
  const events: GameEvent[] = [];

  const player = newState.players[activatingPlayer]!;
  
  // Exchange hand cards with score cards
  const oldHand = [...player.hands];
  const oldScores = [...player.scores];
  
  // Clear both arrays first
  player.hands.splice(0, player.hands.length);
  player.scores.splice(0, player.scores.length);
  
  // Add the swapped cards
  player.hands.push(...oldScores);
  player.scores.push(...oldHand);
  
  // Emit transfer events for the exchange if any cards were moved
  if (oldHand.length > 0) {
    for (const cardId of oldHand) {
      const transferEvent = emitEvent(newState, 'transferred', {
        cardId,
        fromPlayer: activatingPlayer,
        toPlayer: activatingPlayer,
        fromZone: { playerId: activatingPlayer, zone: 'hand' },
        toZone: { playerId: activatingPlayer, zone: 'score' }
      });
      events.push(transferEvent);
    }
  }
  
  if (oldScores.length > 0) {
    for (const cardId of oldScores) {
      const transferEvent = emitEvent(newState, 'transferred', {
        cardId,
        fromPlayer: activatingPlayer,
        toPlayer: activatingPlayer,
        fromZone: { playerId: activatingPlayer, zone: 'score' },
        toZone: { playerId: activatingPlayer, zone: 'hand' }
      });
      events.push(transferEvent);
    }
  }
  
  return [newState, events];
});

// Combustion (ID 67) - Demand transfer two cards from score pile
export const combustionEffect = createSimpleEffect((context: DogmaContext) => {
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

// TODO: Add other Age 7 effects here as they are implemented
// - evolutionEffect
// - explosivesEffect
// - lightingEffect
// - publicationsEffect
// - railroadEffect
// - refrigerationEffect
// - sanitationEffect 