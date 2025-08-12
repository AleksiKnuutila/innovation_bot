// Symbol comparison logic for dogma conditions
// Handles "most", "least", "at least", and tie-breaking rules

import type { GameData } from '@/types/game-data.js';
import type { PlayerId } from '@/types/core.js';
import type { SymbolComparison } from '@/types/dogma.js';
import { countIcons } from './state-manipulation.js';

/**
 * Compare icon counts across all players for dogma conditions
 */
export function compareIcons(
  gameData: GameData,
  icon: string,
  threshold?: number
): SymbolComparison {
  const playerIds = Object.keys(gameData.players).map(Number) as PlayerId[];
  const iconCounts = new Map<PlayerId, number>();
  
  // Count icons for each player
  for (const playerId of playerIds) {
    const count = countIcons(gameData, playerId, icon);
    iconCounts.set(playerId, count);
  }
  
  // Find players with most and least icons
  const counts = Array.from(iconCounts.values());
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  
  const most: PlayerId[] = [];
  const least: PlayerId[] = [];
  const atLeast: PlayerId[] = [];
  const below: PlayerId[] = [];
  
  for (const [playerId, count] of iconCounts) {
    if (count === maxCount) {
      most.push(playerId);
    }
    if (count === minCount) {
      least.push(playerId);
    }
    if (threshold !== undefined) {
      if (count >= threshold) {
        atLeast.push(playerId);
      } else {
        below.push(playerId);
      }
    }
  }
  
  return { most, least, atLeast, below };
}

/**
 * Check if a player is affected by a dogma effect based on icon comparison
 */
export function isPlayerAffected(
  gameData: GameData,
  playerId: PlayerId,
  icon: string,
  condition: 'most' | 'least' | 'at-least' | 'below',
  threshold?: number
): boolean {
  const comparison = compareIcons(gameData, icon, threshold);
  
  switch (condition) {
    case 'most':
      return comparison.most.includes(playerId);
    case 'least':
      return comparison.least.includes(playerId);
    case 'at-least':
      return comparison.atLeast.includes(playerId);
    case 'below':
      return comparison.below.includes(playerId);
    default:
      return false;
  }
}

/**
 * Get all players affected by a dogma effect
 */
export function getAffectedPlayers(
  gameData: GameData,
  icon: string,
  condition: 'most' | 'least' | 'at-least' | 'below',
  threshold?: number
): PlayerId[] {
  const comparison = compareIcons(gameData, icon, threshold);
  
  switch (condition) {
    case 'most':
      return comparison.most;
    case 'least':
      return comparison.least;
    case 'at-least':
      return comparison.atLeast;
    case 'below':
      return comparison.below;
    default:
      return [];
  }
}

/**
 * Check if a player has a specific icon on their board
 */
export function hasIcon(gameData: GameData, playerId: PlayerId, icon: string): boolean {
  return countIcons(gameData, playerId, icon) > 0;
}

/**
 * Get the highest icon count among all players
 */
export function getHighestIconCount(gameData: GameData, icon: string): number {
  const playerIds = Object.keys(gameData.players).map(Number) as PlayerId[];
  let highest = 0;
  
  for (const playerId of playerIds) {
    const count = countIcons(gameData, playerId, icon);
    if (count > highest) {
      highest = count;
    }
  }
  
  return highest;
}

/**
 * Get the lowest icon count among all players
 */
export function getLowestIconCount(gameData: GameData, icon: string): number {
  const playerIds = Object.keys(gameData.players).map(Number) as PlayerId[];
  let lowest = Infinity;
  
  for (const playerId of playerIds) {
    const count = countIcons(gameData, playerId, icon);
    if (count < lowest) {
      lowest = count;
    }
  }
  
  return lowest === Infinity ? 0 : lowest;
} 