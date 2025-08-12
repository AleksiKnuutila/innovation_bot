// Direct state manipulation functions for card effects
// These functions directly modify the game state and return the modified state

import type { GameData, PlayerBoard, PlayerColorStack, SupplyPile } from '@/types/game-data.js';
import type { CardId, Color, PlayerId, SplayDirection } from '@/types/core.js';
import type { GameEvent } from '@/types/events.js';
import { CARDS } from '@/cards/database.js';
import { emitEvent } from './events.js';
import { deepClone } from './utils.js';

// ============ Basic State Manipulation Functions ============

/**
 * Draw a card from the specified age supply pile
 * If the requested age is empty, draws from the next available age pile
 */
export function drawCard(
  gameData: GameData, 
  playerId: PlayerId, 
  age: number,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  
  // Find the supply pile for the specified age, or the next available one
  let supplyPile = newState.shared.supplyPiles.find(pile => pile.age === age);
  let actualAge = age;
  
  // If the requested age is empty, find the next available age pile
  if (!supplyPile || supplyPile.cards.length === 0) {
    // Sort supply piles by age and find the first one with cards
    const availablePiles = newState.shared.supplyPiles
      .filter(pile => pile.cards.length > 0)
      .sort((a, b) => a.age - b.age);
    
    if (availablePiles.length === 0) {
      throw new Error('No cards available in any supply pile');
    }
    
    // Find the first pile with age >= requested age, or the lowest available age
    const nextPile = availablePiles.find(pile => pile.age >= age) || availablePiles[0];
    if (nextPile) {
      supplyPile = nextPile;
      actualAge = nextPile.age;
    } else {
      throw new Error('No available supply piles found');
    }
  }
  
  // At this point, supplyPile is guaranteed to be defined and have cards
  if (!supplyPile || supplyPile.cards.length === 0) {
    throw new Error('No cards available in any supply pile');
  }
  
  // Take the top card from the supply pile
  const drawnCardId = supplyPile.cards.pop()!;
  
  // Add to player's hand
  const player = newState.players[playerId]!;
  player.hands.push(drawnCardId);
  
  // Emit draw event with actual age drawn from
  const event = emitEvent(newState, 'drew', {
    playerId,
    cardId: drawnCardId,
    fromAge: actualAge,
    requestedAge: age,
    toZone: { playerId, zone: 'hand' },
  });
  events.push(event);
  
  return newState;
}

/**
 * Meld a card from hand to the player's board
 */
export function meldCard(
  gameData: GameData, 
  playerId: PlayerId, 
  cardId: CardId,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from hand
  const handIndex = player.hands.indexOf(cardId);
  if (handIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s hand`);
  }
  player.hands.splice(handIndex, 1);
  
  // Get card data
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    throw new Error(`Invalid card ID: ${cardId}`);
  }
  
  // Add card to appropriate color stack on board
  const existingColorStack = player.colors.find(stack => stack.color === card.color);
  
  if (existingColorStack) {
    existingColorStack.cards.push(cardId);
  } else {
    player.colors.push({
      color: card.color,
      cards: [cardId],
    });
  }
  
  // Emit meld event
  const event = emitEvent(newState, 'melded', {
    playerId,
    cardId,
    color: card.color,
    fromHand: true,
  });
  events.push(event);
  
  return newState;
}

/**
 * Score a card from hand to the player's score pile
 */
export function scoreCard(
  gameData: GameData, 
  playerId: PlayerId, 
  cardId: CardId,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from hand
  const handIndex = player.hands.indexOf(cardId);
  if (handIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s hand`);
  }
  player.hands.splice(handIndex, 1);
  
  // Add to score pile
  player.scores.push(cardId);
  
  // Emit score event
  const event = emitEvent(newState, 'scored', {
    playerId,
    cardIds: [cardId],
    pointsGained: 0, // Will be calculated later
    fromZone: { playerId, zone: 'hand' },
  });
  events.push(event);
  
  return newState;
}

/**
 * Tuck a card from hand beneath a color stack
 */
export function tuckCard(
  gameData: GameData, 
  playerId: PlayerId, 
  cardId: CardId,
  color: Color,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from hand
  const handIndex = player.hands.indexOf(cardId);
  if (handIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s hand`);
  }
  player.hands.splice(handIndex, 1);
  
  // Add card to bottom of color stack (tucking)
  const colorStack = player.colors.find(stack => stack.color === color);
  if (!colorStack) {
    throw new Error(`Player ${playerId} has no ${color} color stack to tuck under`);
  }
  
  colorStack.cards.unshift(cardId); // Add to beginning (bottom)
  
  // Emit tuck event
  const event = emitEvent(newState, 'tucked', {
    playerId,
    cardId,
    color,
  });
  events.push(event);
  
  return newState;
}

/**
 * Splay a color stack in the specified direction
 */
export function splayColor(
  gameData: GameData, 
  playerId: PlayerId, 
  color: Color,
  direction: SplayDirection,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Find the color stack
  const colorStack = player.colors.find(stack => stack.color === color);
  if (!colorStack) {
    throw new Error(`Player ${playerId} has no ${color} color stack to splay`);
  }
  
  if (colorStack.cards.length < 2) {
    throw new Error(`Cannot splay ${color} stack with fewer than 2 cards`);
  }
  
  // Update splay direction by creating a new color stack
  const newColorStack: typeof colorStack = {
    ...colorStack,
    splayDirection: direction,
  };
  
  // Replace the old color stack
  const colorIndex = player.colors.findIndex(stack => stack.color === color);
  player.colors[colorIndex] = newColorStack;
  
  // Emit splay event
  const event = emitEvent(newState, 'splayed', {
    playerId,
    color,
    direction,
    previousDirection: colorStack.splayDirection,
  });
  events.push(event);
  
  return newState;
}

/**
 * Transfer a card from one player to another
 */
export function transferCard(
  gameData: GameData,
  fromPlayerId: PlayerId,
  toPlayerId: PlayerId,
  cardId: CardId,
  fromZone: 'hand' | 'board' | 'score',
  toZone: 'hand' | 'board' | 'score',
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const fromPlayer = newState.players[fromPlayerId]!;
  const toPlayer = newState.players[toPlayerId]!;
  
  // Remove card from source zone
  let removed = false;
  if (fromZone === 'hand') {
    const handIndex = fromPlayer.hands.indexOf(cardId);
    if (handIndex !== -1) {
      fromPlayer.hands.splice(handIndex, 1);
      removed = true;
    }
  } else if (fromZone === 'board') {
    // Find card in color stacks and remove it
    for (const colorStack of fromPlayer.colors) {
      const cardIndex = colorStack.cards.indexOf(cardId);
      if (cardIndex !== -1) {
        colorStack.cards.splice(cardIndex, 1);
        removed = true;
        break;
      }
    }
  } else if (fromZone === 'score') {
    const scoreIndex = fromPlayer.scores.indexOf(cardId);
    if (scoreIndex !== -1) {
      fromPlayer.scores.splice(scoreIndex, 1);
      removed = true;
    }
  }
  
  if (!removed) {
    throw new Error(`Card ${cardId} not found in ${fromPlayerId}'s ${fromZone}`);
  }
  
  // Add card to destination zone
  if (toZone === 'hand') {
    toPlayer.hands.push(cardId);
  } else if (toZone === 'board') {
    // Get card data to determine color
    const card = CARDS.cardsById.get(cardId);
    if (!card) {
      throw new Error(`Invalid card ID: ${cardId}`);
    }
    
    // Add to appropriate color stack
    const existingColorStack = toPlayer.colors.find(stack => stack.color === card.color);
    if (existingColorStack) {
      existingColorStack.cards.push(cardId);
    } else {
      toPlayer.colors.push({
        color: card.color,
        cards: [cardId],
      });
    }
  } else if (toZone === 'score') {
    toPlayer.scores.push(cardId);
  }
  
  // Emit transfer event
  const event = emitEvent(newState, 'transferred', {
    cardId,
    fromPlayer,
    toPlayer: toPlayerId,
    fromZone: { playerId: fromPlayerId, zone: fromZone },
    toZone: { playerId: toPlayerId, zone: toZone },
  });
  events.push(event);
  
  return newState;
}

/**
 * Return a card from hand to the supply pile
 */
export function returnCard(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  age: number,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from hand
  const handIndex = player.hands.indexOf(cardId);
  if (handIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s hand`);
  }
  player.hands.splice(handIndex, 1);
  
  // Add card back to supply pile
  const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === age);
  if (!supplyPile) {
    throw new Error(`Supply pile for age ${age} not found`);
  }
  
  supplyPile.cards.push(cardId);
  
  // Emit return event
  const event = emitEvent(newState, 'returned', {
    playerId,
    cardId,
    fromZone: { playerId, zone: 'hand' },
    toAge: age,
  });
  events.push(event);
  
  return newState;
}

// ============ Helper Functions ============

/**
 * Get the top card of a color stack (most recently melded)
 */
export function getTopCard(gameData: GameData, playerId: PlayerId, color: Color): CardId | null {
  const player = gameData.players[playerId];
  if (!player) return null;
  
  const colorStack = player.colors.find(stack => stack.color === color);
  if (!colorStack || colorStack.cards.length === 0) return null;
  
  return colorStack.cards[colorStack.cards.length - 1] ?? null;
}

/**
 * Get all top cards from a player's board
 */
export function getTopCards(gameData: GameData, playerId: PlayerId): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  return player.colors
    .filter(stack => stack.cards.length > 0)
    .map(stack => stack.cards[stack.cards.length - 1])
    .filter((cardId): cardId is CardId => cardId !== undefined);
}

/**
 * Check if a player has a specific icon on their board
 */
export function hasIcon(gameData: GameData, playerId: PlayerId, icon: string): boolean {
  const player = gameData.players[playerId];
  if (!player) return false;
  
  for (const colorStack of player.colors) {
    for (const cardId of colorStack.cards) {
      const card = CARDS.cardsById.get(cardId);
      if (card && (
        card.positions.top === icon ||
        card.positions.left === icon ||
        card.positions.middle === icon ||
        card.positions.right === icon
      )) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Count total icons of a specific type on a player's board
 */
export function countIcons(gameData: GameData, playerId: PlayerId, icon: string): number {
  const player = gameData.players[playerId];
  if (!player) return 0;
  
  let count = 0;
  for (const colorStack of player.colors) {
    for (const cardId of colorStack.cards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        if (card.positions.top === icon) count++;
        if (card.positions.left === icon) count++;
        if (card.positions.middle === icon) count++;
        if (card.positions.right === icon) count++;
      }
    }
  }
  
  return count;
} 