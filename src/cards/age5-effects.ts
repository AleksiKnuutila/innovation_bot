// Age 5 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId } from '../types/index.js';
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

// TODO: Add other Age 5 effects here when moved from effect-handlers.ts
// - physicsEffect
// - measurementEffect
// - astronomyEffect
// - chemistryEffect 