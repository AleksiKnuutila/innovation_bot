// Direct state manipulation functions for card effects
// These functions directly modify the game state and return the modified state

import type { GameData, PlayerColorStack } from '@/types/game-data.js';
import type { CardId, Color, PlayerId, SplayDirection } from '@/types/core.js';
import type { GameEvent } from '@/types/events.js';
import { CARDS } from '@/cards/database.js';
import { emitEvent } from './events.js';
import { deepClone } from './utils.js';

// ============ Basic State Manipulation Functions ============

/**
 * Draw a card from the specified age supply pile
 * If the requested age is empty, draws from the next available age pile
 * If age 11+ is requested, triggers game end for score victory
 */
export function drawCard(
  gameData: GameData, 
  playerId: PlayerId, 
  age: number,
  events: GameEvent[]
): GameData {
  // Check for age 11+ victory condition
  if (age >= 11) {
    // Game ends immediately - player with highest score wins
    const gameEndEvent = emitEvent(gameData, 'game_end', {
      winner: null, // Will be determined by score
      winCondition: 'score',
      finalScores: { 0: 0, 1: 0 }, // Placeholder - will be calculated
      source: 'age_11_draw_attempt'
    });
    events.push(gameEndEvent);
    
    // Return game state with game over phase
    return {
      ...gameData,
      phase: {
        ...gameData.phase,
        state: 'GameOver'
      }
    };
  }
  
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
  
  // Track turn-based scoring for Monument achievement
  let updatedState = newState;
  if (!updatedState.turnActions) {
    updatedState = {
      ...updatedState,
      turnActions: { [playerId]: { cardsScored: [], cardsTucked: [] } }
    };
  }
  if (!updatedState.turnActions![playerId]) {
    updatedState = {
      ...updatedState,
      turnActions: {
        ...updatedState.turnActions!,
        [playerId]: { cardsScored: [], cardsTucked: [] }
      }
    };
  }
  updatedState = {
    ...updatedState,
    turnActions: {
      ...updatedState.turnActions!,
      [playerId]: {
        ...updatedState.turnActions![playerId]!,
        cardsScored: [...updatedState.turnActions![playerId]!.cardsScored, cardId]
      }
    }
  };
  
  // Emit score event
  const event = emitEvent(updatedState, 'scored', {
    playerId,
    cardIds: [cardId],
    pointsGained: 0, // Will be calculated later
    fromZone: { playerId, zone: 'hand' },
  });
  events.push(event);
  
  return updatedState;
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
  
  // Find or create color stack for tucking
  let colorStack = player.colors.find(stack => stack.color === color);
  if (!colorStack) {
    // According to Innovation rules: "If there is no pile, the tuck starts a new pile"
    const newColorStack: PlayerColorStack = {
      color,
      cards: []
    };
    player.colors.push(newColorStack);
    colorStack = newColorStack;
  }
  
  // At this point, colorStack is guaranteed to exist
  colorStack.cards.unshift(cardId); // Add to beginning (bottom)
  
  // Track turn-based tucking for Monument achievement
  let updatedState = newState;
  if (!updatedState.turnActions) {
    updatedState = {
      ...updatedState,
      turnActions: { [playerId]: { cardsScored: [], cardsTucked: [] } }
    };
  }
  if (!updatedState.turnActions![playerId]) {
    updatedState = {
      ...updatedState,
      turnActions: {
        ...updatedState.turnActions!,
        [playerId]: { cardsScored: [], cardsTucked: [] }
      }
    };
  }
  updatedState = {
    ...updatedState,
    turnActions: {
      ...updatedState.turnActions!,
      [playerId]: {
        ...updatedState.turnActions![playerId]!,
        cardsTucked: [...updatedState.turnActions![playerId]!.cardsTucked, cardId]
      }
    }
  };
  
  // Emit tuck event
  const event = emitEvent(updatedState, 'tucked', {
    playerId,
    cardId,
    color,
  });
  events.push(event);
  
  return updatedState;
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

/**
 * Return a card from board to the supply pile
 */
export function returnCardFromBoard(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Get card data to determine its age
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not found in database`);
  }
  
  // Find and remove card from board
  let removed = false;
  for (const colorStack of player.colors) {
    const cardIndex = colorStack.cards.indexOf(cardId);
    if (cardIndex !== -1) {
      colorStack.cards.splice(cardIndex, 1);
      removed = true;
      break;
    }
  }
  
  if (!removed) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s board`);
  }
  
  // Add card back to supply pile
  const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
  if (!supplyPile) {
    throw new Error(`Supply pile for age ${card.age} not found`);
  }
  
  supplyPile.cards.push(cardId);
  
  // Emit return event
  const event = emitEvent(newState, 'returned', {
    playerId,
    cardId,
    fromZone: { playerId, zone: 'board' },
    toAge: card.age,
  });
  events.push(event);
  
  return newState;
}

/**
 * Exchange cards between hand and score pile
 * Swaps cards between the two zones
 */
export function exchangeCards(
  gameData: GameData,
  playerId: PlayerId,
  handCards: CardId[],
  scoreCards: CardId[],
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove cards from hand
  for (const cardId of handCards) {
    const handIndex = player.hands.indexOf(cardId);
    if (handIndex === -1) {
      throw new Error(`Card ${cardId} not found in player ${playerId}'s hand`);
    }
    player.hands.splice(handIndex, 1);
  }
  
  // Remove cards from score pile
  for (const cardId of scoreCards) {
    const scoreIndex = player.scores.indexOf(cardId);
    if (scoreIndex === -1) {
      throw new Error(`Card ${cardId} not found in player ${playerId}'s score pile`);
    }
    player.scores.splice(scoreIndex, 1);
  }
  
  // Add score cards to hand
  player.hands.push(...scoreCards);
  
  // Add hand cards to score pile
  player.scores.push(...handCards);
  
  // Emit exchange events
  for (const cardId of handCards) {
    const event = emitEvent(newState, 'scored', {
      playerId,
      cardIds: [cardId],
      pointsGained: 0, // Will be calculated later
      fromZone: { playerId, zone: 'hand' },
    });
    events.push(event);
  }
  
  for (const cardId of scoreCards) {
    const event = emitEvent(newState, 'drew', {
      playerId,
      cardId,
      fromAge: 0, // From score pile
      toZone: { playerId, zone: 'hand' },
    });
    events.push(event);
  }
  
  return newState;
}

/**
 * Reveal a card from hand without drawing it
 * Used for effects that need to see card contents
 */
export function revealCard(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Verify card is in hand
  const handIndex = player.hands.indexOf(cardId);
  if (handIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s hand`);
  }
  
  // Emit reveal event (card stays in hand)
  const event = emitEvent(newState, 'card_revealed', {
    playerId,
    cardId,
    fromZone: { playerId, zone: 'hand' },
  });
  events.push(event);
  
  return newState;
}

/**
 * Move a card between different zones (hand, board, score) for the same player
 * Used for effects like "score a card from your hand"
 */
export function moveCardBetweenZones(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  fromZone: 'hand' | 'board' | 'score',
  toZone: 'hand' | 'board' | 'score',
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  // Remove card from source zone
  let removed = false;
  if (fromZone === 'hand') {
    const handIndex = player.hands.indexOf(cardId);
    if (handIndex !== -1) {
      player.hands.splice(handIndex, 1);
      removed = true;
    }
  } else if (fromZone === 'board') {
    // Find card in color stacks and remove it
    for (const colorStack of player.colors) {
      const cardIndex = colorStack.cards.indexOf(cardId);
      if (cardIndex !== -1) {
        colorStack.cards.splice(cardIndex, 1);
        removed = true;
        break;
      }
    }
  } else if (fromZone === 'score') {
    const scoreIndex = player.scores.indexOf(cardId);
    if (scoreIndex !== -1) {
      player.scores.splice(scoreIndex, 1);
      removed = true;
    }
  }
  
  if (!removed) {
    throw new Error(`Card ${cardId} not found in ${playerId}'s ${fromZone}`);
  }
  
  // Add card to destination zone
  if (toZone === 'hand') {
    player.hands.push(cardId);
  } else if (toZone === 'board') {
    // Get card data to determine color
    const card = CARDS.cardsById.get(cardId);
    if (!card) {
      throw new Error(`Invalid card ID: ${cardId}`);
    }
    
    // Add to appropriate color stack
    const existingColorStack = player.colors.find(stack => stack.color === card.color);
    if (existingColorStack) {
      existingColorStack.cards.push(cardId);
    } else {
      player.colors.push({
        color: card.color,
        cards: [cardId],
      });
    }
  } else if (toZone === 'score') {
    player.scores.push(cardId);
  }
  
  // Emit move event
  const event = emitEvent(newState, 'transferred', {
    cardId,
    fromPlayer: playerId,
    toPlayer: playerId,
    fromZone: { playerId, zone: fromZone },
    toZone: { playerId, zone: toZone },
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
 * Count total icons of a specific type on a player's board
 * Only counts icons that are visible based on splay direction
 */
export function countIcons(gameData: GameData, playerId: PlayerId, icon: string): number {
  const player = gameData.players[playerId];
  if (!player) return 0;
  
  let count = 0;
  
  for (const colorStack of player.colors) {
    if (colorStack.cards.length === 0) continue;
    
    // Determine which icons are visible based on splay direction
    const visiblePositions = getVisibleIconPositions(colorStack);
    
    for (const cardId of colorStack.cards) {
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        // Count icons only in visible positions
        for (const position of visiblePositions) {
          if (card.positions[position] === icon) {
            count++;
          }
        }
      }
    }
  }
  
  return count;
}

/**
 * Get which icon positions are visible based on splay direction
 * Returns array of position keys that are currently visible
 */
function getVisibleIconPositions(colorStack: PlayerColorStack): Array<'top' | 'left' | 'middle' | 'right'> {
  // For single cards, all positions are visible
  if (colorStack.cards.length <= 1) {
    return ['top', 'left', 'middle', 'right'];
  }
  
  // For multiple cards, check splay direction
  switch (colorStack.splayDirection) {
    case 'left':
      // Left splay reveals 1 additional icon (left position)
      return ['top', 'left'];
    case 'right':
      // Right splay reveals 2 additional icons (left and middle)
      return ['top', 'left', 'middle'];
    case 'up':
      // Up splay reveals 3 additional icons (left, middle, right)
      return ['top', 'left', 'middle', 'right'];
    default:
      // Multiple cards with no splay - only top card's top position is visible
      return ['top'];
  }
}

/**
 * Check if a player has a specific icon on their board
 * Only checks visible icons based on splay direction
 */
export function hasIcon(gameData: GameData, playerId: PlayerId, icon: string): boolean {
  return countIcons(gameData, playerId, icon) > 0;
} 

/**
 * Helper function to implement "do all you can, ignore the rest" rule
 * Takes a list of items and a predicate, returns as many as possible
 */
export function doAllYouCan<T>(
  items: T[],
  predicate: (item: T) => boolean,
  maxItems?: number
): T[] {
  const availableItems = items.filter(predicate);
  if (maxItems !== undefined) {
    return availableItems.slice(0, maxItems);
  }
  return availableItems;
}

/**
 * Helper function to safely execute an effect that might fail
 * Returns the result and any error that occurred
 */
export function safeExecute<T>(
  effect: () => T
): { result: T | null; error: Error | null } {
  try {
    const result = effect();
    return { result, error: null };
  } catch (error) {
    return { result: null, error: error as Error };
  }
} 

// ============ Composite Primitive Functions ============

/**
 * Draw a card from age X and immediately score it
 * Used in 20+ cards like Chemistry, Navigation, Fission, etc.
 */
export function drawAndScore(
  gameData: GameData,
  playerId: PlayerId,
  age: number,
  count: number = 1,
  events: GameEvent[]
): GameData {
  let newState = gameData;
  
  for (let i = 0; i < count; i++) {
    // Draw the card
    newState = drawCard(newState, playerId, age, events);
    
    // Get the last drawn card from hand
    const player = newState.players[playerId]!;
    const drawnCardId = player.hands[player.hands.length - 1]!;
    
    // Score it immediately
    newState = scoreCard(newState, playerId, drawnCardId, events);
  }
  
  return newState;
}

/**
 * Score specific cards from the board to the score pile
 * Used in cards like Canning that score cards based on criteria
 */
export function scoreCardsFromBoard(
  gameData: GameData,
  playerId: PlayerId,
  cardIds: CardId[],
  events: GameEvent[]
): GameData {
  const newState = deepClone(gameData);
  const player = newState.players[playerId]!;
  
  for (const cardId of cardIds) {
    // Find and remove from board
    let found = false;
    for (const colorStack of player.colors) {
      const cardIndex = colorStack.cards.indexOf(cardId);
      if (cardIndex !== -1) {
        colorStack.cards.splice(cardIndex, 1);
        found = true;
        break;
      }
    }
    
    if (found) {
      // Add to score pile
      player.scores.push(cardId);
      
      // Emit scored event
      const scoredEvent = emitEvent(newState, 'scored', {
        playerId,
        cardIds: [cardId],
        pointsGained: 0, // Will be calculated later
        fromZone: { playerId, zone: 'board' },
      });
      events.push(scoredEvent);
    }
  }
  
  return newState;
}

/**
 * Draw a card from age X and immediately meld it
 * Used in 20+ cards like Sailing, Mathematics, Alchemy, etc.
 */
export function drawAndMeld(
  gameData: GameData,
  playerId: PlayerId,
  age: number,
  count: number = 1,
  events: GameEvent[]
): GameData {
  let newState = gameData;
  
  for (let i = 0; i < count; i++) {
    // Draw the card
    newState = drawCard(newState, playerId, age, events);
    
    // Get the last drawn card from hand
    const player = newState.players[playerId]!;
    const drawnCardId = player.hands[player.hands.length - 1]!;
    
    // Meld it immediately
    newState = meldCard(newState, playerId, drawnCardId, events);
  }
  
  return newState;
}

/**
 * Draw a card from age X and immediately tuck it
 * Used in 15+ cards like Code of Laws, Monotheism, Colonialism, etc.
 */
export function drawAndTuck(
  gameData: GameData,
  playerId: PlayerId,
  age: number,
  count: number = 1,
  events: GameEvent[]
): GameData {
  let newState = gameData;
  
  for (let i = 0; i < count; i++) {
    // Draw the card
    newState = drawCard(newState, playerId, age, events);
    
    // Get the last drawn card from hand
    const player = newState.players[playerId]!;
    const drawnCardId = player.hands[player.hands.length - 1]!;
    
    // Get card data to determine color
    const card = CARDS.cardsById.get(drawnCardId);
    if (!card) {
      throw new Error(`Invalid card ID: ${drawnCardId}`);
    }
    
    // Tuck it immediately
    newState = tuckCard(newState, playerId, drawnCardId, card.color, events);
  }
  
  return newState;
}

/**
 * Draw a card from age X and immediately splay a color
 * Used in 12+ cards like Philosophy, Paper, Invention, etc.
 */
export function drawAndSplay(
  gameData: GameData,
  playerId: PlayerId,
  age: number,
  count: number = 1,
  color: Color,
  direction: SplayDirection,
  events: GameEvent[]
): GameData {
  let newState = gameData;
  
  // Draw the cards first
  for (let i = 0; i < count; i++) {
    newState = drawCard(newState, playerId, age, events);
  }
  
  // Then splay the color
  newState = splayColor(newState, playerId, color, direction, events);
  
  return newState;
}

/**
 * Demand that a player transfer a card with specific criteria
 * Used in 15+ cards like Archery, City States, Oars, etc.
 */
export function demandTransfer(
  gameData: GameData,
  demandingPlayer: PlayerId,
  targetPlayer: PlayerId,
  cardType: 'any' | 'with_icon' | 'without_icon' | 'non_color',
  fromZone: 'hand' | 'board' | 'score',
  toZone: 'hand' | 'board' | 'score',
  events: GameEvent[],
  iconType?: string,
  color?: Color
): GameData {
  const newState = deepClone(gameData);
  const targetPlayerData = newState.players[targetPlayer]!;
  
  // Find valid cards based on criteria
  let validCards: CardId[] = [];
  
  if (fromZone === 'hand') {
    validCards = targetPlayerData.hands.filter(cardId => {
      const card = CARDS.cardsById.get(cardId);
      if (!card) return false;
      
      if (cardType === 'with_icon' && iconType) {
        return hasIcon(newState, targetPlayer, iconType);
      } else if (cardType === 'without_icon' && iconType) {
        return !hasIcon(newState, targetPlayer, iconType);
      } else if (cardType === 'non_color' && color) {
        return card.color !== color;
      }
      return true;
    });
  } else if (fromZone === 'board') {
    // Find top cards on board
    for (const colorStack of targetPlayerData.colors) {
      if (colorStack.cards.length > 0) {
        const topCardId = colorStack.cards[colorStack.cards.length - 1]!;
        const card = CARDS.cardsById.get(topCardId);
        if (!card) continue;
        
        if (cardType === 'with_icon' && iconType) {
          if (hasIcon(newState, targetPlayer, iconType)) {
            validCards.push(topCardId);
          }
        } else if (cardType === 'without_icon' && iconType) {
          if (!hasIcon(newState, targetPlayer, iconType)) {
            validCards.push(topCardId);
          }
        } else if (cardType === 'non_color' && color) {
          if (card.color !== color) {
            validCards.push(topCardId);
          }
        } else {
          validCards.push(topCardId);
        }
      }
    }
  } else if (fromZone === 'score') {
    validCards = targetPlayerData.scores.filter(cardId => {
      const card = CARDS.cardsById.get(cardId);
      if (!card) return false;
      
      if (cardType === 'with_icon' && iconType) {
        return hasIcon(newState, targetPlayer, iconType);
      } else if (cardType === 'without_icon' && iconType) {
        return !hasIcon(newState, targetPlayer, iconType);
      } else if (cardType === 'non_color' && color) {
        return card.color !== color;
      }
      return true;
    });
  }
  
  // If no valid cards, return unchanged state
  if (validCards.length === 0) {
    return newState;
  }
  
  // Transfer the first valid card found
  const cardToTransfer = validCards[0]!;
  return transferCard(newState, targetPlayer, demandingPlayer, cardToTransfer, fromZone, toZone, events);
}

/**
 * Demand that a player return cards from a specific zone
 * Used in 8+ cards like Anatomy, Fission, Databases, etc.
 */
export function demandReturn(
  gameData: GameData,
  _demandingPlayer: PlayerId,
  targetPlayer: PlayerId,
  zone: 'hand' | 'board' | 'score',
  cardType: 'any' | 'highest' | 'lowest' | 'all',
  count: number = 1,
  events: GameEvent[]
): GameData {
  let newState = deepClone(gameData);
  const targetPlayerData = newState.players[targetPlayer]!;
  
  let cardsToReturn: CardId[] = [];
  
  if (zone === 'hand') {
    if (cardType === 'all') {
      cardsToReturn = [...targetPlayerData.hands];
    } else if (cardType === 'highest') {
      // Find highest value card(s)
      const sortedCards = [...targetPlayerData.hands].sort((a, b) => {
        const cardA = CARDS.cardsById.get(a);
        const cardB = CARDS.cardsById.get(b);
        return (cardB?.age || 0) - (cardA?.age || 0);
      });
      cardsToReturn = sortedCards.slice(0, count);
    } else if (cardType === 'lowest') {
      // Find lowest value card(s)
      const sortedCards = [...targetPlayerData.hands].sort((a, b) => {
        const cardA = CARDS.cardsById.get(a);
        const cardB = CARDS.cardsById.get(b);
        return (cardA?.age || 0) - (cardB?.age || 0);
      });
      cardsToReturn = sortedCards.slice(0, count);
    }
  } else if (zone === 'score') {
    if (cardType === 'all') {
      cardsToReturn = [...targetPlayerData.scores];
    } else if (cardType === 'highest') {
      // Find highest value card(s)
      const sortedCards = [...targetPlayerData.scores].sort((a, b) => {
        const cardA = CARDS.cardsById.get(a);
        const cardB = CARDS.cardsById.get(b);
        return (cardB?.age || 0) - (cardA?.age || 0);
      });
      cardsToReturn = sortedCards.slice(0, count);
    } else if (cardType === 'lowest') {
      // Find lowest value card(s)
      const sortedCards = [...targetPlayerData.scores].sort((a, b) => {
        const cardA = CARDS.cardsById.get(a);
        const cardB = CARDS.cardsById.get(b);
        return (cardA?.age || 0) - (cardB?.age || 0);
      });
      cardsToReturn = sortedCards.slice(0, count);
    }
  }
  
  // Return the cards
  for (const cardId of cardsToReturn) {
    if (zone === 'hand') {
      // Remove from hand and return to supply
      const card = CARDS.cardsById.get(cardId);
      if (card) {
        newState = returnCard(newState, targetPlayer, cardId, card.age, events);
      }
    } else if (zone === 'score') {
      // Remove from score pile (no return to supply for score cards)
      const scoreIndex = targetPlayerData.scores.indexOf(cardId);
      if (scoreIndex !== -1) {
        targetPlayerData.scores.splice(scoreIndex, 1);
        
        // Emit event for card removed from score
        const event = emitEvent(newState, 'transferred', {
          playerId: targetPlayer,
          cardId,
          fromZone: { playerId: targetPlayer, zone: 'score' },
          toZone: { playerId: null, zone: 'removed' },
          source: 'demand_return'
        });
        events.push(event);
      }
    }
  }
  
  return newState;
}

/**
 * Exchange cards between hand and score pile
 * Used in 6+ cards like Canal Building, Bicycle, etc.
 */
export function exchangeHandScore(
  gameData: GameData,
  playerId: PlayerId,
  handCards: CardId[],
  scoreCards: CardId[],
  events: GameEvent[]
): GameData {
  return exchangeCards(gameData, playerId, handCards, scoreCards, events);
}

/**
 * Exchange cards with an opponent
 * Used in 4+ cards like Machinery, Medicine, Sanitation, etc.
 */
export function exchangeWithOpponent(
  gameData: GameData,
  playerId: PlayerId,
  opponentId: PlayerId,
  fromZone: 'hand' | 'board' | 'score',
  toZone: 'hand' | 'board' | 'score',
  playerCards: CardId[],
  opponentCards: CardId[],
  events: GameEvent[]
): GameData {
  let newState = gameData;
  
  // Transfer player's cards to opponent
  for (const cardId of playerCards) {
    newState = transferCard(newState, playerId, opponentId, cardId, fromZone, toZone, events);
  }
  
  // Transfer opponent's cards to player
  for (const cardId of opponentCards) {
    newState = transferCard(newState, opponentId, playerId, cardId, fromZone, toZone, events);
  }
  
  return newState;
} 

// Helper function to check if a card has a specific icon
export function cardHasIcon(cardId: CardId, icon: string): boolean {
  const card = CARDS.cardsById.get(cardId);
  if (!card) return false;
  
  const positions = card.positions;
  return positions.top === icon || 
         positions.left === icon || 
         positions.middle === icon || 
         positions.right === icon;
}

// Helper function to count icons on a specific card
export function countIconsOnCard(cardId: CardId, icon: string): number {
  const card = CARDS.cardsById.get(cardId);
  if (!card) return 0;
  
  let count = 0;
  const positions = card.positions;
  if (positions.top === icon) count++;
  if (positions.left === icon) count++;
  if (positions.middle === icon) count++;
  if (positions.right === icon) count++;
  
  return count;
}

// Helper function to find cards with specific icons in a player's hand
export function findCardsWithIcon(
  gameData: GameData,
  playerId: PlayerId,
  icon: string,
  zone: 'hand' | 'score' | 'board' = 'hand'
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  let cardsToSearch: CardId[] = [];
  
  switch (zone) {
    case 'hand':
      cardsToSearch = player.hands;
      break;
    case 'score':
      cardsToSearch = player.scores;
      break;
    case 'board':
      // Get all top cards from board
      cardsToSearch = player.colors
        .filter(stack => stack.cards.length > 0)
        .map(stack => stack.cards[stack.cards.length - 1]!);
      break;
  }
  
  return cardsToSearch.filter(cardId => cardHasIcon(cardId, icon));
}

// Helper function to find cards with specific color and icon combination
export function findCardsWithColorAndIcon(
  gameData: GameData,
  playerId: PlayerId,
  color: string | null, // null means any color
  icon: string,
  zone: 'hand' | 'score' | 'board' = 'hand',
  excludeColor?: string // optional color to exclude (e.g., "non-green")
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  let cardsToSearch: CardId[] = [];
  
  switch (zone) {
    case 'hand':
      cardsToSearch = player.hands;
      break;
    case 'score':
      cardsToSearch = player.scores;
      break;
    case 'board':
      // Get all top cards from board
      cardsToSearch = player.colors
        .filter(stack => stack.cards.length > 0)
        .map(stack => stack.cards[stack.cards.length - 1]!);
      break;
  }
  
  return cardsToSearch.filter(cardId => {
    const card = CARDS.cardsById.get(cardId);
    if (!card) return false;
    
    // Check icon requirement
    if (!cardHasIcon(cardId, icon)) return false;
    
    // Check color requirement
    if (color !== null && card.color !== color) return false;
    
    // Check exclude color requirement (e.g., "non-green")
    if (excludeColor && card.color === excludeColor) return false;
    
    return true;
  });
}

// Helper function to find cards with specific age/value constraints
export function findCardsWithValueConstraint(
  gameData: GameData,
  playerId: PlayerId,
  constraint: 'highest' | 'lowest' | { min?: number; max?: number; exact?: number },
  zone: 'hand' | 'score' | 'board' = 'hand',
  count?: number // how many cards to return (e.g., "two highest")
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  let cardsToSearch: CardId[] = [];
  
  switch (zone) {
    case 'hand':
      cardsToSearch = player.hands;
      break;
    case 'score':
      cardsToSearch = player.scores;
      break;
    case 'board':
      // Get all top cards from board
      cardsToSearch = player.colors
        .filter(stack => stack.cards.length > 0)
        .map(stack => stack.cards[stack.cards.length - 1]!);
      break;
  }
  
  // Filter by value constraints
  let filteredCards = cardsToSearch;
  
  if (typeof constraint === 'object') {
    filteredCards = cardsToSearch.filter(cardId => {
      const card = CARDS.cardsById.get(cardId);
      if (!card) return false;
      
      if (constraint.min !== undefined && card.age < constraint.min) return false;
      if (constraint.max !== undefined && card.age > constraint.max) return false;
      if (constraint.exact !== undefined && card.age !== constraint.exact) return false;
      
      return true;
    });
  } else {
    // Sort by age for highest/lowest
    const sortedCards = cardsToSearch.map(cardId => {
      const card = CARDS.cardsById.get(cardId);
      return { cardId, age: card?.age || 0 };
    }).sort((a, b) => {
      return constraint === 'highest' ? b.age - a.age : a.age - b.age;
    });
    
    if (constraint === 'highest' || constraint === 'lowest') {
      if (sortedCards.length === 0) return [];
      
      const targetAge = sortedCards[0]!.age;
      filteredCards = sortedCards
        .filter(item => item.age === targetAge)
        .map(item => item.cardId);
    }
  }
  
  // Apply count limit if specified
  if (count !== undefined && count > 0) {
    return filteredCards.slice(0, count);
  }
  
  return filteredCards;
}

// Helper function to find top cards from board with specific color
export function findTopCardsWithColor(
  gameData: GameData,
  playerId: PlayerId,
  color: string,
  excludeColor?: string
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  const topCards: CardId[] = [];
  
  for (const stack of player.colors) {
    if (stack.cards.length === 0) continue;
    
    const topCard = stack.cards[stack.cards.length - 1]!;
    const card = CARDS.cardsById.get(topCard);
    if (!card) continue;
    
    // Check color requirement
    if (color && card.color !== color) continue;
    
    // Check exclude color requirement
    if (excludeColor && card.color === excludeColor) continue;
    
    topCards.push(topCard);
  }
  
  return topCards;
}

// Helper function to find all top cards WITHOUT a specific icon (common pattern)
export function findTopCardsWithoutIcon(
  gameData: GameData,
  playerId: PlayerId,
  icon: string
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  const topCards: CardId[] = [];
  
  for (const stack of player.colors) {
    if (stack.cards.length === 0) continue;
    
    const topCard = stack.cards[stack.cards.length - 1]!;
    if (!cardHasIcon(topCard, icon)) {
      topCards.push(topCard);
    }
  }
  
  return topCards;
}

// Helper function to find all top cards WITH a specific icon (existing pattern)
export function findTopCardsWithIcon(
  gameData: GameData,
  playerId: PlayerId,
  icon: string
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  const topCards: CardId[] = [];
  
  for (const stack of player.colors) {
    if (stack.cards.length === 0) continue;
    
    const topCard = stack.cards[stack.cards.length - 1]!;
    if (cardHasIcon(topCard, icon)) {
      topCards.push(topCard);
    }
  }
  
  return topCards;
}

// Helper function to find cards by any criteria function
export function findCardsByCriteria(
  gameData: GameData,
  playerId: PlayerId,
  zone: 'hand' | 'score' | 'board',
  criteriaFn: (cardId: CardId) => boolean
): CardId[] {
  const player = gameData.players[playerId];
  if (!player) return [];
  
  let cardsToSearch: CardId[] = [];
  
  switch (zone) {
    case 'hand':
      cardsToSearch = player.hands;
      break;
    case 'score':
      cardsToSearch = player.scores;
      break;
    case 'board':
      // Get all top cards from board
      cardsToSearch = player.colors
        .filter(stack => stack.cards.length > 0)
        .map(stack => stack.cards[stack.cards.length - 1]!);
      break;
  }
  
  return cardsToSearch.filter(criteriaFn);
}

// Helper function to find all non-green top cards with Factory icons (common pattern)
export function findNonGreenFactoryCards(
  gameData: GameData,
  playerId: PlayerId
): CardId[] {
  return findCardsWithColorAndIcon(gameData, playerId, null, 'Factory', 'board', 'Green');
}

// Helper function to find all cards with Crown icons in hand (common pattern)
export function findCrownCardsInHand(
  gameData: GameData,
  playerId: PlayerId
): CardId[] {
  return findCardsWithIcon(gameData, playerId, 'Crown', 'hand');
} 

/**
 * Return a card from player's score pile to the supply pile
 */
export function returnCardFromScore(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  events: GameEvent[]
): GameData {
  const newState = { ...gameData };
  const player = newState.players[playerId]!;
  
  // Find and remove card from score pile
  const scoreIndex = player.scores.indexOf(cardId);
  if (scoreIndex === -1) {
    throw new Error(`Card ${cardId} not found in player ${playerId}'s score pile`);
  }
  player.scores.splice(scoreIndex, 1);
  
  // Get card info
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not found in database`);
  }
  
  // Add card back to supply pile
  const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
  if (!supplyPile) {
    throw new Error(`Supply pile for age ${card.age} not found`);
  }
  
  supplyPile.cards.push(cardId);
  
  // Emit return event
  const event = emitEvent(newState, 'returned', {
    playerId,
    cardId,
    fromZone: { playerId, zone: 'score' },
    toAge: card.age,
  });
  events.push(event);
  
  return newState;
} 