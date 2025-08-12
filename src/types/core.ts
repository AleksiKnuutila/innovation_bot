// Core ID types and base enums for Innovation game engine

// Player identification (numeric for efficiency)
export type PlayerId = 0 | 1; // 2-player game support

// Game identification
export type GameId = string; // UUID format

// Turn tracking
export type TurnNumber = number;

// Achievement identification
export type AchievementId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // Normal achievements
export type SpecialAchievementId = 'Monument' | 'Empire' | 'World' | 'Wonder' | 'Universe';

// Splay directions
export type SplayDirection = 'left' | 'right' | 'up';

// Win condition types
export type WinCondition = 
  | 'achievements'    // Collected enough achievements
  | 'score'          // Deck exhausted, highest score wins  
  | 'special_card'   // Card effect ends game immediately
  | 'timeout';       // Game exceeded maximum turns (safety)

// Re-export card-related types for convenience  
export type { CardId, Age, Color, Icon } from './cards.js';

// Import the types locally for use in interfaces below
import type { Color, Age } from './cards.js';

// Zone references for card locations
export interface ZoneRef {
  readonly zone: 'hand' | 'board' | 'score' | 'deck' | 'achievements';
  readonly playerId?: PlayerId; // Required for player-specific zones
  readonly color?: Color;       // Required for board zones
  readonly age?: Age;          // Required for deck zones
}

// Helper functions for type guards
export function isPlayerId(value: number): value is PlayerId {
  return value === 0 || value === 1;
}

export function isAchievementId(value: number): value is AchievementId {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

export function isSpecialAchievementId(value: string): value is SpecialAchievementId {
  return ['Monument', 'Empire', 'World', 'Wonder', 'Universe'].includes(value);
}

export function isSplayDirection(value: string): value is SplayDirection {
  return ['left', 'right', 'up'].includes(value);
}