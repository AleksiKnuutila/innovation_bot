// Basic functionality tests for Phase 2 engine core
import { describe, it, expect } from 'vitest';
import { initializeGame, processAction } from '@/engine/index.js';

describe('Phase 2 Engine - Basic Functionality', () => {
  describe('Game Initialization', () => {
    it('should initialize a game with valid parameters', () => {
      const gameData = initializeGame({ 
        gameId: 'test-game',
        rngSeed: 12345, 
        playerNames: ['Alice', 'Bob'] 
      });
      
      expect(gameData.gameId).toBe('test-game');
      expect(gameData.version).toBe('1.0.0');
      expect([0, 1]).toContain(gameData.phase.currentPlayer); // Starting player can be either
      expect(gameData.phase.turnNumber).toBe(1);
      expect(gameData.phase.state).toBe('AwaitingAction');
      expect(Object.keys(gameData.players)).toHaveLength(2);
      expect(gameData.shared.supplyPiles).toHaveLength(3); // Ages 1-3
    });

    it('should create deterministic initial state with same seed', () => {
      const game1 = initializeGame({ gameId: 'test', rngSeed: 42, playerNames: ['A', 'B'] });
      const game2 = initializeGame({ gameId: 'test', rngSeed: 42, playerNames: ['A', 'B'] });
      
      // Same seed should produce same initial card distribution
      expect(game1.shared.supplyPiles).toEqual(game2.shared.supplyPiles);
      expect(game1.players[0]?.hands).toEqual(game2.players[0]?.hands);
      expect(game1.players[1]?.hands).toEqual(game2.players[1]?.hands);
    });

    it('should create different initial state with different seeds', () => {
      const game1 = initializeGame({ gameId: 'test', rngSeed: 1, playerNames: ['A', 'B'] });
      const game2 = initializeGame({ gameId: 'test', rngSeed: 2, playerNames: ['A', 'B'] });
      
      // Different seeds should produce different supply pile arrangements
      // (hands might coincidentally be the same, but supply piles should be different)
      expect(game1.shared.supplyPiles).not.toEqual(game2.shared.supplyPiles);
    });
  });

  describe('Action Processing', () => {
    it('should process draw action successfully', () => {
      const gameData = initializeGame({ gameId: 'test', rngSeed: 123, playerNames: ['A', 'B'] });
      const currentPlayer = gameData.phase.currentPlayer;
      const initialHandSize = gameData.players[currentPlayer]?.hands.length ?? 0;
      
      const result = processAction(gameData, { type: 'draw', playerId: currentPlayer });
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe('drew');
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.newState.players[currentPlayer]?.hands).toHaveLength(initialHandSize + 1);
    });

    it('should process meld action successfully', () => {
      const gameData = initializeGame({ gameId: 'test', rngSeed: 456, playerNames: ['A', 'B'] });
      const currentPlayer = gameData.phase.currentPlayer;
      const cardToMeld = gameData.players[currentPlayer]?.hands[0];
      expect(cardToMeld).toBeDefined();
      
      const result = processAction(gameData, { 
        type: 'meld', 
        playerId: currentPlayer, 
        cardId: cardToMeld! 
      });
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe('melded');
      expect(result.nextPhase).toBe('AwaitingAction');
      // Card should be removed from hand
      expect(result.newState.players[currentPlayer]?.hands).not.toContain(cardToMeld);
    });

    it('should reject illegal actions', () => {
      const gameData = initializeGame({ gameId: 'test', rngSeed: 789, playerNames: ['A', 'B'] });
      
      // Try action from wrong player
      const currentPlayer = gameData.phase.currentPlayer;
      const wrongPlayer = currentPlayer === 0 ? 1 : 0;
      
      expect(() => {
        processAction(gameData, { type: 'draw', playerId: wrongPlayer });
      }).toThrow('Illegal action');
    });
  });

  describe('Event System', () => {
    it('should emit events with proper structure', () => {
      const gameData = initializeGame({ gameId: 'test', rngSeed: 999, playerNames: ['A', 'B'] });
      const currentPlayer = gameData.phase.currentPlayer;
      const result = processAction(gameData, { type: 'draw', playerId: currentPlayer });
      
      const event = result.events[0]!;
      expect(event).toMatchObject({
        id: expect.any(Number),
        timestamp: expect.any(Number),
        type: 'drew',
        source: expect.any(String),
        playerId: currentPlayer
      });
    });

    it('should maintain event log continuity', () => {
      const gameData = initializeGame({ gameId: 'test', rngSeed: 111, playerNames: ['A', 'B'] });
      const firstPlayer = gameData.phase.currentPlayer;
      const result1 = processAction(gameData, { type: 'draw', playerId: firstPlayer });
      
      // Determine who can take the next action based on Innovation rules
      const nextPlayer = result1.newState.phase.currentPlayer;
      const result2 = processAction(result1.newState, { type: 'draw', playerId: nextPlayer });
      
      expect(result2.newState.eventLog.events).toHaveLength(2);
      expect(result2.newState.eventLog.events[0]?.id).toBe(1);
      expect(result2.newState.eventLog.events[1]?.id).toBe(2);
    });
  });
});