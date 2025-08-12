// Golden test - scripted game reaches same final state hash
import { describe, it, expect } from 'vitest';
import { initializeGame, processAction, serializeGame } from '../../src/engine/index.js';
import type { Action } from '../../src/types/actions.js';

describe('Phase 2 DoD - Golden Test', () => {
  it('should reach identical final state hash for scripted game', () => {
    const GOLDEN_SEED = 99999;

    // Execute scripted game
    function executeScript(): string {
      let gameState = initializeGame({ 
        gameId: 'golden-test',
        rngSeed: GOLDEN_SEED, 
        playerNames: ['Alice', 'Bob'] 
      });

      // Build dynamic script based on actual turn order
      const startingPlayer = gameState.phase.currentPlayer;
      const secondPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Create action sequence following Innovation rules
      const actions: Action[] = [];
      
      if (startingPlayer === 0) {
        // Player 0 starts (1 action), then Player 1 (2 actions), then alternating
        actions.push({ type: 'draw', playerId: 0, timestamp: Date.now() });      // P0 action 1 (turn 1)
        actions.push({ type: 'draw', playerId: 1, timestamp: Date.now() });      // P1 action 1 (turn 2) 
        actions.push({ type: 'draw', playerId: 1, timestamp: Date.now() });      // P1 action 2 (turn 2)
        actions.push({ type: 'draw', playerId: 0, timestamp: Date.now() });      // P0 action 1 (turn 3)
        actions.push({ type: 'draw', playerId: 0, timestamp: Date.now() });      // P0 action 2 (turn 3)
      } else {
        // Player 1 starts (1 action), then Player 0 (2 actions), then alternating
        actions.push({ type: 'draw', playerId: 1, timestamp: Date.now() });      // P1 action 1 (turn 1)
        actions.push({ type: 'draw', playerId: 0, timestamp: Date.now() });      // P0 action 1 (turn 2)
        actions.push({ type: 'draw', playerId: 0, timestamp: Date.now() });      // P0 action 2 (turn 2)
        actions.push({ type: 'draw', playerId: 1, timestamp: Date.now() });      // P1 action 1 (turn 3)
        actions.push({ type: 'draw', playerId: 1, timestamp: Date.now() });      // P1 action 2 (turn 3)
      }
      
      // Execute draw actions
      for (const action of actions) {
        const result = processAction(gameState, action);
        gameState = result.newState;
      }
      
      // Now add some meld actions using cards from hands
      const p0Cards = gameState.players[0]?.hands || [];
      const p1Cards = gameState.players[1]?.hands || [];
      const currentPlayer = gameState.phase.currentPlayer;
      
      // Add meld actions if players have cards
      if (currentPlayer === 0 && p0Cards.length > 0) {
        const result = processAction(gameState, { type: 'meld', playerId: 0, cardId: p0Cards[0]!, timestamp: Date.now() });
        gameState = result.newState;
      } else if (currentPlayer === 1 && p1Cards.length > 0) {
        const result = processAction(gameState, { type: 'meld', playerId: 1, cardId: p1Cards[0]!, timestamp: Date.now() });
        gameState = result.newState;
      }

      // Create deterministic hash by excluding timestamps
      const deterministicState = {
        // Game phase
        turnNumber: gameState.phase.turnNumber,
        currentPlayer: gameState.phase.currentPlayer,
        actionsRemaining: gameState.phase.actionsRemaining,
        
        // Player state (without timestamps)
        player0Hand: [...(gameState.players[0]?.hands || [])].sort(),
        player1Hand: [...(gameState.players[1]?.hands || [])].sort(),
        player0Board: gameState.players[0]?.colors.map(c => ({ color: c.color, cards: c.cards })) || [],
        player1Board: gameState.players[1]?.colors.map(c => ({ color: c.color, cards: c.cards })) || [],
        
        // Supply piles
        supplyPiles: gameState.shared.supplyPiles.map(pile => ({
          age: pile.age,
          cardCount: pile.cards.length,
          topCard: pile.cards[0] || null
        })),
        
        // RNG state
        rngState: gameState.rng,
        
        // Event count (but not timestamps)
        eventCount: gameState.eventLog.events.length,
      };
      
      return JSON.stringify(deterministicState);
    }

    // Run the scripted game multiple times
    const run1 = executeScript();
    const run2 = executeScript();
    const run3 = executeScript();

    // All runs should produce identical final states
    expect(run1).toBe(run2);
    expect(run2).toBe(run3);

    // Parse and validate the golden state
    const goldenState = JSON.parse(run1);
    
    // Validate expected final conditions
    expect(goldenState.turnNumber).toBeGreaterThan(1);
    expect(goldenState.player0Hand).toEqual(expect.arrayContaining([expect.any(Number)]));
    expect(goldenState.player1Hand).toEqual(expect.arrayContaining([expect.any(Number)]));
    expect(goldenState.eventCount).toBeGreaterThan(5); // Should have multiple events from script
    expect(goldenState.rngState.counter).toBeGreaterThan(0); // RNG should have advanced
    
    // Generate a hash of the final game state for regression testing
    const goldenHash = JSON.stringify(goldenState, null, 2);
    
    // Store the hash for future comparison
    expect(goldenHash).toMatchSnapshot();
  });

  it('should detect state changes in future modifications', () => {
    // This test ensures that any changes to core engine logic 
    // are caught by the golden test
    
    const gameState = initializeGame({ 
      seed: 12345, 
      playerNames: ['Test1', 'Test2'] 
    });
    
    // Create a baseline serialization
    const baseline = serializeGame(gameState);
    
    // Modify something in the state (simulating a bug)
    const modifiedState = { 
      ...gameState, 
      phase: { ...gameState.phase, turnNumber: 999 } 
    };
    const modified = serializeGame(modifiedState);
    
    // Checksums should be different
    expect(baseline.checksum).not.toBe(modified.checksum);
  });

  it('should produce consistent serialization', () => {
    const gameState = initializeGame({ gameId: 'test', rngSeed: 555, playerNames: ['A', 'B'] });
    
    // Serialize the same state multiple times
    const serial1 = serializeGame(gameState);
    const serial2 = serializeGame(gameState);
    const serial3 = serializeGame(gameState);
    
    // Should be identical
    expect(serial1.checksum).toBe(serial2.checksum);
    expect(serial2.checksum).toBe(serial3.checksum);
    expect(serial1.data).toBe(serial2.data);
  });
});