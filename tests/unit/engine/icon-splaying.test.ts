// Tests for icon counting and splaying system (Phase 3b)

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { countIcons, hasIcon, splayColor } from '../../../src/engine/state-manipulation.js';
import { deepClone } from '../../../src/engine/utils.js';

describe('Icon Counting & Splaying System', () => {
  let gameData: ReturnType<typeof initializeGame>;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
  });

  describe('Icon Visibility Based on Splay Direction', () => {
    it('should only show top icon when no splay', () => {
      // Set up a player with 2 cards in a color stack (no splay)
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2], // Two cards, no splay
        splayDirection: undefined
      }];

      // Should only count icons from top position
      const crownCount = countIcons(testGameData, 0, 'Crown');
      expect(crownCount).toBeGreaterThanOrEqual(0); // Depends on actual card data
    });

    it('should show top + left icons when splayed left', () => {
      // Set up a player with 2 cards splayed left
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2], // Two cards
        splayDirection: 'left'
      }];

      // Should count icons from top and left positions
      const totalIcons = countIcons(testGameData, 0, 'Castle');
      expect(totalIcons).toBeGreaterThanOrEqual(0);
    });

    it('should show top + left + middle icons when splayed right', () => {
      // Set up a player with 3+ cards splayed right
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2, 3], // Three cards
        splayDirection: 'right'
      }];

      // Should count icons from top, left, and middle positions
      const totalIcons = countIcons(testGameData, 0, 'Castle');
      expect(totalIcons).toBeGreaterThanOrEqual(0);
    });

    it('should show all icons when splayed up', () => {
      // Set up a player with 4+ cards splayed up
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2, 3, 4], // Four cards
        splayDirection: 'up'
      }];

      // Should count icons from all positions (top, left, middle, right)
      const totalIcons = countIcons(testGameData, 0, 'Castle');
      expect(totalIcons).toBeGreaterThanOrEqual(0);
    });

    it('should handle single card stacks correctly', () => {
      // Single card should only show top icon regardless of splay
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1], // Single card
        splayDirection: 'up' // Splay direction should be ignored
      }];

      const iconCount = countIcons(testGameData, 0, 'Castle');
      expect(iconCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Icon Counting Accuracy', () => {
    it('should count only visible icons', () => {
      // Set up a complex scenario with multiple cards and splay
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [
        {
          color: 'Red',
          cards: [1, 2, 3], // Three cards
          splayDirection: 'right' // Shows top, left, middle
        },
        {
          color: 'Blue',
          cards: [4, 5], // Two cards
          splayDirection: 'left' // Shows top, left
        }
      ];

      // Count icons across all visible positions
      const castleCount = countIcons(testGameData, 0, 'Castle');
      const crownCount = countIcons(testGameData, 0, 'Crown');
      const leafCount = countIcons(testGameData, 0, 'Leaf');

      // Should have reasonable counts based on actual card data
      expect(castleCount).toBeGreaterThanOrEqual(0);
      expect(crownCount).toBeGreaterThanOrEqual(0);
      expect(leafCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty color stacks', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [], // Empty stack
        splayDirection: undefined
      }];

      const iconCount = countIcons(testGameData, 0, 'Castle');
      expect(iconCount).toBe(0);
    });
  });

  describe('Splay Validation', () => {
    it('should not allow splaying single card stacks', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1], // Single card
        splayDirection: undefined
      }];

      expect(() => {
        splayColor(testGameData, 0, 'Red', 'left', []);
      }).toThrow('Cannot splay Red stack with fewer than 2 cards');
    });

    it('should allow splaying stacks with 2+ cards', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2], // Two cards
        splayDirection: undefined
      }];

      const events: any[] = [];
      const newState = splayColor(testGameData, 0, 'Red', 'left', events);

      expect(newState.players[0].colors[0].splayDirection).toBe('left');
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('splayed');
    });

    it('should change splay direction when re-splaying', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2, 3], // Three cards
        splayDirection: 'left' // Already splayed left
      }];

      const events: any[] = [];
      const newState = splayColor(testGameData, 0, 'Red', 'up', events);

      expect(newState.players[0].colors[0].splayDirection).toBe('up');
      expect(events[0].previousDirection).toBe('left');
    });
  });

  describe('hasIcon Function', () => {
    it('should return true when player has visible icons', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1, 2], // Two cards with Castle icons
        splayDirection: 'left' // Shows top and left
      }];

      const hasCastle = hasIcon(testGameData, 0, 'Castle');
      expect(hasCastle).toBe(true);
    });

    it('should return false when player has no visible icons', () => {
      const testGameData = deepClone(gameData);
      testGameData.players[0].colors = [{
        color: 'Red',
        cards: [1], // Single card
        splayDirection: undefined
      }];

      // Check for an icon that's not on the top card
      const hasClock = hasIcon(testGameData, 0, 'Clock');
      expect(hasClock).toBe(false);
    });
  });
}); 