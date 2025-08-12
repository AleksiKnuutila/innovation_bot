// Error handling tests - testing edge cases, invalid inputs, and recovery scenarios
import { describe, it, expect } from 'vitest';
import { initializeGame } from '@/engine/game-setup.js';
import { processAction, processChoice } from '@/engine/state-machine.js';
import { serializeGame, deserializeGame } from '@/engine/serializer.js';
import { validateGameData } from '@/types/game-data.js';

describe('Error Handling', () => {
  const createTestGame = () => initializeGame({
    gameId: 'error-test',
    rngSeed: 12345,
    playerNames: ['Alice', 'Bob']
  });

  describe('Invalid actions', () => {
    it('should reject actions from wrong player', () => {
      const gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      const wrongPlayer = currentPlayer === 0 ? 1 : 0;
      
      expect(() => processAction(gameState, { 
        type: 'draw', 
        playerId: wrongPlayer 
      })).toThrow('Not your turn');
    });

    it('should reject actions in wrong game phase', () => {
      let gameState = createTestGame();
      
      // Force game into wrong phase for testing
      gameState = {
        ...gameState,
        phase: {
          ...gameState.phase,
          state: 'GameOver'
        }
      };
      
      expect(() => processAction(gameState, { 
        type: 'draw', 
        playerId: gameState.phase.currentPlayer 
      })).toThrow('Not awaiting action');
    });

    it('should reject meld action with invalid card', () => {
      const gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      
      expect(() => processAction(gameState, {
        type: 'meld',
        playerId: currentPlayer,
        cardId: 99999 // Non-existent card
      })).toThrow('Card not in hand');
    });

    it('should reject meld action with card not in hand', () => {
      const gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      
      // Find a card not in current player's hand
      const allCards = Array.from({ length: 50 }, (_, i) => i + 1);
      const playerHand = gameState.players[currentPlayer]?.hands || [];
      const cardNotInHand = allCards.find(id => !playerHand.includes(id));
      
      if (cardNotInHand) {
        expect(() => processAction(gameState, {
          type: 'meld',
          playerId: currentPlayer,
          cardId: cardNotInHand
        })).toThrow();
      }
    });
  });

  describe('Invalid choices', () => {
    it('should reject choice when not awaiting choice', () => {
      const gameState = createTestGame();
      
      expect(() => processChoice(gameState, {
        choiceId: 'test-choice',
        playerId: 0,
        type: 'yes_no',
        answer: true
      })).toThrow('Game is not awaiting a choice');
    });

    it('should reject choice with wrong choice ID', () => {
      let gameState = createTestGame();
      
      // Force game into AwaitingChoice state with a pending choice
      gameState = {
        ...gameState,
        phase: {
          ...gameState.phase,
          state: 'AwaitingChoice'
        },
        pendingChoice: {
          id: 'correct-choice-id',
          playerId: 0,
          type: 'yes_no',
          prompt: 'Test choice',
          source: 'test',
          yesText: 'Yes',
          noText: 'No'
        }
      };
      
      expect(() => processChoice(gameState, {
        choiceId: 'wrong-choice-id',
        playerId: 0,
        type: 'yes_no', 
        answer: true
      })).toThrow('Choice answer does not match pending choice');
    });

    it('should reject choice from wrong player', () => {
      let gameState = createTestGame();
      
      // Force game into AwaitingChoice state
      gameState = {
        ...gameState,
        phase: {
          ...gameState.phase,
          state: 'AwaitingChoice'
        },
        pendingChoice: {
          id: 'test-choice',
          playerId: 0,
          type: 'yes_no',
          prompt: 'Test choice',
          source: 'test',
          yesText: 'Yes',
          noText: 'No'
        }
      };
      
      expect(() => processChoice(gameState, {
        choiceId: 'test-choice',
        playerId: 1, // Wrong player
        type: 'yes_no',
        answer: true
      })).toThrow('Choice answer from wrong player');
    });
  });

  describe('Game state validation', () => {
    it('should detect missing required fields', () => {
      const invalidGame = {
        gameId: 'test',
        version: '1.0.0',
        // missing required fields
      } as any;
      
      const errors = validateGameData(invalidGame);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid player data', () => {
      const gameState = createTestGame();
      const invalidGame = {
        ...gameState,
        players: null // Invalid players
      };
      
      const errors = validateGameData(invalidGame as any);
      expect(errors).toContain('Players data missing');
    });

    it('should detect phase/choice inconsistencies', () => {
      const gameState = createTestGame();
      
      // Game state says AwaitingChoice but no pending choice
      const invalidGame1 = {
        ...gameState,
        phase: {
          ...gameState.phase,
          state: 'AwaitingChoice' as const
        },
        pendingChoice: undefined
      };
      
      const errors1 = validateGameData(invalidGame1);
      expect(errors1.some(e => e.includes('AwaitingChoice but no pendingChoice'))).toBe(true);
      
      // Game state has pending choice but wrong state
      const invalidGame2 = {
        ...gameState,
        phase: {
          ...gameState.phase,
          state: 'AwaitingAction' as const
        },
        pendingChoice: {
          id: 'test',
          playerId: 0,
          type: 'yes_no' as const,
          prompt: 'Test',
          source: 'test',
          yesText: 'Yes',
          noText: 'No'
        }
      };
      
      const errors2 = validateGameData(invalidGame2);
      expect(errors2.some(e => e.includes('pendingChoice is set but game state is not AwaitingChoice'))).toBe(true);
    });
  });

  describe('Serialization errors', () => {
    it('should handle corrupted serialized data', () => {
      const gameState = createTestGame();
      const serialized = serializeGame(gameState);
      
      // Corrupt the checksum
      const corrupted = {
        ...serialized,
        checksum: serialized.checksum + 1
      };
      
      expect(() => deserializeGame(corrupted))
        .toThrow('corrupted (checksum mismatch)');
    });

    it('should handle invalid JSON in serialized data', () => {
      const invalidSerialized = {
        version: '1.0.0',
        timestamp: Date.now(),
        data: '{ "invalid": json }',
        checksum: 12345
      };
      
      expect(() => deserializeGame(invalidSerialized))
        .toThrow('corrupted');
    });
  });

  describe('Resource exhaustion', () => {
    it('should handle empty supply piles gracefully', () => {
      let gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      
      // Empty all supply piles
      gameState = {
        ...gameState,
        shared: {
          ...gameState.shared,
          supplyPiles: gameState.shared.supplyPiles.map(pile => ({
            ...pile,
            cards: []
          }))
        }
      };
      
      expect(() => processAction(gameState, { 
        type: 'draw', 
        playerId: currentPlayer 
      })).toThrow('No cards available to draw');
    });

    it('should handle players with empty hands', () => {
      let gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      
      // Empty current player's hand
      gameState = {
        ...gameState,
        players: {
          ...gameState.players,
          [currentPlayer]: {
            ...gameState.players[currentPlayer]!,
            hands: []
          }
        }
      };
      
      // Should be able to draw (to get cards)
      expect(() => processAction(gameState, { 
        type: 'draw', 
        playerId: currentPlayer 
      })).not.toThrow();
      
      // Should not be able to meld (no cards in hand)
      expect(() => processAction(gameState, {
        type: 'meld',
        playerId: currentPlayer,
        cardId: 1
      })).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle maximum turn numbers', () => {
      let gameState = createTestGame();
      
      // Set very high turn number
      gameState = {
        ...gameState,
        phase: {
          ...gameState.phase,
          turnNumber: 9999
        }
      };
      
      // Should still validate
      const errors = validateGameData(gameState);
      expect(errors).toEqual([]);
    });

    it('should handle RNG state edge cases', () => {
      let gameState = createTestGame();
      
      // Set RNG counter to maximum safe integer
      gameState = {
        ...gameState,
        rng: {
          ...gameState.rng,
          counter: Number.MAX_SAFE_INTEGER
        }
      };
      
      // Should still be serializable
      expect(() => serializeGame(gameState)).not.toThrow();
    });

    it('should handle event log with many events', () => {
      const gameState = createTestGame();
      
      // Add many events to the log
      const manyEvents = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        timestamp: Date.now() + i,
        type: 'drew' as const,
        playerId: (i % 2) as 0 | 1,
        cardId: i + 1,
        fromAge: 1,
        source: `test_${i}`
      }));
      
      gameState.eventLog.events.push(...manyEvents);
      gameState.eventLog.nextEventId = 1001;
      
      // Should still be serializable
      expect(() => serializeGame(gameState)).not.toThrow();
      
      // Should still validate
      const errors = validateGameData(gameState);
      expect(errors).toEqual([]);
    });
  });
});