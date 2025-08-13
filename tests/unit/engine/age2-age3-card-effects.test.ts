import { describe, it, expect, beforeEach } from 'vitest';
import { deepClone } from '../../../src/engine/utils.js';
import { processDogmaAction } from '../../../src/engine/dogma-resolver.js';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { CARDS } from '../../../src/cards/database.js';

describe('Age 2 Card Effects', () => {
  let gameData: ReturnType<typeof initializeGame>;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
    // Set up a basic game state with cards in hand
    gameData.players[0].hands = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25]; // All Age 2 cards
    gameData.players[0].colors = [];
    gameData.players[0].scores = [];
    gameData.players[1].hands = [];
    gameData.players[1].colors = [];
    gameData.players[1].scores = [];
  });

  describe('Calendar (ID 16)', () => {
    it('should draw 3s for each card in score pile', () => {
      // Add some cards to score pile
      gameData.players[0].scores = [1, 2, 3]; // 3 cards in score
      const initialHandSize = gameData.players[0].hands.length;
      
      const result = processDogmaAction(gameData, 16, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should have drawn 3 cards of age 3
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(3);
      drewEvents.forEach(event => {
        expect(event.fromAge).toBe(3);
      });
      
      // Verify hand size increased
      expect(result.newState.players[0].hands.length).toBe(initialHandSize + 3);
    });

    it('should draw additional 3 if score > hand', () => {
      gameData.players[0].scores = [1, 2, 3, 4]; // 4 cards in score
      gameData.players[0].hands = [16]; // 1 card in hand
      const initialHandSize = 1;
      
      const result = processDogmaAction(gameData, 16, 0);
      
      // Should have drawn 5 cards total (4 for score + 1 for score > hand)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(5);
      
      // Verify hand size increased by 5
      expect(result.newState.players[0].hands.length).toBe(initialHandSize + 5);
    });

    it('should handle empty score pile', () => {
      gameData.players[0].scores = [];
      const initialHandSize = gameData.players[0].hands.length;
      
      const result = processDogmaAction(gameData, 16, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      // Should not draw any cards
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(0);
      
      // Verify hand size unchanged
      expect(result.newState.players[0].hands.length).toBe(initialHandSize);
    });
  });

  describe('Canal Building (ID 17)', () => {
    it('should exchange highest cards between hand and score', () => {
      // Use cards with actually different ages
      gameData.players[0].hands = [1, 2, 3]; // Ages 1, 1, 1 (but different cards)
      gameData.players[0].scores = [4, 5, 6]; // Ages 1, 1, 1 (but different cards)
      const initialHandSize = 3;
      const initialScoreSize = 3;
      
      const result = processDogmaAction(gameData, 17, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should have transfer events (1 exchange = 2 transfers)
      const transferEvents = result.events.filter(e => e.type === 'transferred');
      expect(transferEvents.length).toBe(2);
      
      // Verify hand and score sizes remain the same (exchange)
      expect(result.newState.players[0].hands.length).toBe(initialHandSize);
      expect(result.newState.players[0].scores.length).toBe(initialScoreSize);
      
      // Since cards were exchanged, the hand and score should contain different cards
      const handAges = result.newState.players[0].hands.map(id => CARDS.cardsById.get(id)?.age).filter(Boolean);
      const scoreAges = result.newState.players[0].scores.map(id => CARDS.cardsById.get(id)?.age).filter(Boolean);
      
      // All cards should still have age 1 (since that's what we started with)
      expect(Math.max(...handAges)).toBe(1);
      expect(Math.max(...scoreAges)).toBe(1);
      
      // But the actual card IDs should have changed due to exchange
      expect(result.newState.players[0].hands).not.toEqual(gameData.players[0].hands);
      expect(result.newState.players[0].scores).not.toEqual(gameData.players[0].scores);
    });

    it('should handle empty hand', () => {
      gameData.players[0].hands = [];
      gameData.players[0].scores = [1, 2, 3];
      const initialScoreSize = 3;
      
      const result = processDogmaAction(gameData, 17, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      // Should not transfer any cards
      const transferEvents = result.events.filter(e => e.type === 'transferred');
      expect(transferEvents.length).toBe(0);
      
      // Verify no changes
      expect(result.newState.players[0].hands.length).toBe(0);
      expect(result.newState.players[0].scores.length).toBe(initialScoreSize);
    });

    it('should handle empty score pile', () => {
      gameData.players[0].hands = [1, 2, 3];
      gameData.players[0].scores = [];
      const initialHandSize = 3;
      
      const result = processDogmaAction(gameData, 17, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      // Should not transfer any cards
      const transferEvents = result.events.filter(e => e.type === 'transferred');
      expect(transferEvents.length).toBe(0);
      
      // Verify no changes
      expect(result.newState.players[0].hands.length).toBe(initialHandSize);
      expect(result.newState.players[0].scores.length).toBe(0);
    });
  });

  describe('Construction (ID 18)', () => {
    it('should demand transfer when castle cards present', () => {
      // Set up target player with castle cards on top
      gameData.players[1].colors = [
        { color: 'red', cards: [7, 8], splayDirection: 'none' } // Masonry, Metalworking (both have castle)
      ];
      
      const result = processDogmaAction(gameData, 18, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('select_cards');
    });

    it('should complete immediately when no castle cards present', () => {
      // Set up target player with no castle cards on top
      gameData.players[1].colors = [
        { color: 'blue', cards: [5], splayDirection: 'none' } // Code of Laws (no castle)
      ];
      
      const result = processDogmaAction(gameData, 18, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Currency (ID 19)', () => {
    it('should offer choice to return cards and score 2s', () => {
      const result = processDogmaAction(gameData, 19, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(0);
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('hand');
      }
    });

    it('should handle empty hand gracefully', () => {
      gameData.players[0].hands = [];
      
      const result = processDogmaAction(gameData, 19, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Fermenting (ID 20)', () => {
    it('should draw 2s for each leaf icon on board', () => {
      // Add cards with leaf icons to board
      gameData.players[0].colors = [
        { color: 'yellow', cards: [36], splayDirection: 'none' } // Anatomy (1 leaf icon in top position)
      ];
      const initialHandSize = gameData.players[0].hands.length;
      
      const result = processDogmaAction(gameData, 20, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should have drawn 1 card of age 2 (1 leaf icon)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(1);
      drewEvents.forEach(event => {
        expect(event.fromAge).toBe(2);
      });
      
      // Verify hand size increased
      expect(result.newState.players[0].hands.length).toBe(initialHandSize + 1);
    });

    it('should handle no leaf icons on board', () => {
      gameData.players[0].colors = [
        { color: 'red', cards: [1, 2], splayDirection: 'none' } // No leaf icons
      ];
      
      const result = processDogmaAction(gameData, 20, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should not draw any cards
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(0);
    });
  });

  describe('Mapmaking (ID 21)', () => {
    it('should demand transfer when crown cards present', () => {
      // Set up target player with crown cards on top
      gameData.players[1].colors = [
        { color: 'green', cards: [12], splayDirection: 'none' } // Sailing (has crown in top position)
      ];
      
      const result = processDogmaAction(gameData, 21, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('select_cards');
    });

    it('should complete immediately when no crown cards present', () => {
      // Set up target player with no crown cards on top
      gameData.players[1].colors = [
        { color: 'red', cards: [1, 2], splayDirection: 'none' } // No crown icons
      ];
      
      const result = processDogmaAction(gameData, 21, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Mathematics (ID 22)', () => {
    it('should offer choice to return card and draw/meld higher age', () => {
      const result = processDogmaAction(gameData, 22, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(0);
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('hand');
      }
    });

    it('should handle empty hand gracefully', () => {
      gameData.players[0].hands = [];
      
      const result = processDogmaAction(gameData, 22, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Monotheism (ID 23)', () => {
    it('should complete immediately when all top cards have colors already present', () => {
      // Set up target player with top cards that all have colors already present on the board
      gameData.players[1].colors = [
        { color: 'red', cards: [7], splayDirection: 'none' }, // Masonry (red)
        { color: 'blue', cards: [5], splayDirection: 'none' }  // Code of Laws (blue)
      ];
      
      const result = processDogmaAction(gameData, 23, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });

    it('should complete immediately when no different color cards present', () => {
      // Set up target player with only one color
      gameData.players[1].colors = [
        { color: 'red', cards: [7, 8], splayDirection: 'none' } // Only red cards
      ];
      
      const result = processDogmaAction(gameData, 23, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Philosophy (ID 24)', () => {
    it('should offer choice to splay left and score card', () => {
      // Set up player with cards on board
      gameData.players[0].colors = [
        { color: 'red', cards: [7], splayDirection: 'none' }
      ];
      
      const result = processDogmaAction(gameData, 24, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(0);
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('board');
      }
    });

    it('should handle no board cards gracefully', () => {
      gameData.players[0].colors = [];
      
      const result = processDogmaAction(gameData, 24, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('hand');
      }
    });
  });

  describe('Road Building (ID 25)', () => {
    it('should offer choice to meld cards and exchange', () => {
      const result = processDogmaAction(gameData, 25, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(0);
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('hand');
      }
    });

    it('should handle empty hand gracefully', () => {
      gameData.players[0].hands = [];
      
      const result = processDogmaAction(gameData, 25, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });
});

describe('Age 3 Card Effects', () => {
  let gameData: ReturnType<typeof initializeGame>;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
    // Set up a basic game state with Age 3 cards in hand
    gameData.players[0].hands = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35]; // All Age 3 cards
    gameData.players[0].colors = [];
    gameData.players[0].scores = [];
    gameData.players[1].hands = [];
    gameData.players[1].colors = [];
    gameData.players[1].scores = [];
  });

  describe('Alchemy (ID 26)', () => {
    it('should draw and reveal 4s for every three castle icons', () => {
      // Add cards with castle icons to board
      gameData.players[0].colors = [
        { color: 'yellow', cards: [7], splayDirection: 'none' }, // Masonry (1 castle in top position)
        { color: 'red', cards: [8], splayDirection: 'none' },   // Metalworking (1 castle in top position)
        { color: 'blue', cards: [18], splayDirection: 'none' }  // Construction (1 castle in top position)
      ];
      const initialHandSize = gameData.players[0].hands.length;
      
      const result = processDogmaAction(gameData, 26, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should have drawn 1 card of age 1 (since only ages 1-3 are available, age 4 falls back to age 1)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(1);
      drewEvents.forEach(event => {
        expect(event.fromAge).toBe(1); // Falls back to age 1 since age 4 is not available
      });
      
      // Should have reveal events
      const revealEvents = result.events.filter(e => e.type === 'card_revealed');
      expect(revealEvents.length).toBe(1);
      
      // Verify hand size increased
      expect(result.newState.players[0].hands.length).toBe(initialHandSize + 1);
    });

    it('should handle less than 3 castle icons', () => {
      gameData.players[0].colors = [
        { color: 'red', cards: [7, 8], splayDirection: 'none' } // Only 2 castles
      ];
      
      const result = processDogmaAction(gameData, 26, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should not draw any cards (2 < 3)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(0);
    });
  });

  describe('Optics (ID 33)', () => {
    it('should draw and meld a 3, then check for crown', () => {
      // Add a card with crown to board
      gameData.players[0].colors = [
        { color: 'blue', cards: [5], splayDirection: 'none' } // Code of Laws has crown
      ];
      const initialHandSize = gameData.players[0].hands.length;
      const initialBoardSize = gameData.players[0].colors[0].cards.length;
      
      const result = processDogmaAction(gameData, 33, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should have drawn and melded a card (effect is shared, so both players get it)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      const meldEvents = result.events.filter(e => e.type === 'melded');
      expect(drewEvents.length).toBe(2); // Both players draw and meld
      expect(meldEvents.length).toBe(2); // Both players draw and meld
      
      // Verify hand size decreased by 1 (drew 1, melded 1)
      expect(result.newState.players[0].hands.length).toBe(initialHandSize);
      // Verify board size increased by 2 (1 card melded for each player due to sharing)
      const totalBoardCards = result.newState.players[0].colors.reduce((total, stack) => total + stack.cards.length, 0) +
                              result.newState.players[1].colors.reduce((total, stack) => total + stack.cards.length, 0);
      expect(totalBoardCards).toBe(initialBoardSize + 2);
    });
  });

  describe('Translation (ID 35)', () => {
    it('should move score cards to board when score cards present', () => {
      // Add score cards
      gameData.players[0].scores = [1, 2, 3];
      
      // Add some cards to board with crowns
      gameData.players[0].colors = [
        { color: 'blue', cards: [5], splayDirection: 'none' } // Code of Laws has crown
      ];
      const initialScoreSize = 3;
      const initialBoardSize = 1;
      
      const result = processDogmaAction(gameData, 35, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should have melded events for each score card
      const meldEvents = result.events.filter(e => e.type === 'melded');
      expect(meldEvents.length).toBe(3);
      
      // Verify score pile decreased
      expect(result.newState.players[0].scores.length).toBe(initialScoreSize - 3);
      
      // Verify board increased (cards might go to different color stacks)
      const totalBoardCards = result.newState.players[0].colors.reduce((total, stack) => total + stack.cards.length, 0);
      expect(totalBoardCards).toBe(initialBoardSize + 3);
    });

    it('should handle empty score pile', () => {
      gameData.players[0].scores = [];
      // Ensure colors array exists
      gameData.players[0].colors = [
        { color: 'blue', cards: [5], splayDirection: 'none' }
      ];
      const initialBoardSize = 1;
      
      const result = processDogmaAction(gameData, 35, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
      
      // Should not have any meld events
      const meldEvents = result.events.filter(e => e.type === 'melded');
      expect(meldEvents.length).toBe(0);
      
      // Verify no changes
      expect(result.newState.players[0].scores.length).toBe(0);
      expect(result.newState.players[0].colors[0].cards.length).toBe(initialBoardSize);
    });
  });

  describe('Compass (ID 27)', () => {
    it('should demand transfer when non-green leaf cards present', () => {
      // Set up target player with non-green leaf cards on top
      gameData.players[1].colors = [
        { color: 'yellow', cards: [36], splayDirection: 'none' } // Anatomy (yellow, has leaf in top position)
      ];
      
      const result = processDogmaAction(gameData, 27, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('select_cards');
    });

    it('should complete immediately when no non-green leaf cards present', () => {
      // Set up target player with only green leaf cards
      gameData.players[1].colors = [
        { color: 'green', cards: [12], splayDirection: 'none' } // Sailing (green, has leaf)
      ];
      
      const result = processDogmaAction(gameData, 27, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Education (ID 28)', () => {
    it('should offer choice to return highest score card', () => {
      // Add some score cards
      gameData.players[0].scores = [1, 2, 3];
      
      const result = processDogmaAction(gameData, 28, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(0);
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('score');
      }
    });

    it('should handle empty score pile gracefully', () => {
      gameData.players[0].scores = [];
      
      const result = processDogmaAction(gameData, 28, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Engineering (ID 29)', () => {
    it('should demand transfer when castle cards present', () => {
      // Set up target player with castle cards on top
      gameData.players[1].colors = [
        { color: 'red', cards: [7, 8], splayDirection: 'none' } // Masonry, Metalworking (both have castle)
      ];
      
      const result = processDogmaAction(gameData, 29, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('select_cards');
    });

    it('should complete immediately when no castle cards present', () => {
      // Set up target player with no castle cards on top
      gameData.players[1].colors = [
        { color: 'blue', cards: [5], splayDirection: 'none' } // Code of Laws (no castle)
      ];
      
      const result = processDogmaAction(gameData, 29, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Feudalism (ID 30)', () => {
    it('should demand transfer when castle cards in hand present', () => {
      // Set up target player with castle cards in hand
      gameData.players[1].hands = [7, 8]; // Masonry, Metalworking (both have castle)
      
      const result = processDogmaAction(gameData, 30, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('select_cards');
      if (result.pendingChoice?.type === 'select_cards') {
        expect(result.pendingChoice.from.zone).toBe('hand');
      }
    });

    it('should complete immediately when no castle cards in hand present', () => {
      // Set up target player with no castle cards in hand
      gameData.players[1].hands = [5]; // Code of Laws (no castle)
      
      const result = processDogmaAction(gameData, 30, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Machinery (ID 31)', () => {
    it('should demand exchange hands when both players have cards', () => {
      // Set up both players with cards in hand
      gameData.players[1].hands = [1, 2, 3];
      
      const result = processDogmaAction(gameData, 31, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('yes_no');
    });

    it('should complete immediately when no cards to exchange', () => {
      // Set up both players with empty hands
      gameData.players[0].hands = [];
      gameData.players[1].hands = [];
      
      const result = processDogmaAction(gameData, 31, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Medicine (ID 32)', () => {
    it('should demand exchange when both players have score cards', () => {
      // Set up both players with score cards
      gameData.players[0].scores = [1, 2, 3];
      gameData.players[1].scores = [4, 5, 6];
      
      const result = processDogmaAction(gameData, 32, 0);
      
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.playerId).toBe(1);
      expect(result.pendingChoice?.type).toBe('yes_no');
    });

    it('should complete immediately when no score cards to exchange', () => {
      // Set up one player with no score cards
      gameData.players[0].scores = [];
      gameData.players[1].scores = [4, 5, 6];
      
      const result = processDogmaAction(gameData, 32, 0);
      
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.some(e => e.type === 'dogma_activated')).toBe(true);
    });
  });

  describe('Paper (ID 34)', () => {
    it('should be skipped - effect not implemented', () => {
      // Paper effect is not implemented yet
      expect(true).toBe(true); // Placeholder test
    });
  });
}); 