// Simple JSON-based serialization for game state

import type { GameData } from '@/types/game-data.js';
import { validateGameData } from '@/types/game-data.js';

// Serialized game format for storage
export interface SerializedGame {
  readonly version: string;
  readonly timestamp: number;
  readonly data: string; // JSON string of GameData
  readonly checksum: number; // Simple validation
}

// Serialize game data to storable format
export function serializeGame(gameData: GameData): SerializedGame {
  // Validate game data before serialization
  const errors = validateGameData(gameData);
  if (errors.length > 0) {
    throw new Error(`Cannot serialize invalid game data: ${errors.join(', ')}`);
  }

  const jsonString = JSON.stringify(gameData);
  const checksum = calculateChecksum(jsonString);

  return {
    version: gameData.version,
    timestamp: Date.now(),
    data: jsonString,
    checksum,
  };
}

// Deserialize game data from stored format
export function deserializeGame(serialized: SerializedGame): GameData {
  // Verify checksum
  const expectedChecksum = calculateChecksum(serialized.data);
  if (serialized.checksum !== expectedChecksum) {
    throw new Error('Serialized game data is corrupted (checksum mismatch)');
  }

  let gameData: GameData;
  try {
    gameData = JSON.parse(serialized.data) as GameData;
  } catch (error) {
    throw new Error(`Failed to parse game data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate deserialized data
  const errors = validateGameData(gameData);
  if (errors.length > 0) {
    throw new Error(`Deserialized game data is invalid: ${errors.join(', ')}`);
  }

  return gameData;
}

// Create a save-friendly representation (compressed JSON)
export function createSaveData(gameData: GameData): string {
  const serialized = serializeGame(gameData);
  return JSON.stringify(serialized);
}

// Load from save-friendly representation
export function loadSaveData(saveData: string): GameData {
  let serialized: SerializedGame;
  try {
    serialized = JSON.parse(saveData) as SerializedGame;
  } catch (error) {
    throw new Error(`Failed to parse save data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return deserializeGame(serialized);
}

// Calculate simple checksum for validation
function calculateChecksum(data: string): number {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash >>> 0; // Convert to unsigned
}

// Export game data to portable format (for sharing/debugging)
export function exportGameData(gameData: GameData): string {
  return JSON.stringify(gameData, null, 2);
}

// Import game data from portable format
export function importGameData(jsonString: string): GameData {
  let gameData: GameData;
  try {
    gameData = JSON.parse(jsonString) as GameData;
  } catch (error) {
    throw new Error(`Failed to import game data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate imported data
  const errors = validateGameData(gameData);
  if (errors.length > 0) {
    throw new Error(`Imported game data is invalid: ${errors.join(', ')}`);
  }

  return gameData;
}

// Get game state summary for quick display
export interface GameSummary {
  readonly gameId: string;
  readonly version: string;
  readonly turnNumber: number;
  readonly currentPlayer: import('@/types/core.js').PlayerId;
  readonly phase: import('@/types/game-state.js').GameState;
  readonly playerScores: Record<import('@/types/core.js').PlayerId, number>;
  readonly playerAchievements: Record<import('@/types/core.js').PlayerId, number>;
  readonly createdAt: number;
  readonly lastUpdated: number;
}

export function getGameSummary(gameData: GameData): GameSummary {
  return {
    gameId: gameData.gameId,
    version: gameData.version,
    turnNumber: gameData.phase.turnNumber,
    currentPlayer: gameData.phase.currentPlayer,
    phase: gameData.phase.state,
    playerScores: {
      0: gameData.players[0]?.scores.length ?? 0,
      1: gameData.players[1]?.scores.length ?? 0,
    },
    playerAchievements: {
      0: (gameData.players[0]?.normalAchievements.length ?? 0) + (gameData.players[0]?.specialAchievements.length ?? 0),
      1: (gameData.players[1]?.normalAchievements.length ?? 0) + (gameData.players[1]?.specialAchievements.length ?? 0),
    },
    createdAt: gameData.createdAt,
    lastUpdated: Date.now(),
  };
}

// Migration support for future schema changes
export function migrateGameData(gameData: any, fromVersion: string, toVersion: string): GameData {
  // For now, just return as-is since we only have one version
  // Future migrations would be implemented here
  if (fromVersion === toVersion) {
    return gameData as GameData;
  }
  
  throw new Error(`Migration from version ${fromVersion} to ${toVersion} not supported`);
}