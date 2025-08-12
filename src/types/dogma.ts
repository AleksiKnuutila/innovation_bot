// Types for callback-based state machine pattern for card effects

import type { GameData } from './game-data.js';
import type { Choice, ChoiceAnswer } from './choices.js';
import type { GameEvent } from './events.js';
import type { GameState } from './game-state.js';
import type { PlayerId } from './core.js';

// The contract every card effect follows
export interface CardEffectFunction {
  (context: DogmaContext, effectState: any, choiceAnswer?: ChoiceAnswer): EffectResult;
}

// What the function can return
export type EffectResult =
  | { type: 'continue'; newState: GameData; events: GameEvent[]; nextState: any }
  | { type: 'need_choice'; newState: GameData; events: GameEvent[]; choice: Choice; nextState: any }
  | { type: 'complete'; newState: GameData; events: GameEvent[]; effectType?: 'demand' | 'non-demand' };

// Effect registry maps string identifiers to functions
export interface EffectRegistry {
  [cardKey: string]: CardEffectFunction;
}

// Context for dogma resolution
export interface DogmaContext {
  readonly gameData: GameData;
  readonly cardId: number;
  readonly dogmaLevel: number; // 1, 2, or 3
  readonly activatingPlayer: PlayerId; // Who activated the dogma
  readonly affectedPlayers: PlayerId[]; // Players affected by this dogma level
  readonly sharingPlayers?: PlayerId[]; // Players who share the dogma effect
}

// Active effect in the game state
export interface ActiveEffect {
  readonly cardId: number;
  readonly effectState: any; // Serializable state for the effect
  readonly priority: number; // For handling multiple active effects
}

// Symbol comparison results for dogma conditions
export interface SymbolComparison {
  readonly most: PlayerId[];      // Players with most icons (tied)
  readonly least: PlayerId[];     // Players with least icons (tied)
  readonly atLeast: PlayerId[];   // Players affected by this dogma level
  readonly below: PlayerId[];     // Players below the threshold
}

// Demand resolution result
export interface DemandResult {
  readonly success: boolean;     // Whether the demand was met
  readonly transferredCards: number[]; // Cards that were transferred
  readonly events: GameEvent[];
} 