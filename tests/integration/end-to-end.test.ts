// Integration tests for complete engine workflows
import { describe, it, expect } from 'vitest';
import { initializeGame, processAction, getLegalActions, serializeGame, deserializeGame } from '@/engine/index.js';

describe('Engine Integration Tests', () => {
  it('should support complete game initialization to first meld workflow', () => {
    const gameData = initializeGame({ gameId: 'test', rngSeed: 777, playerNames: ['Player1', 'Player2'] });
    const startingPlayer = gameData.phase.currentPlayer;
    
    // Verify initial state
    expect(gameData.phase.state).toBe('AwaitingAction');
    expect([0, 1]).toContain(startingPlayer);
    expect(gameData.phase.actionsRemaining).toBe(1); // Starting player gets 1 action on first turn
    
    // Check legal actions for starting player
    const legalActions = getLegalActions(gameData, startingPlayer);
    expect(legalActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'draw' })
      ])
    );
    
    // Execute draw action
    const drawResult = processAction(gameData, { type: 'draw', playerId: startingPlayer });
    expect(drawResult.events[0]?.type).toBe('drew');
    
    // Now it should be the other player's turn with 2 actions  
    const otherPlayer = startingPlayer === 0 ? 1 : 0;
    expect(drawResult.newState.phase.currentPlayer).toBe(otherPlayer);
    expect(drawResult.newState.phase.actionsRemaining).toBe(2);
    
    // Other player draws a card 
    const draw2Result = processAction(drawResult.newState, { type: 'draw', playerId: otherPlayer });
    
    // Other player should now have a card to meld
    const cardToMeld = draw2Result.newState.players[otherPlayer]?.hands.find(cardId => cardId);
    expect(cardToMeld).toBeDefined();
    
    // Execute meld action
    const meldResult = processAction(draw2Result.newState, { 
      type: 'meld', 
      playerId: otherPlayer, 
      cardId: cardToMeld! 
    });
    expect(meldResult.events[0]?.type).toBe('melded');
    
    // Verify card moved from hand to board
    expect(meldResult.newState.players[otherPlayer]?.hands).not.toContain(cardToMeld);
    expect(meldResult.newState.players[otherPlayer]?.colors.length).toBeGreaterThan(0);
  });

  it('should maintain game state consistency through action sequences', () => {
    const gameData = initializeGame({ gameId: 'test', rngSeed: 333, playerNames: ['A', 'B'] });
    const startingPlayer = gameData.phase.currentPlayer;
    const otherPlayer = startingPlayer === 0 ? 1 : 0;
    
    // Starting player takes their 1 action on first turn
    let currentState = gameData;
    let result = processAction(currentState, { type: 'draw', playerId: startingPlayer });
    currentState = result.newState;
    
    // Should now be other player's turn with 2 actions
    expect(currentState.phase.currentPlayer).toBe(otherPlayer);
    expect(currentState.phase.actionsRemaining).toBe(2);
    
    // Other player takes their first action
    result = processAction(currentState, { type: 'draw', playerId: otherPlayer });
    currentState = result.newState;
    expect(currentState.phase.actionsRemaining).toBe(1);
    
    // Validate game state consistency 
    const totalCards = Object.values(currentState.players).reduce((sum, player) => 
      sum + player.hands.length + player.colors.reduce((colorSum, colorStack) => 
        colorSum + colorStack.cards.length, 0), 0);
    expect(totalCards).toBeGreaterThan(0);
  });

  it('should support serialize/deserialize round trip', () => {
    const originalGame = initializeGame({ gameId: 'test', rngSeed: 888, playerNames: ['Alice', 'Bob'] });
    
    // Make some changes (player 0 has the starting turn)
    const drawResult = processAction(originalGame, { type: 'draw', playerId: originalGame.phase.currentPlayer });
    
    // Serialize
    const serialized = serializeGame(drawResult.newState);
    expect(serialized.version).toBe('1.0.0');
    expect(serialized.checksum).toBeTypeOf('number');
    
    // Deserialize
    const deserialized = deserializeGame(serialized);
    
    // Should be identical to original
    expect(deserialized.gameId).toBe(drawResult.newState.gameId);
    expect(deserialized.phase).toEqual(drawResult.newState.phase);
    expect(deserialized.players).toEqual(drawResult.newState.players);
    expect(deserialized.shared).toEqual(drawResult.newState.shared);
    expect(deserialized.eventLog.events).toEqual(drawResult.newState.eventLog.events);
  });

  it('should handle turn transitions correctly', () => {
    const gameData = initializeGame({ gameId: 'test', rngSeed: 444, playerNames: ['A', 'B'] });
    
    // Use the actual starting player (determined by card selection)
    const startingPlayer = gameData.phase.currentPlayer;
    const otherPlayer = startingPlayer === 0 ? 1 : 0;
    
    // Starting player takes 1 action on first turn
    const action1 = processAction(gameData, { type: 'draw', playerId: startingPlayer });
    expect(action1.newState.phase.actionsRemaining).toBe(2); // Other player gets 2 actions
    expect(action1.newState.phase.currentPlayer).toBe(otherPlayer); // Should advance to other player
    
    // Other player takes their first action
    const action2 = processAction(action1.newState, { type: 'draw', playerId: otherPlayer });
    
    // Other player should still have 1 action remaining
    expect(action2.newState.phase.currentPlayer).toBe(otherPlayer);
    expect(action2.newState.phase.actionsRemaining).toBe(1);
    
    // Other player takes their second action
    const action3 = processAction(action2.newState, { type: 'draw', playerId: otherPlayer });
    
    // Should be back to starting player, next turn (both players get 2 actions now)
    expect(action3.newState.phase.currentPlayer).toBe(startingPlayer);
    expect(action3.newState.phase.turnNumber).toBe(3); // Turn number increments on each player switch
    expect(action3.newState.phase.actionsRemaining).toBe(2);
  });

  it('should validate action legality consistently', () => {
    const gameData = initializeGame({ gameId: 'test', rngSeed: 222, playerNames: ['A', 'B'] });
    const currentPlayer = gameData.phase.currentPlayer;
    const otherPlayer = currentPlayer === 0 ? 1 : 0;
    
    // Legal action should work
    const legalActions = getLegalActions(gameData, currentPlayer);
    expect(legalActions.length).toBeGreaterThan(0);
    
    const legalAction = legalActions[0]!;
    expect(() => processAction(gameData, legalAction)).not.toThrow();
    
    // Illegal action should be rejected (wrong player)
    expect(() => processAction(gameData, { type: 'draw', playerId: otherPlayer }))
      .toThrow('Not your turn');
      
    // Invalid card meld should be rejected
    expect(() => processAction(gameData, { type: 'meld', playerId: currentPlayer, cardId: 99999 }))
      .toThrow();
  });
});