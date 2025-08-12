// Tests for turn-based action tracking (Phase 3b)

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { scoreCard, tuckCard } from '../../../src/engine/state-manipulation.js';
import { checkSpecialAchievements } from '../../../src/engine/achievements.js';
import { deepClone } from '../../../src/engine/utils.js';

describe('Turn-Based Action Tracking', () => {
  let gameData: ReturnType<typeof initializeGame>;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
  });

  describe('Monument Achievement Tracking', () => {
    it('should track scored cards for Monument achievement', () => {
      const testGameData = deepClone(gameData);
      
      // Set up player with cards in hand
      testGameData.players[0].hands = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      // Player 0 scores 6 cards in one turn
      const events: any[] = [];
      let currentState = testGameData;
      
      for (let i = 0; i < 6; i++) {
        currentState = scoreCard(currentState, 0, i + 1, events);
      }
      
      // Check that turn actions are tracked
      expect(currentState.turnActions?.[0]?.cardsScored).toHaveLength(6);
      expect(currentState.turnActions?.[0]?.cardsTucked).toHaveLength(0);
      
      // Check that Monument achievement is now available
      const achievements = checkSpecialAchievements(currentState, 0);
      expect(achievements).toContain('Monument');
    });

    it('should track tucked cards for Monument achievement', () => {
      const testGameData = deepClone(gameData);
      
      // Set up player with cards in hand and multiple color stacks
      testGameData.players[0].hands = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      testGameData.players[0].colors = [
        { color: 'Red', cards: [1], splayDirection: undefined },
        { color: 'Blue', cards: [2], splayDirection: undefined },
        { color: 'Green', cards: [3], splayDirection: undefined },
        { color: 'Yellow', cards: [4], splayDirection: undefined },
        { color: 'Purple', cards: [5], splayDirection: undefined }
      ];
      
      // Player 0 tucks 6 cards in one turn
      const events: any[] = [];
      let currentState = testGameData;
      
      for (let i = 0; i < 6; i++) {
        const color = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Red'][i];
        currentState = tuckCard(currentState, 0, i + 10, color as any, events);
      }
      
      // Check that turn actions are tracked
      expect(currentState.turnActions?.[0]?.cardsScored).toHaveLength(0);
      expect(currentState.turnActions?.[0]?.cardsTucked).toHaveLength(6);
      
      // Check that Monument achievement is now available
      const achievements = checkSpecialAchievements(currentState, 0);
      expect(achievements).toContain('Monument');
    });

    it('should track combination of scored and tucked cards', () => {
      const testGameData = deepClone(gameData);
      
      // Set up player with cards in hand and a color stack
      testGameData.players[0].hands = [1, 2, 3, 10, 11, 12, 13, 14, 15, 16];
      testGameData.players[0].colors = [
        { color: 'Red', cards: [1], splayDirection: undefined }
      ];
      
      const events: any[] = [];
      let currentState = testGameData;
      
      // Score 3 cards
      for (let i = 0; i < 3; i++) {
        currentState = scoreCard(currentState, 0, i + 1, events);
      }
      
      // Tuck 3 cards
      for (let i = 0; i < 3; i++) {
        currentState = tuckCard(currentState, 0, i + 10, 'Red', events);
      }
      
      // Check that turn actions are tracked
      expect(currentState.turnActions?.[0]?.cardsScored).toHaveLength(3);
      expect(currentState.turnActions?.[0]?.cardsTucked).toHaveLength(3);
      
      // Check that Monument achievement is now available (total 6)
      const achievements = checkSpecialAchievements(currentState, 0);
      expect(achievements).toContain('Monument');
    });

    it('should not track actions across different players', () => {
      const testGameData = deepClone(gameData);
      
      // Set up both players with cards in hand
      testGameData.players[0].hands = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      testGameData.players[1].hands = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
      
      // Player 0 scores 3 cards
      const events: any[] = [];
      let currentState = testGameData;
      
      for (let i = 0; i < 3; i++) {
        currentState = scoreCard(currentState, 0, i + 1, events);
      }
      
      // Player 1 scores 3 cards
      for (let i = 0; i < 3; i++) {
        currentState = scoreCard(currentState, 1, i + 20, events);
      }
      
      // Check that each player has their own tracking
      expect(currentState.turnActions?.[0]?.cardsScored).toHaveLength(3);
      expect(currentState.turnActions?.[1]?.cardsScored).toHaveLength(3);
      
      // Neither player should qualify for Monument (need 6 each)
      const achievements0 = checkSpecialAchievements(currentState, 0);
      const achievements1 = checkSpecialAchievements(currentState, 1);
      expect(achievements0).not.toContain('Monument');
      expect(achievements1).not.toContain('Monument');
    });
  });

  describe('Turn Action Persistence', () => {
    it('should maintain turn actions during dogma effects', () => {
      const testGameData = deepClone(gameData);
      
      // Set up player with cards in hand
      testGameData.players[0].hands = [1, 2, 3, 4, 10, 11, 12, 13, 14, 15];
      
      // Player scores 4 cards
      const events: any[] = [];
      let currentState = testGameData;
      
      for (let i = 0; i < 4; i++) {
        currentState = scoreCard(currentState, 0, i + 1, events);
      }
      
      // Verify tracking is working
      expect(currentState.turnActions?.[0]?.cardsScored).toHaveLength(4);
      
      // Simulate some dogma effects that modify state
      // (In real usage, these would be called by card effects)
      currentState = scoreCard(currentState, 0, 10, events);
      currentState = scoreCard(currentState, 0, 11, events);
      
      // Should now have 6 total scored cards
      expect(currentState.turnActions?.[0]?.cardsScored).toHaveLength(6);
      
      // Monument achievement should now be available
      const achievements = checkSpecialAchievements(currentState, 0);
      expect(achievements).toContain('Monument');
    });
  });
}); 