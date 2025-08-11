// Action types for Innovation game engine
// Actions represent the top-level choices a player makes on their turn

import type { CardId, Color, AchievementId, SpecialAchievementId } from './core.js';

// Base action interface
interface BaseAction {
  readonly playerId: import('./core.js').PlayerId;
  readonly timestamp: number; // For replay and debugging
}

// Draw action - draw card from appropriate age pile
export interface DrawAction extends BaseAction {
  readonly type: 'draw';
}

// Meld action - play a card from hand to board
export interface MeldAction extends BaseAction {
  readonly type: 'meld';
  readonly cardId: CardId; // Card from hand to meld
}

// Dogma action - activate a top card's effects
export interface DogmaAction extends BaseAction {
  readonly type: 'dogma';
  readonly cardId: CardId; // Top card to activate
}

// Achieve action - claim an achievement
export interface AchieveAction extends BaseAction {
  readonly type: 'achieve';
  readonly achievementType: 'normal' | 'special';
  readonly achievementId: AchievementId | SpecialAchievementId;
}

// Union of all possible actions
export type Action = DrawAction | MeldAction | DogmaAction | AchieveAction;

// Helper functions to create actions
export function createDrawAction(playerId: import('./core.js').PlayerId): DrawAction {
  return {
    type: 'draw',
    playerId,
    timestamp: Date.now(),
  };
}

export function createMeldAction(
  playerId: import('./core.js').PlayerId, 
  cardId: CardId
): MeldAction {
  return {
    type: 'meld',
    playerId,
    cardId,
    timestamp: Date.now(),
  };
}

export function createDogmaAction(
  playerId: import('./core.js').PlayerId,
  cardId: CardId
): DogmaAction {
  return {
    type: 'dogma',
    playerId,
    cardId,
    timestamp: Date.now(),
  };
}

export function createAchieveAction(
  playerId: import('./core.js').PlayerId,
  achievementType: 'normal' | 'special',
  achievementId: AchievementId | SpecialAchievementId
): AchieveAction {
  return {
    type: 'achieve',
    playerId,
    achievementType,
    achievementId,
    timestamp: Date.now(),
  };
}

// Type guards
export function isDrawAction(action: Action): action is DrawAction {
  return action.type === 'draw';
}

export function isMeldAction(action: Action): action is MeldAction {
  return action.type === 'meld';
}

export function isDogmaAction(action: Action): action is DogmaAction {
  return action.type === 'dogma';
}

export function isAchieveAction(action: Action): action is AchieveAction {
  return action.type === 'achieve';
}