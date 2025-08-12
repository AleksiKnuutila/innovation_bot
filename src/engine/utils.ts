// Utility functions for the game engine

import type { GameId, PlayerId } from '@/types/core.js';
import type { GameData } from '@/types/game-data.js';
import type { Icon } from '@/types/cards.js';
import { CARDS } from '@/cards/database.js';
import { countIcon } from '@/types/cards.js';

// Generate a unique game ID
export function generateGameId(): GameId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `game-${timestamp}-${random}`;
}

// Simple hash function for state validation
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash >>> 0; // Convert to unsigned
}

// Deep clone using JSON (simple but effective for our data structures)
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Get current timestamp for events
export function getCurrentTimestamp(): number {
  return Date.now();
}

// Get player icon count (replaces cache system)
export function getPlayerIconCount(
  gameData: GameData, 
  playerId: PlayerId, 
  icon: Icon
): number {
  const player = gameData.players[playerId];
  if (!player) return 0;
  
  let count = 0;
  for (const colorStack of player.colors) {
    for (const cardId of colorStack.cards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        count += countIcon(card, icon);
      }
    }
  }
  return count;
}