// Core game state structure for Innovation

import type { 
  CardId, 
  Color, 
  PlayerId, 
  AchievementId, 
  SpecialAchievementId,
  SplayDirection,
  GameId,
  TurnNumber
} from './core.js';
import type { GamePhase } from './game-state.js';
import type { EventLog } from './events.js';
import type { Choice } from './choices.js';

// RNG state for deterministic gameplay
export interface RngState {
  readonly seed: number;           // Initial seed
  readonly counter: number;        // Number of random values generated
  readonly state: number[];        // Internal RNG state (implementation specific)
}

// Individual player's board state
export interface PlayerBoard {
  readonly hands: CardId[];                    // Cards in hand
  readonly colors: PlayerColorStack[];        // Color stacks on board
  readonly scores: CardId[];                   // Cards in score pile
  readonly normalAchievements: AchievementId[];         // Normal achievements claimed
  readonly specialAchievements: SpecialAchievementId[]; // Special achievements claimed
}

// A single color stack on a player's board
export interface PlayerColorStack {
  readonly color: Color;
  readonly cards: CardId[];              // Bottom to top order
  readonly splayDirection?: SplayDirection; // How cards are splayed, if any
}

// Shared game resources
export interface SharedState {
  readonly supplyPiles: SupplyPile[];                       // Age-based card piles
  readonly availableNormalAchievements: AchievementId[];    // Unclaimed normal achievements
  readonly availableSpecialAchievements: SpecialAchievementId[]; // Unclaimed special achievements
}

// Supply pile for each age
export interface SupplyPile {
  readonly age: number;
  readonly cards: CardId[];  // Remaining cards in this age pile
}

// Complete game state
export interface GameData {
  // Game identification and metadata
  readonly gameId: GameId;
  readonly version: string;        // Schema version for migration
  readonly createdAt: number;      // Timestamp when game was created
  
  // Current game phase
  readonly phase: GamePhase;
  
  // Deterministic randomness
  readonly rng: RngState;
  
  // Player states (indexed by PlayerId)
  readonly players: Record<PlayerId, PlayerBoard>;
  
  // Shared game state
  readonly shared: SharedState;
  
  // Current turn state
  readonly pendingChoice?: Choice;  // Set when phase.state === 'AwaitingChoice'
  
  // Complete game history for replay and debugging
  readonly eventLog: EventLog;
  
}


// Initial game setup data
export interface GameSetupOptions {
  readonly gameId: GameId;
  readonly playerNames: [string, string]; // Names for player 0 and 1
  readonly rngSeed: number;
  readonly startingPlayer?: PlayerId; // If not specified, determined by card selection
}

// Game result after completion
export interface GameResult {
  readonly winner: PlayerId | null;   // null for draw
  readonly winCondition: import('./core.js').WinCondition;
  readonly finalScores: Record<PlayerId, number>;
  readonly finalAchievements: Record<PlayerId, (AchievementId | SpecialAchievementId)[]>;
  readonly totalTurns: number;
  readonly duration: number; // Game length in milliseconds
}

// Helper functions for game data manipulation
export function getPlayerHand(gameData: GameData, playerId: PlayerId): CardId[] {
  return gameData.players[playerId]?.hands ?? [];
}

export function getPlayerColorStack(
  gameData: GameData, 
  playerId: PlayerId, 
  color: Color
): PlayerColorStack | undefined {
  return gameData.players[playerId]?.colors.find(stack => stack.color === color);
}

export function getTopCard(
  gameData: GameData, 
  playerId: PlayerId, 
  color: Color
): CardId | null {
  const stack = getPlayerColorStack(gameData, playerId, color);
  if (!stack || stack.cards.length === 0) {
    return null;
  }
  return stack.cards[stack.cards.length - 1]!;
}

export function getAllTopCards(gameData: GameData, playerId: PlayerId): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  return player.colors
    .map(stack => stack.cards[stack.cards.length - 1])
    .filter((cardId): cardId is CardId => cardId !== undefined);
}

export function getPlayerScore(gameData: GameData, playerId: PlayerId): number {
  return gameData.players[playerId]?.scores.length ?? 0;
}

// Icon counting function moved to engine/utils.js to avoid circular dependencies

export function getPlayerAchievementCount(gameData: GameData, playerId: PlayerId): number {
  const player = gameData.players[playerId];
  if (!player) return 0;
  return player.normalAchievements.length + player.specialAchievements.length;
}

export function isGameOver(gameData: GameData): boolean {
  return gameData.phase.state === 'GameOver';
}

export function getCurrentPlayer(gameData: GameData): PlayerId {
  return gameData.phase.currentPlayer;
}

export function getOpponent(playerId: PlayerId): PlayerId {
  return playerId === 0 ? 1 : 0;
}

// Validation helpers
export function validateGameData(gameData: GameData): string[] {
  const errors: string[] = [];
  
  // Check basic structure
  if (!gameData || !gameData.players) {
    errors.push('Players data missing');
    return errors;
  }
  
  // Check that both players exist
  if (!gameData.players[0]) errors.push('Player 0 data missing');
  if (!gameData.players[1]) errors.push('Player 1 data missing');
  
  // Check phase consistency
  if (gameData.phase.state === 'AwaitingChoice' && !gameData.pendingChoice) {
    errors.push('Game state is AwaitingChoice but no pendingChoice is set');
  }
  
  if (gameData.phase.state !== 'AwaitingChoice' && gameData.pendingChoice) {
    errors.push('pendingChoice is set but game state is not AwaitingChoice');
  }
  
  // Check action count
  if (gameData.phase.actionsRemaining < 0 || gameData.phase.actionsRemaining > 2) {
    errors.push(`Invalid actionsRemaining: ${gameData.phase.actionsRemaining}`);
  }
  
  return errors;
}