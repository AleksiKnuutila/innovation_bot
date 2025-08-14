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

  describe('Combustion (ID 67)', () => {
    it('should execute demand to transfer two cards from score pile', () => {
      let state = createGameWithMeldCard(67, player1); // Meld Combustion (red)
      
      // Give activating player more Crown icons
      // Combustion has 2 Crown icons (left, middle)
      state.players[player1].colors.push({
        color: 'Green',
        cards: [4], // Clothing has 1 Crown icon (left)
        splayDirection: 'right' // Now player1 has 3 total Crown icons
      });
      
      // Give target player fewer Crown icons and score cards to transfer
      state = addCardsToScore(state, player2, [1, 2, 16, 17]); 
      // Ages: Agriculture, Archery, Calendar, Canal Building
      
      const dogmaResult = processDogmaAction(state, 67, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should transfer exactly 2 cards from score pile
      const transferEvents = dogmaResult.events.filter(e => 
        e.type === 'transferred' && e.fromZone?.zone === 'score'
      );
      expect(transferEvents).toHaveLength(2);
      
      // Cards should be transferred to activating player's score pile
      expect(transferEvents[0]).toMatchObject({
        type: 'transferred',
        toPlayer: player1,
        toZone: { zone: 'score' }
      });
      expect(transferEvents[1]).toMatchObject({
        type: 'transferred',
        toPlayer: player1,
        toZone: { zone: 'score' }
      });
    });

    it('should transfer fewer than 2 cards if target has insufficient score cards', () => {
      let state = createGameWithMeldCard(67, player1); // Meld Combustion
      
      // Give activating player more Crown icons
      state.players[player1].colors.push({
        color: 'Green',
        cards: [4], // Clothing
        splayDirection: 'right'
      });
      
      // Give target player only 1 score card
      state = addCardsToScore(state, player2, [1]); // Only Agriculture
      
      const dogmaResult = processDogmaAction(state, 67, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should transfer only 1 card (all that's available)
      const transferEvents = dogmaResult.events.filter(e => 
        e.type === 'transferred' && e.fromZone?.zone === 'score'
      );
      expect(transferEvents).toHaveLength(1);
      expect(transferEvents[0]).toMatchObject({
        type: 'transferred',
        cardId: 1 // Agriculture
      });
    });

    it('should complete without transfer if target has no score cards', () => {
      let state = createGameWithMeldCard(67, player1); // Meld Combustion
      
      // Give activating player more Crown icons
      state.players[player1].colors.push({
        color: 'Green',
        cards: [4], // Clothing
        splayDirection: 'right'
      });
      
      // Target player has no score cards (default)
      
      const dogmaResult = processDogmaAction(state, 67, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should NOT transfer anything
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(0);
    });

    it('should complete without demand if no players have fewer Crown icons', () => {
      let state = createGameWithMeldCard(67, player1); // Meld Combustion
      
      // Give both players equal Crown icons
      // Combustion has 2 Crown icons (left, middle)
      state.players[player2].colors.push({
        color: 'Green',
        cards: [19], // Currency has 2 Crown icons (left, right)
        splayDirection: 'right'
      });
      
      // Give target player score cards (but no demand should occur)
      state = addCardsToScore(state, player2, [1, 2]);
      
      const dogmaResult = processDogmaAction(state, 67, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should NOT transfer anything since no demand occurred
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(0);
    });
  });

  describe('Electricity (ID 68)', () => {
    it('should return all top cards without Factory icons and draw 8s', () => {
      let state = createGameWithMeldCard(68, player1); // Meld Electricity (green)
      
      // Add various cards to player1's board - some with Factory, some without
      state.players[player1].colors.push({
        color: 'Yellow',
        cards: [1], // Agriculture (no Factory icons)
        splayDirection: undefined
      });
      state.players[player1].colors.push({
        color: 'Red',
        cards: [49], // Coal (has Factory icons)
        splayDirection: undefined  
      });
      state.players[player1].colors.push({
        color: 'Blue',
        cards: [15], // Writing (no Factory icons)
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 68, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should return all non-Factory top cards from both players
      // Player1: The Wheel (13), Agriculture (1), Writing (15) - but NOT Coal (49)
      // Player2: Mysticism (9) from initial game setup
      const returnedEvents = dogmaResult.events.filter(e => e.type === 'returned');
      expect(returnedEvents).toHaveLength(4); // All non-Factory top cards
      
      // Should draw 8s for each returned card
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew' && e.fromAge === 8);
      expect(drewEvents).toHaveLength(4); // One for each returned card
      
      // Should have sharing event since player2 also executes
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'shared_effect' })
      );
    });

    it('should return nothing if all top cards have Factory icons', () => {
      let state = createGameWithMeldCard(68, player1); // Electricity itself has Factory
      
      // Replace player1's starting cards to ensure all have Factory icons
      // Clear the starting colors and add only cards with Factory
      state.players[player1].colors = [{
        color: 'Green',
        cards: [68], // Just Electricity (has Factory)
        splayDirection: undefined
      }];
      state.players[player1].colors.push({
        color: 'Red',
        cards: [49], // Coal (has Factory icons)
        splayDirection: undefined
      });
      state.players[player1].colors.push({
        color: 'Yellow',
        cards: [55], // Steam Engine (has Factory icons)
        splayDirection: undefined
      });
      
      // Give player2 only Factory cards too
      state.players[player2].colors = [{
        color: 'Blue',
        cards: [48], // Chemistry (has Factory icons)
        splayDirection: undefined
      }];
      
      const dogmaResult = processDogmaAction(state, 68, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should return no cards since all top cards have Factory icons
      const returnedEvents = dogmaResult.events.filter(e => e.type === 'returned');
      expect(returnedEvents).toHaveLength(0);
      
      // Should draw no 8s
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew' && e.fromAge === 8);
      expect(drewEvents).toHaveLength(0);
    });

    it('should work with empty board (only the Electricity card)', () => {
      let state = createGameWithMeldCard(68, player1); // Just Electricity
      
      // Clear player1's other starting cards to ensure only Electricity
      state.players[player1].colors = [{
        color: 'Green',
        cards: [68], // Just Electricity (has Factory icons)
        splayDirection: undefined
      }];
      
      // Clear player2's cards to prevent sharing
      state.players[player2].colors = [];
      
      const dogmaResult = processDogmaAction(state, 68, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should return no cards (only Electricity which has Factory)
      const returnedEvents = dogmaResult.events.filter(e => e.type === 'returned');
      expect(returnedEvents).toHaveLength(0);
      
      // Should draw no 8s
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew' && e.fromAge === 8);
      expect(drewEvents).toHaveLength(0);
    });

    it('should be shared by other players with equal Factory icons', () => {
      let state = createGameWithMeldCard(68, player1); // Electricity has 1 Factory icon
      
      // Clear initial setups and set up exact Factory icon counts
      state.players[player1].colors = [{
        color: 'Green',
        cards: [68], // Electricity has 1 Factory icon
        splayDirection: undefined
      }];
      
      // Give player2 equal Factory icons (1 Factory)
      state.players[player2].colors = [{
        color: 'Green', 
        cards: [47], // Banking has 1 Factory icon at left position
        splayDirection: undefined 
      }];
      
      // Add exactly one non-Factory card to each player
      state.players[player1].colors.push({
        color: 'Yellow',
        cards: [1], // Agriculture (no Factory)
        splayDirection: undefined
      });
      
      state.players[player2].colors.push({
        color: 'Blue',
        cards: [15], // Writing (no Factory)
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 68, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Both players should have returned non-Factory cards
      // Player1: Agriculture (1), Player2: Writing (15)  
      const returnedEvents = dogmaResult.events.filter(e => e.type === 'returned');
      expect(returnedEvents).toHaveLength(2); // Agriculture + Writing
      
      // Both players should draw 8s (one each)
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew' && e.fromAge === 8);
      expect(drewEvents).toHaveLength(2); // One for each player
      
      // Should have sharing event
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'shared_effect' })
      );
    });
  });

}); 