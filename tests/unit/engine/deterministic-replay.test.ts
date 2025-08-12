// Deterministic replay tests - Phase 2 DoD requirement  
import { describe, it, expect } from 'vitest';
import { initializeGame, processAction } from '@/engine/index.js';
import type { Action } from '@/types/actions.js';

describe('Phase 2 DoD - Deterministic Replay (Fixed)', () => {
  it('should reproduce identical events from same seed and actions', () => {
    const seed = 42;
    
    // Initialize both games with the same seed
    const gameState1 = initializeGame({ gameId: 'test1', rngSeed: seed, playerNames: ['A', 'B'] });
    const gameState2 = initializeGame({ gameId: 'test2', rngSeed: seed, playerNames: ['A', 'B'] });
    
    // Both games should be identical initially
    expect(gameState1.phase.currentPlayer).toBe(gameState2.phase.currentPlayer);
    expect(gameState1.phase.turnNumber).toBe(gameState2.phase.turnNumber);
    
    // Determine who goes first (should be same for both games)  
    const startingPlayer = gameState1.phase.currentPlayer;
    const secondPlayer = startingPlayer === 0 ? 1 : 0;
    
    // Build actions based on actual turn order and Innovation rules
    // Starting player (regardless of who) gets 1 action, then other player gets 2 actions
    const actions: Action[] = [];
    
    if (startingPlayer === 0) {
      // Player 0 starts: gets 1 action, then player 1 gets 2 actions
      actions.push({ type: 'draw', playerId: 0 });
      actions.push({ type: 'draw', playerId: 1 });
      actions.push({ type: 'draw', playerId: 1 });
    } else {
      // Player 1 starts: gets 1 action, then player 0 gets 2 actions
      actions.push({ type: 'draw', playerId: 1 });
      actions.push({ type: 'draw', playerId: 0 });
      actions.push({ type: 'draw', playerId: 0 });
    }

    // Run sequence on both games
    let currentState1 = gameState1;
    let currentState2 = gameState2;
    const events1: any[] = [];
    const events2: any[] = [];
    
    for (const action of actions) {
      const result1 = processAction(currentState1, action);
      const result2 = processAction(currentState2, action);
      
      events1.push(...result1.events);
      events2.push(...result2.events);
      
      currentState1 = result1.newState;
      currentState2 = result2.newState;
    }

    // Verify identical event sequences
    expect(events1).toHaveLength(events2.length);
    
    for (let i = 0; i < events1.length; i++) {
      const event1 = events1[i];
      const event2 = events2[i];
      
      // Events should be identical except for timestamps (which might vary slightly)
      expect(event1.type).toBe(event2.type);
      expect(event1.playerId).toBe(event2.playerId);
      expect(event1.source).toBe(event2.source);
      
      if (event1.type === 'drew') {
        expect(event1.cardId).toBe(event2.cardId);
        expect(event1.fromAge).toBe(event2.fromAge);
      }
    }

    // Final game states should be identical
    expect(currentState1.players).toEqual(currentState2.players);
    expect(currentState1.shared.supplyPiles).toEqual(currentState2.shared.supplyPiles);
    expect(currentState1.phase.turnNumber).toBe(currentState2.phase.turnNumber);
    expect(currentState1.phase.currentPlayer).toBe(currentState2.phase.currentPlayer);
  });

  it('should produce different results with different seeds', () => {
    const game1 = initializeGame({ gameId: 'diff1', rngSeed: 1, playerNames: ['A', 'B'] });
    const game2 = initializeGame({ gameId: 'diff2', rngSeed: 2, playerNames: ['A', 'B'] });

    // Should have different supply pile arrangements
    expect(game1.shared.supplyPiles).not.toEqual(game2.shared.supplyPiles);
  });

  it('should maintain RNG state consistency through actions', () => {
    const gameState = initializeGame({ gameId: 'rng-test', rngSeed: 12345, playerNames: ['A', 'B'] });
    const initialRngState = gameState.rng;
    
    // Process an action that uses RNG (draw)
    const currentPlayer = gameState.phase.currentPlayer;
    const result = processAction(gameState, { type: 'draw', playerId: currentPlayer });
    const newRngState = result.newState.rng;
    
    // RNG state should have advanced
    expect(newRngState.counter).toBeGreaterThan(initialRngState.counter);
  });
});