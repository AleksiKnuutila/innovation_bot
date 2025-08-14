import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { processDogmaAction, resumeDogmaExecution } from '../../../src/engine/dogma-resolver.js';
import { deepClone } from '../../../src/engine/utils.js';
import type { ChoiceAnswer } from '../../../src/types/choices.js';
import type { GameEvent } from '../../../src/types/events.js';
import type { SupplyPile } from '../../../src/types/game-data.js';
import { CARDS } from '../../../src/cards/database.js';
import type { PlayerId } from '../../../src/types/core.js';

describe('Age 7 Card Effects', () => {
  let gameData: ReturnType<typeof initializeGame>;
  let player1: PlayerId = 0;
  let player2: PlayerId = 1;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
    
    // Add supply piles for ages 4-10 for proper testing of Age 7 effects
    const additionalSupplyPiles: SupplyPile[] = [];
    for (let age = 4; age <= 10; age++) {
      const ageCards = CARDS.cardsByAge.get(age as any) || [];
      const cardIds = ageCards.map(card => card.id);
      additionalSupplyPiles.push({
        age,
        cards: [...cardIds] // Use all cards for testing
      });
    }
    
    // Add the additional supply piles to the game state
    gameData.shared.supplyPiles.push(...additionalSupplyPiles);
  });

  // Helper function to create a simple game state with a specific card melded
  function createGameWithMeldCard(cardId: number, playerId: PlayerId = 0) {
    const state = deepClone(gameData);
    
    // Clear initial hands and scores to avoid interference
    state.players[0].hands.splice(0);
    state.players[0].scores.splice(0);
    state.players[1].hands.splice(0);
    state.players[1].scores.splice(0);
    
    // Find the card in the supply piles and move it to the player's board
    for (const pile of state.shared.supplyPiles) {
      const cardIndex = pile.cards.indexOf(cardId);
      if (cardIndex !== -1) {
        // Remove from supply
        pile.cards.splice(cardIndex, 1);
        
        // Add to player's board (create a new color stack)
        const card = CARDS.cardsById.get(cardId);
        if (card) {
          state.players[playerId].colors.push({
            color: card.color,
            cards: [cardId],
            splayDirection: undefined
          });
        }
        break;
      }
    }
    
    return state;
  }

  // Helper function to add cards to a player's hand
  function addCardsToHand(state: typeof gameData, playerId: PlayerId, cardIds: number[]) {
    for (const cardId of cardIds) {
      // Add card directly to hand (for testing purposes)
      state.players[playerId].hands.push(cardId);
    }
    return state;
  }

  // Helper function to add cards to a player's score pile
  function addCardsToScore(state: typeof gameData, playerId: PlayerId, cardIds: number[]) {
    for (const cardId of cardIds) {
      // Add card directly to score pile (for testing purposes)
      state.players[playerId].scores.push(cardId);
    }
    return state;
  }

  // TODO: Add Age 7 card test suites here as they are implemented
  // - Bicycle (ID 66)
  // - Combustion (ID 67)
  // - Electricity (ID 68)
  // - Evolution (ID 69)
  // - Explosives (ID 70)
  // - Lighting (ID 71)
  // - Publications (ID 72)
  // - Railroad (ID 73)
  // - Refrigeration (ID 74)
  // - Sanitation (ID 75)

  describe('Bicycle (ID 66)', () => {
    it('should exchange all hand cards with all score cards when chosen', () => {
      let state = createGameWithMeldCard(66, player1); // Meld Bicycle (green)
      
      // Add cards to hand
      state = addCardsToHand(state, player1, [1, 2, 3]); // Agriculture, Archery, City States
      
      // Add cards to score pile  
      state = addCardsToScore(state, player1, [16, 17]); // Calendar, Canal Building
      
      const dogmaResult = processDogmaAction(state, 66, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should exchange hand [1,2,3] with score [16,17]
      // After exchange: hand=[16,17], score=[1,2,3]
      expect(dogmaResult.newState.players[player1].hands).toEqual([16, 17]);
      expect(dogmaResult.newState.players[player1].scores).toEqual([1, 2, 3]);
    });

    it('should work with empty hand or empty score pile', () => {
      let state = createGameWithMeldCard(66, player1); // Meld Bicycle
      
      // Add cards only to hand, empty score pile
      state = addCardsToHand(state, player1, [1, 2]);
      // Score pile is already empty
      
      const dogmaResult = processDogmaAction(state, 66, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should exchange hand [1,2] with empty score []
      // After exchange: hand=[], score=[1,2]
      expect(dogmaResult.newState.players[player1].hands).toEqual([]);
      expect(dogmaResult.newState.players[player1].scores).toEqual([1, 2]);
    });

    it('should work with empty hand and empty score pile', () => {
      let state = createGameWithMeldCard(66, player1); // Just Bicycle
      
      // Both hand and score are empty
      
      const dogmaResult = processDogmaAction(state, 66, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Nothing to exchange
      expect(dogmaResult.newState.players[player1].hands).toEqual([]);
      expect(dogmaResult.newState.players[player1].scores).toEqual([]);
    });

    it('should be shared by other players with equal Crown icons', () => {
      let state = createGameWithMeldCard(66, player1); // Bicycle (2 Crown icons: left, middle)
      
      // Give player2 equal Crown icons
      state.players[player2].colors.push({
        color: 'Green',
        cards: [19], // Currency has 2 Crown icons (left, right)
        splayDirection: 'right'
      });
      
      // Add different cards to each player
      state = addCardsToHand(state, player1, [1, 2]);
      state = addCardsToScore(state, player1, [16]);
      
      state = addCardsToHand(state, player2, [3]);
      state = addCardsToScore(state, player2, [17, 18]);
      
      const dogmaResult = processDogmaAction(state, 66, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Both players should exchange
      // Player 1: hand [1,2] <-> score [16] = hand [16], score [1,2]
      expect(dogmaResult.newState.players[player1].hands).toEqual([16]);
      expect(dogmaResult.newState.players[player1].scores).toEqual([1, 2]);
      
      // Player 2: hand [3] <-> score [17,18] = hand [17,18], score [3]
      expect(dogmaResult.newState.players[player2].hands).toEqual([17, 18]);
      expect(dogmaResult.newState.players[player2].scores).toEqual([3]);
      
      // Should have sharing event
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'shared_effect' })
      );
    });
  });

}); 