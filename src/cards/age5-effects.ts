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
  findNonGreenFactoryCards
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

// TODO: Add other Age 5 effects here when moved from effect-handlers.ts
// - physicsEffect
// - measurementEffect
// - astronomyEffect
// - chemistryEffect 