// Age 4 Card Effects
import type { DogmaContext, EffectResult } from '../types/dogma.js';
import type { ChoiceAnswer } from '../types/choices.js';
import type { GameEvent } from '../types/events.js';
import type { PlayerId } from '../types/index.js';
import { 
  drawAndMeld, 
  drawAndTuck, 
  splayColor, 
  countIcons,
  hasIcon,
  drawCard,
  transferCard,
  returnCard,
  drawAndScore
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

// TODO: Add other Age 4 effects here when moved from effect-handlers.ts
// - inventionEffect
// - navigationEffect  
// - perspectiveEffect
// - printingPressEffect
// - reformationEffect
// - anatomyEffect
// - enterpriseEffect
// - gunpowderEffect 