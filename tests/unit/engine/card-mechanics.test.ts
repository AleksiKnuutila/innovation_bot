// Tests for advanced card mechanics (Phase 3b)

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { 
  exchangeCards, 
  moveCardBetweenZones, 
  doAllYouCan, 
  safeExecute,
  revealCard,
  returnCard
} from '../../../src/engine/state-manipulation.js';
import { deepClone } from '../../../src/engine/utils.js';

describe('Advanced Card Mechanics', () => {
  let gameData: ReturnType<typeof initializeGame>;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
  });

  describe('Exchange Cards', () => {
    it('should exchange cards between hand and score pile', () => {
      const testGameData = deepClone(gameData);
      
      // Set up player with cards in hand and score
      testGameData.players[0].hands = [1, 2, 3];
      testGameData.players[0].scores = [4, 5];
      
      const events: any[] = [];
      const newState = exchangeCards(testGameData, 0, [1, 2], [4], events);
      
      // Check that cards were moved correctly
      expect(newState.players[0].hands).toEqual([3, 4]); // 3 remains, 4 added
      expect(newState.players[0].scores).toEqual([5, 1, 2]); // 5 remains, 1,2 added
      
      // Check events were emitted
      expect(events.length).toBe(3); // 2 scored + 1 drew
    });

    it('should handle empty exchanges', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      testGameData.players[0].scores = [3, 4];
      
      const events: any[] = [];
      const newState = exchangeCards(testGameData, 0, [], [], events);
      
      // State should be unchanged
      expect(newState.players[0].hands).toEqual([1, 2]);
      expect(newState.players[0].scores).toEqual([3, 4]);
      expect(events.length).toBe(0);
    });

    it('should throw error for cards not in hand', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      testGameData.players[0].scores = [3];
      
      const events: any[] = [];
      expect(() => {
        exchangeCards(testGameData, 0, [99], [3], events);
      }).toThrow('Card 99 not found in player 0\'s hand');
    });

    it('should throw error for cards not in score pile', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      testGameData.players[0].scores = [3];
      
      const events: any[] = [];
      expect(() => {
        exchangeCards(testGameData, 0, [1], [99], events);
      }).toThrow('Card 99 not found in player 0\'s score pile');
    });
  });

  describe('Move Card Between Zones', () => {
    it('should move card from hand to score pile', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2, 3];
      testGameData.players[0].scores = [4];
      
      const events: any[] = [];
      const newState = moveCardBetweenZones(testGameData, 0, 2, 'hand', 'score', events);
      
      // Check that card was moved
      expect(newState.players[0].hands).toEqual([1, 3]);
      expect(newState.players[0].scores).toEqual([4, 2]);
      
      // Check event was emitted
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('transferred');
    });

    it('should move card from board to hand', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [
        { color: 'Red', cards: [1, 2], splayDirection: undefined }
      ];
      testGameData.players[0].hands = [3];
      
      const events: any[] = [];
      const newState = moveCardBetweenZones(testGameData, 0, 2, 'board', 'hand', events);
      
      // Check that card was moved
      expect(newState.players[0].colors[0].cards).toEqual([1]);
      expect(newState.players[0].hands).toEqual([3, 2]);
      
      // Check event was emitted
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('transferred');
    });

    it('should move card from score to board', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].scores = [1, 2];
      testGameData.players[0].colors = [
        { color: 'Yellow', cards: [3], splayDirection: undefined } // Yellow stack for card 1
      ];
      
      const events: any[] = [];
      const newState = moveCardBetweenZones(testGameData, 0, 1, 'score', 'board', events);
      
      // Check that card was moved
      expect(newState.players[0].scores).toEqual([2]);
      // Card 1 is Yellow, so it should be added to the Yellow stack
      expect(newState.players[0].colors[0].cards).toContain(1);
      
      // Check event was emitted
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('transferred');
    });

    it('should throw error for card not found in source zone', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      
      const events: any[] = [];
      expect(() => {
        moveCardBetweenZones(testGameData, 0, 99, 'hand', 'score', events);
      }).toThrow('Card 99 not found in 0\'s hand');
    });
  });

  describe('Do All You Can Helper', () => {
    it('should return all items that match predicate', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const result = doAllYouCan(items, (item) => item % 2 === 0);
      
      expect(result).toEqual([2, 4, 6]);
    });

    it('should respect maxItems limit', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const result = doAllYouCan(items, (item) => item % 2 === 0, 2);
      
      expect(result).toEqual([2, 4]);
    });

    it('should handle empty result', () => {
      const items = [1, 3, 5];
      const result = doAllYouCan(items, (item) => item % 2 === 0);
      
      expect(result).toEqual([]);
    });

    it('should handle empty input', () => {
      const items: number[] = [];
      const result = doAllYouCan(items, (item) => item > 0);
      
      expect(result).toEqual([]);
    });
  });

  describe('Safe Execute Helper', () => {
    it('should return result when function succeeds', () => {
      const result = safeExecute(() => 42);
      
      expect(result.result).toBe(42);
      expect(result.error).toBeNull();
    });

    it('should return error when function fails', () => {
      const result = safeExecute(() => {
        throw new Error('Test error');
      });
      
      expect(result.result).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Test error');
    });

    it('should handle functions that return null', () => {
      const result = safeExecute(() => null);
      
      expect(result.result).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('Reveal Card', () => {
    it('should reveal card without removing it from hand', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2, 3];
      
      const events: any[] = [];
      const newState = revealCard(testGameData, 0, 2, events);
      
      // Card should still be in hand
      expect(newState.players[0].hands).toEqual([1, 2, 3]);
      
      // Event should be emitted
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('card_revealed');
    });

    it('should throw error for card not in hand', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      
      const events: any[] = [];
      expect(() => {
        revealCard(testGameData, 0, 99, events);
      }).toThrow('Card 99 not found in player 0\'s hand');
    });
  });

  describe('Return Card', () => {
    it('should return card from hand to supply pile', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2, 3];
      
      const events: any[] = [];
      const newState = returnCard(testGameData, 0, 2, 1, events);
      
      // Card should be removed from hand
      expect(newState.players[0].hands).toEqual([1, 3]);
      
      // Card should be added to supply pile
      const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === 1);
      expect(supplyPile?.cards).toContain(2);
      
      // Event should be emitted
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('returned');
    });

    it('should throw error for card not in hand', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      
      const events: any[] = [];
      expect(() => {
        returnCard(testGameData, 0, 99, 1, events);
      }).toThrow('Card 99 not found in player 0\'s hand');
    });

    it('should throw error for non-existent supply pile', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].hands = [1, 2];
      
      const events: any[] = [];
      expect(() => {
        returnCard(testGameData, 0, 1, 99, events);
      }).toThrow('Supply pile for age 99 not found');
    });
  });
}); 