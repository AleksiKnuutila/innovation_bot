// Game initialization and setup logic

import type { 
  GameData, 
  GameSetupOptions, 
  PlayerBoard,
  PlayerColorStack,
  SharedState,
  SupplyPile,
 
} from '@/types/game-data.js';
import type { GamePhase } from '@/types/game-state.js';
import type { CardId, PlayerId, Color, AchievementId, SpecialAchievementId } from '@/types/core.js';
import type { EventLog } from '@/types/events.js';
import { CARDS } from '@/cards/database.js';
import { DeterministicRng } from './rng.js';
import { generateGameId } from './utils.js';

// Initialize a new game with setup options
export function initializeGame(options: GameSetupOptions): GameData {
  const gameId = options.gameId || generateGameId();
  const rng = new DeterministicRng(options.rngSeed);
  
  // Create supply piles for ages 1-10
  const supplyPiles = createSupplyPiles(rng);
  
  // Create shared state
  const shared: SharedState = {
    supplyPiles,
    availableNormalAchievements: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    availableSpecialAchievements: ['Monument', 'Empire', 'World', 'Wonder', 'Universe'],
  };
  
  // Initialize both players
  const players: Record<PlayerId, PlayerBoard> = {
    0: createInitialPlayerBoard(),
    1: createInitialPlayerBoard(),
  };
  
  // Perform initial card distribution (each player draws 2 from age 1, chooses 1 to meld)
  const { updatedPlayers, updatedSupplyPiles } = performInitialSetup(players, supplyPiles, rng);
  
  // Determine starting player (alphabetically by chosen card)
  const startingPlayer = determineStartingPlayer(updatedPlayers);
  
  // Create initial game phase
  const phase: GamePhase = {
    state: 'AwaitingAction',
    currentPlayer: startingPlayer,
    turnNumber: 1,
    actionsRemaining: 1, // Starting player gets only 1 action on first turn
  };
  
  // Create initial event log
  const eventLog: EventLog = {
    events: [],
    nextEventId: 1,
  };
  
  
  const gameData: GameData = {
    gameId,
    version: '1.0.0',
    createdAt: Date.now(),
    phase,
    rng: rng.getState(),
    players: updatedPlayers,
    shared: {
      ...shared,
      supplyPiles: updatedSupplyPiles,
    },
    eventLog,
  };
  
  return gameData;
}

// Create supply piles for MVP ages (1-3) with shuffled cards
function createSupplyPiles(rng: DeterministicRng): SupplyPile[] {
  const piles: SupplyPile[] = [];
  
  for (let age = 1; age <= 3; age++) {
    const ageCards = CARDS.cardsByAge.get(age as any) || [];
    const cardIds = ageCards.map(card => card.id);
    const shuffledCards = rng.shuffle([...cardIds]);
    
    piles.push({
      age,
      cards: shuffledCards,
    });
  }
  
  return piles;
}

// Create empty player board
function createInitialPlayerBoard(): PlayerBoard {
  return {
    hands: [],
    colors: [],
    scores: [],
    normalAchievements: [],
    specialAchievements: [],
  };
}

// Perform initial setup: each player draws 2 age 1 cards, chooses 1 to meld, keeps 1
function performInitialSetup(
  players: Record<PlayerId, PlayerBoard>,
  supplyPiles: SupplyPile[],
  rng: DeterministicRng
): { updatedPlayers: Record<PlayerId, PlayerBoard>; updatedSupplyPiles: SupplyPile[] } {
  
  const age1Pile = supplyPiles.find(pile => pile.age === 1);
  if (!age1Pile || age1Pile.cards.length < 4) {
    throw new Error('Not enough Age 1 cards for initial setup');
  }
  
  let remainingAge1Cards = [...age1Pile.cards];
  const updatedPlayers: Record<PlayerId, PlayerBoard> = { 0: { ...players[0]! }, 1: { ...players[1]! } };
  
  // Each player draws 2 cards from age 1
  for (const playerId of [0, 1] as PlayerId[]) {
    const drawnCards: CardId[] = [];
    
    // Draw 2 cards
    for (let i = 0; i < 2; i++) {
      const { card, remaining } = drawCardFromPile(remainingAge1Cards, rng);
      drawnCards.push(card);
      remainingAge1Cards = remaining;
    }
    
    // For now, automatically choose the first card to meld and keep the second
    // In a real game, players would choose simultaneously
    const cardToMeld = drawnCards[0]!;
    const cardToKeep = drawnCards[1]!;
    
    const cardData = CARDS.cardsById.get(cardToMeld)!;
    
    // Meld the chosen card
    updatedPlayers[playerId] = meldCardToBoard(updatedPlayers[playerId]!, cardToMeld, cardData.color);
    
    // Keep the other card in hand
    updatedPlayers[playerId]!.hands.push(cardToKeep);
  }
  
  // Update supply pile
  const updatedSupplyPiles = supplyPiles.map(pile => 
    pile.age === 1 
      ? { ...pile, cards: remainingAge1Cards }
      : pile
  );
  
  return { updatedPlayers, updatedSupplyPiles };
}

// Draw a card from a pile
function drawCardFromPile(pile: CardId[], rng: DeterministicRng): { card: CardId; remaining: CardId[] } {
  if (pile.length === 0) throw new Error('Cannot draw from empty pile');
  
  const index = rng.nextInt(pile.length);
  const card = pile[index]!;
  const remaining = pile.filter((_, i) => i !== index);
  
  return { card, remaining };
}

// Meld a card to a player's board
function meldCardToBoard(player: PlayerBoard, cardId: CardId, color: Color): PlayerBoard {
  const existingColorStack = player.colors.find(stack => stack.color === color);
  
  if (existingColorStack) {
    // Add to existing color stack
    const updatedColors = player.colors.map(stack => 
      stack.color === color 
        ? { ...stack, cards: [...stack.cards, cardId] }
        : stack
    );
    
    return { ...player, colors: updatedColors };
  } else {
    // Create new color stack
    const newStack: PlayerColorStack = {
      color,
      cards: [cardId],
    };
    
    return { 
      ...player, 
      colors: [...player.colors, newStack] 
    };
  }
}

// Determine starting player based on alphabetically first card title
function determineStartingPlayer(players: Record<PlayerId, PlayerBoard>): PlayerId {
  const player0TopCards = getAllTopCards(players[0]!);
  const player1TopCards = getAllTopCards(players[1]!);
  
  if (player0TopCards.length === 0 || player1TopCards.length === 0) {
    return 0; // Fallback to player 0
  }
  
  const player0Card = CARDS.cardsById.get(player0TopCards[0]!)!;
  const player1Card = CARDS.cardsById.get(player1TopCards[0]!)!;
  
  // Compare card titles alphabetically
  return player0Card.title.localeCompare(player1Card.title) <= 0 ? 0 : 1;
}

// Get all top cards for a player
function getAllTopCards(player: PlayerBoard): CardId[] {
  return player.colors
    .map(stack => stack.cards[stack.cards.length - 1])
    .filter((cardId): cardId is CardId => cardId !== undefined);
}


// Utility functions for game setup validation
export function validateGameSetup(gameData: GameData): string[] {
  const errors: string[] = [];
  
  // Check that both players have exactly 1 card on board and 1 in hand after initial setup
  for (const playerId of [0, 1] as PlayerId[]) {
    const player = gameData.players[playerId]!;
    
    const totalBoardCards = player.colors.reduce((sum, stack) => sum + stack.cards.length, 0);
    if (totalBoardCards !== 1) {
      errors.push(`Player ${playerId} should have exactly 1 card on board after setup, has ${totalBoardCards}`);
    }
    
    if (player.hands.length !== 1) {
      errors.push(`Player ${playerId} should have exactly 1 card in hand after setup, has ${player.hands.length}`);
    }
  }
  
  // Check that age 1 pile has 4 fewer cards than initial
  const age1Pile = gameData.shared.supplyPiles.find(pile => pile.age === 1);
  const expectedAge1Cards = (CARDS.cardsByAge.get(1)?.length || 0) - 4;
  
  if (!age1Pile || age1Pile.cards.length !== expectedAge1Cards) {
    errors.push(`Age 1 pile should have ${expectedAge1Cards} cards after setup`);
  }
  
  return errors;
}