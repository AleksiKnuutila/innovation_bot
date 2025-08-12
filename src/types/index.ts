// Main types index - re-exports all game types for easy importing

// Core types and IDs
export * from './core.js';
export * from './cards.js';

// Game flow types  
export * from './actions.js';
export * from './game-state.js';
export * from './choices.js';
export * from './events.js';
export * from './game-data.js';

// Common type combinations for convenience
export type { Action } from './actions.js';
export type { Choice, ChoiceAnswer } from './choices.js';
export type { GameEvent } from './events.js';
export type { GameData } from './game-data.js';
export type { GamePhase } from './game-state.js';