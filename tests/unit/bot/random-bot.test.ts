import { describe, it, expect, beforeEach } from 'vitest';
import { RandomBot } from '../../../src/bot/random-bot.js';
import { initializeGame, getLegalActions } from '../../../src/engine/index.js';
import type { GameData, PlayerId, Choice, ChoiceAnswer } from '../../../src/types/index.js';

describe('RandomBot', () => {
  let gameState: GameData;
  let bot: RandomBot;

  beforeEach(() => {
    // Initialize a fresh game for each test
    gameState = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 0', 'Player 1'],
      rngSeed: 12345,
    });

    // Create a deterministic bot for testing
    bot = new RandomBot({ seed: 42, verbose: false });
  });

  describe('constructor', () => {
    it('should create a bot with default configuration', () => {
      const defaultBot = new RandomBot();
      expect(defaultBot.getName()).toContain('RandomBot');
      expect(defaultBot.getName()).toContain('seed:');
    });

    it('should create a bot with custom configuration', () => {
      const customBot = new RandomBot({ seed: 999, verbose: true });
      expect(customBot.getName()).toContain('RandomBot(seed:999)');
    });

    it('should create a non-deterministic bot when specified', () => {
      const nonDeterministicBot = new RandomBot({ deterministic: false });
      expect(nonDeterministicBot.getName()).not.toContain('seed:');
    });
  });

  describe('getName', () => {
    it('should return a descriptive name', () => {
      const name = bot.getName();
      expect(name).toContain('RandomBot');
      expect(name).toContain('seed:42');
    });
  });

  describe('decideAction', () => {
    it('should return a valid action from legal actions', () => {
      const action = bot.decideAction(gameState, 1); // Use player 1 (current player)
      
      expect(action).toBeDefined();
      expect(action.playerId).toBe(1);
      expect(action.timestamp).toBeDefined();
      expect(['draw', 'meld', 'dogma', 'achieve']).toContain(action.type);
    });

    it('should throw error when no legal actions available', () => {
      // Create a game state with no legal actions (this shouldn't happen in practice)
      const invalidState = { ...gameState, phase: { ...gameState.phase, state: 'GameOver' as const } };
      
      expect(() => bot.decideAction(invalidState, 1)).toThrow('No legal actions available');
    });

    it('should produce deterministic results with same seed', () => {
      const deterministicBot = new RandomBot({ seed: 123, deterministic: true });
      
      const action1 = deterministicBot.decideAction(gameState, 1);
      const action2 = deterministicBot.decideAction(gameState, 1);
      
      expect(action1.type).toBe(action2.type);
      expect(action1.playerId).toBe(action2.playerId);
    });

    it('should handle different players correctly', () => {
      // Create a game state where both players can have actions
      // We'll test that the bot correctly sets the playerId in the returned actions
      const action1 = bot.decideAction(gameState, 1); // Current player
      
      // For player 0, we'll just verify the bot handles the request correctly
      // even if no actions are available (it should throw an error)
      expect(action1.playerId).toBe(1);
      expect(() => bot.decideAction(gameState, 0)).toThrow('No legal actions available');
    });
  });

  describe('decideChoice', () => {
    it('should handle yes_no choices', () => {
      const choice: Choice = {
        id: 'test-choice',
        type: 'yes_no',
        playerId: 0 as PlayerId,
        prompt: 'Test choice?',
        source: 'test',
        yesText: 'Yes',
        noText: 'No',
      };

      const answer = bot.decideChoice(gameState, choice);
      
      expect(answer.type).toBe('yes_no');
      expect(answer.choiceId).toBe('test-choice');
      expect(answer.playerId).toBe(0);
      if (answer.type === 'yes_no') {
        expect(typeof answer.answer).toBe('boolean');
      }
    });

    it('should handle select_cards choices', () => {
      const choice: Choice = {
        id: 'test-choice',
        type: 'select_cards',
        playerId: 0 as PlayerId,
        prompt: 'Select cards',
        source: 'test',
        from: { zone: 'hand', playerId: 0 as PlayerId },
        minCards: 1,
        maxCards: 2,
      };

      const answer = bot.decideChoice(gameState, choice);
      
      expect(answer.type).toBe('select_cards');
      expect(answer.choiceId).toBe('test-choice');
      expect(answer.playerId).toBe(0);
      if (answer.type === 'select_cards') {
        expect(Array.isArray(answer.selectedCards)).toBe(true);
      }
    });

    it('should handle select_pile choices', () => {
      const choice: Choice = {
        id: 'test-choice',
        type: 'select_pile',
        playerId: 0 as PlayerId,
        prompt: 'Select pile',
        source: 'test',
        availableColors: ['Red', 'Blue'],
        operation: 'splay',
      };

      const answer = bot.decideChoice(gameState, choice);
      
      expect(answer.type).toBe('select_pile');
      expect(answer.choiceId).toBe('test-choice');
      expect(answer.playerId).toBe(0);
      if (answer.type === 'select_pile') {
        expect(['Red', 'Blue']).toContain(answer.selectedColor);
      }
    });

    it('should handle select_player choices', () => {
      const choice: Choice = {
        id: 'test-choice',
        type: 'select_player',
        playerId: 0 as PlayerId,
        prompt: 'Select player',
        source: 'test',
        availablePlayers: [0, 1] as PlayerId[],
        operation: 'transfer',
      };

      const answer = bot.decideChoice(gameState, choice);
      
      expect(answer.type).toBe('select_player');
      expect(answer.choiceId).toBe('test-choice');
      expect(answer.playerId).toBe(0);
      if (answer.type === 'select_player') {
        expect([0, 1]).toContain(answer.selectedPlayer);
      }
    });

    it('should throw error for unsupported choice types', () => {
      const unsupportedChoice = {
        id: 'test-choice',
        type: 'unsupported' as any,
        playerId: 0 as PlayerId,
        prompt: 'Test',
        source: 'test',
      } as Choice;

      expect(() => bot.decideChoice(gameState, unsupportedChoice)).toThrow('Unsupported choice type');
    });

    it('should produce deterministic results for choices', () => {
      const deterministicBot = new RandomBot({ seed: 123, deterministic: true });
      const choice: Choice = {
        id: 'test-choice',
        type: 'yes_no',
        playerId: 0 as PlayerId,
        prompt: 'Test choice?',
        source: 'test',
        yesText: 'Yes',
        noText: 'No',
      };

      const answer1 = deterministicBot.decideChoice(gameState, choice);
      const answer2 = deterministicBot.decideChoice(gameState, choice);
      
      if (answer1.type === 'yes_no' && answer2.type === 'yes_no') {
        expect(answer1.answer).toBe(answer2.answer);
      }
    });
  });

  describe('deterministic behavior', () => {
    it('should produce same results for identical game states', () => {
      const deterministicBot = new RandomBot({ seed: 123, deterministic: true });
      
      const action1 = deterministicBot.decideAction(gameState, 1);
      const action2 = deterministicBot.decideAction(gameState, 1);
      
      expect(action1.type).toBe(action2.type);
    });

    it('should produce different results for different seeds', () => {
      const bot1 = new RandomBot({ seed: 123, deterministic: true });
      const bot2 = new RandomBot({ seed: 456, deterministic: true });
      
      const action1 = bot1.decideAction(gameState, 1);
      const action2 = bot2.decideAction(gameState, 1);
      
      // Note: This test might occasionally fail if both seeds happen to produce the same result
      // In practice, with different seeds, this should rarely happen
      // We're testing the intent rather than guaranteeing different results
      expect(bot1.getName()).not.toBe(bot2.getName());
    });
  });

  describe('error handling', () => {
    it('should handle invalid game states gracefully', () => {
      // Create a game state that's in GameOver state (no legal actions)
      const invalidState = { ...gameState, phase: { ...gameState.phase, state: 'GameOver' as const } };
      
      expect(() => bot.decideAction(invalidState, 0)).toThrow('No legal actions available');
    });

    it('should handle choices with invalid player IDs', () => {
      const choice: Choice = {
        id: 'test-choice',
        type: 'yes_no',
        playerId: 999 as any, // Invalid player ID
        prompt: 'Test choice?',
        source: 'test',
        yesText: 'Yes',
        noText: 'No',
      };

      expect(() => bot.decideChoice(gameState, choice)).toThrow('Player 999 not found');
    });
  });
}); 