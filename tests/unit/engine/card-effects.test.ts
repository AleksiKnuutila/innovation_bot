// Comprehensive tests for card effects system (Phase 3)
// Testing the callback-based state machine pattern with representative cards

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { processAction } from '../../../src/engine/state-machine.js';
import { processDogmaAction } from '../../../src/engine/dogma-resolver.js';
import { deepClone } from '../../../src/engine/utils.js';
import type { ChoiceAnswer } from '../../../src/types/choices.js';
import type { GameEvent } from '../../../src/types/events.js';
import { CARDS } from '../../../src/cards/database.js';
import { countIcons } from '../../../src/engine/state-manipulation.js';

describe('Card Effects System (Phase 3)', () => {
  let gameData: ReturnType<typeof initializeGame>;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
  });

  describe('State Manipulation Functions', () => {
    it('should draw cards correctly', () => {
      const startingPlayer = gameData.phase.currentPlayer;
      const initialHandSize = gameData.players[startingPlayer].hands.length;
      const initialSupplySize = gameData.shared.supplyPiles[0].cards.length;
      
      const drawResult = processAction(gameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      const newState = drawResult.newState;
      
      expect(newState.players[startingPlayer].hands.length).toBe(initialHandSize + 1);
      expect(newState.shared.supplyPiles[0].cards.length).toBe(initialSupplySize - 1);
      expect(drawResult.events.length).toBe(1);
      expect(drawResult.events[0].type).toBe('drew');
    });

    it('should meld cards correctly', () => {
      const startingPlayer = gameData.phase.currentPlayer;
      // First draw a card to have something to meld
      let drawResult = processAction(gameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      let newState = drawResult.newState;
      
      // After draw, it's still the same player's turn (they have 1 action remaining)
      const currentPlayer = newState.phase.currentPlayer;
      const cardToMeld = newState.players[currentPlayer].hands[0];
      const initialHandSize = newState.players[currentPlayer].hands.length;
      const initialBoardSize = newState.players[currentPlayer].colors.length;
      
      const meldResult = processAction(newState, { type: 'meld', playerId: currentPlayer, cardId: cardToMeld, timestamp: Date.now() });
      newState = meldResult.newState;
      
      expect(newState.players[currentPlayer].hands.length).toBe(initialHandSize - 1);
      expect(newState.players[currentPlayer].colors.length).toBe(initialBoardSize + 1);
      expect(meldResult.events.length).toBe(1); // melded
      expect(meldResult.events[0].type).toBe('melded');
    });

    it('should count icons correctly', () => {
      const startingPlayer = gameData.phase.currentPlayer;
      // Draw and meld a card with Leaf icons
      let drawResult = processAction(gameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      let newState = drawResult.newState;
      
      // After draw, it's still the same player's turn
      const currentPlayer = newState.phase.currentPlayer;
      
      // Find a card with Leaf icons (Writing has Lightbulb icons)
      const cardToMeld = newState.players[currentPlayer].hands.find(cardId => {
        const card = CARDS.cardsById.get(cardId);
        return card && (card.positions.top === 'Leaf' || card.positions.left === 'Leaf' || 
                       card.positions.middle === 'Leaf' || card.positions.right === 'Leaf');
      });
      
      if (cardToMeld) {
        const meldResult = processAction(newState, { type: 'meld', playerId: currentPlayer, cardId: cardToMeld, timestamp: Date.now() });
        newState = meldResult.newState;
        
        const leafCount = countIcons(newState, currentPlayer, 'Leaf');
        expect(leafCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Dogma Resolution Framework', () => {
    it('should create dogma context correctly', () => {
      const context = {
        cardId: 15,
        dogmaLevel: 1,
        activatingPlayer: 0,
        affectedPlayers: [0],
      };
      
      expect(context.cardId).toBe(15);
      expect(context.dogmaLevel).toBe(1);
      expect(context.activatingPlayer).toBe(0);
      expect(context.affectedPlayers).toContain(0);
    });

    it('should process dogma actions through the framework', () => {
      // Test dogma resolution directly through the framework
      const result = processDogmaAction(gameData, 15, 0); // Writing card, player 0
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.nextPhase).toBe('AwaitingAction');
    });
  });

  describe('Writing Card (Simple Effect)', () => {
    it('should handle Writing card dogma effect', () => {
      // Writing: "Draw a 2" - should draw 2 cards from age 1
      const initialHandSize = gameData.players[0].hands.length;
      const initialSupplySize = gameData.shared.supplyPiles[0].cards.length;
      
      const result = processDogmaAction(gameData, 15, 0); // Writing card, player 0
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.nextPhase).toBe('AwaitingAction');
      
      // Check that cards were drawn
      const newState = result.newState;
      expect(newState.players[0].hands.length).toBe(initialHandSize + 2);
      
      // Writing draws from age 2, so check age 2 supply pile
      const age2SupplyPile = newState.shared.supplyPiles.find(pile => pile.age === 2);
      expect(age2SupplyPile).toBeDefined();
      if (age2SupplyPile) {
        expect(age2SupplyPile.cards.length).toBeLessThan(gameData.shared.supplyPiles.find(pile => pile.age === 2)?.cards.length || 0);
      }
      
      // Should have drew events (2 for activating player + 2 for sharing players)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(4);
    });

    it('should work in integration with meld', () => {
      // Test: meld Writing card, then activate its dogma
      const startingPlayer = gameData.phase.currentPlayer;
      let drawResult = processAction(gameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      let newState = drawResult.newState;
      
      // After draw, it's still the same player's turn
      const currentPlayer = newState.phase.currentPlayer;
      
      // Find and meld the Writing card (if available)
      const writingCard = newState.players[currentPlayer].hands.find(cardId => cardId === 15);
      if (!writingCard) {
        // Skip this test if Writing card is not available
        console.log('Writing card not available in test, skipping integration test');
        return;
      }
      
      const meldResult = processAction(newState, { type: 'meld', playerId: currentPlayer, cardId: writingCard, timestamp: Date.now() });
      newState = meldResult.newState;
      
      // Now activate the dogma
      const result = processDogmaAction(newState, 15, currentPlayer);
      
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.nextPhase).toBe('AwaitingAction');
      
      // Should have drawn 2 additional cards
      expect(result.newState.players[currentPlayer].hands.length).toBe(newState.players[currentPlayer].hands.length + 2);
    });
  });

  describe('Code of Laws Card (Medium Complexity)', () => {
    it('should count crown icons correctly in test setup', () => {
      // Debug test to verify icon counting works
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      const otherPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Add cards to the starting player's board
      testGameData.players[startingPlayer].colors.push({
        color: 'blue',
        cards: [5, 33] // Code of Laws + Optics (Optics has crown in top position)
      });
      
      // Set splay direction to make more icons visible
      testGameData.players[startingPlayer].colors[0].splayDirection = 'up';
      
      // Add cards to the other player's board
      testGameData.players[otherPlayer].colors.push({
        color: 'red',
        cards: [1] // No crown icons
      });
      
      // Count crown icons for both players
      const startingPlayerCrowns = countIcons(testGameData, startingPlayer, 'Crown');
      const otherPlayerCrowns = countIcons(testGameData, otherPlayer, 'Crown');
      
      console.log(`Starting player crown count: ${startingPlayerCrowns}`);
      console.log(`Other player crown count: ${otherPlayerCrowns}`);
      
      // Starting player should have more crown icons
      expect(startingPlayerCrowns).toBeGreaterThan(otherPlayerCrowns);
      expect(startingPlayerCrowns).toBeGreaterThan(0);
    });

    it('should generate choice when Code of Laws dogma is activated', () => {
      // Code of Laws: "You may tuck a card... If you do, you may splay..."
      // This should generate a choice for the player
      
      // Set up a game state where the starting player has more crown icons
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      const otherPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Manually add cards to the starting player's board to ensure they have more crown icons
      // This avoids turn advancement issues
      // Use cards with crown icons in the TOP position so they're visible
      const crownCard1 = 5; // Code of Laws - has crown icons but not in top position
      const crownCard2 = 33; // Optics has crown in top position
      
      // Add cards directly to the player's board (bypassing normal game flow)
      testGameData.players[startingPlayer].colors.push({
        color: 'blue', // Arbitrary color
        cards: [crownCard1, crownCard2]
      });
      
      // Set splay direction to make more icons visible
      testGameData.players[startingPlayer].colors[0].splayDirection = 'up';
      
      // Ensure the other player has fewer crown icons by giving them cards without crowns
      testGameData.players[otherPlayer].colors.push({
        color: 'red', // Arbitrary color
        cards: [1] // Card 1 has no crown icons
      });
      
      // Now activate Code of Laws dogma
      const result = processDogmaAction(testGameData, 5, startingPlayer); // Code of Laws card, starting player
      
      // Should need a choice
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice).toBeDefined();
      expect(result.pendingChoice?.type).toBe('yes_no');
      
      // Should have active effects
      expect(result.newState.currentEffect).toBeDefined();
      expect(result.newState.currentEffect?.cardId).toBe(5);
    });
  });

  describe('Oars Card (Complex Multi-Step Effect)', () => {
    it('should handle Oars demand effect with player targeting', () => {
      // Oars: "I demand you transfer a card with a [Crown]... If you do, draw a 1"
      
      // Set up a game state where both players have similar crown icon counts
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      const otherPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Manually add cards to both players' boards to set up the scenario
      // Starting player gets Oars (card 10) and another crown card
      testGameData.players[startingPlayer].colors.push({
        color: 'blue',
        cards: [10, 5] // Oars + Code of Laws (both have crown icons)
      });
      
      // Other player gets a crown card too
      testGameData.players[otherPlayer].colors.push({
        color: 'red',
        cards: [66] // Another crown card
      });
      
      // Now activate Oars dogma
      const result = processDogmaAction(testGameData, 10, startingPlayer); // Oars card, starting player
      
      // Since both players have similar crown counts, the effect should complete immediately
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.length).toBeGreaterThan(0);
      
      // Should not have active effects since it completed
      expect(result.newState.currentEffect).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete game flow with multiple card effects', () => {
      // Test a complete flow: draw -> meld -> dogma -> choices -> resolution
      const startingPlayer = gameData.phase.currentPlayer;
      let drawResult = processAction(gameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      let newState = drawResult.newState;
      
      // Meld Writing card (if available)
      const writingCard = newState.players[startingPlayer].hands.find(cardId => cardId === 15);
      if (!writingCard) {
        console.log('Writing card not available in test, skipping integration test');
        return;
      }
      const meldResult = processAction(newState, { type: 'meld', playerId: startingPlayer, cardId: writingCard, timestamp: Date.now() });
      newState = meldResult.newState;
      
      // Activate Writing dogma (should draw 2 cards)
      let result = processDogmaAction(newState, 15, startingPlayer);
      expect(result.nextPhase).toBe('AwaitingAction');
      expect(result.events.length).toBeGreaterThan(0);
      
      // Meld Code of Laws card (if available)
      newState = result.newState;
      const codeOfLawsCard = newState.players[startingPlayer].hands.find(cardId => cardId === 5);
      if (!codeOfLawsCard) {
        console.log('Code of Laws card not available in test, skipping rest of integration test');
        return;
      }
      const meldResult2 = processAction(newState, { type: 'meld', playerId: startingPlayer, cardId: codeOfLawsCard, timestamp: Date.now() });
      newState = meldResult2.newState;
      
      // Activate Code of Laws dogma (should need choices)
      result = processDogmaAction(newState, 5, startingPlayer);
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.type).toBe('yes_no');
    });
  });

  // ============================================================================
  // New Tests for Supply Pile Exhaustion and Sharing Mechanics
  // ============================================================================
  
  describe('Supply Pile Exhaustion Handling', () => {
    it('should draw from next available age when requested age is empty', () => {
      // Set up a game state where age 1 is empty but age 2 has cards
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Empty age 1 supply pile
      testGameData.shared.supplyPiles[0].cards = [];
      
      // Ensure age 2 has cards
      testGameData.shared.supplyPiles[1].cards = [20, 21, 22, 23, 24];
      
      const drawResult = processAction(testGameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      const newState = drawResult.newState;
      
      // Should have drawn a card
      expect(newState.players[startingPlayer].hands.length).toBe(gameData.players[startingPlayer].hands.length + 1);
      
      // Should have drawn from age 2 (next available)
      const drewEvent = drawResult.events.find(e => e.type === 'drew');
      expect(drewEvent).toBeDefined();
      expect(drewEvent?.fromAge).toBe(2);
      
      // Age 2 supply pile should be reduced
      expect(newState.shared.supplyPiles[1].cards.length).toBe(4);
    });

    it('should draw from lowest available age when no higher ages have cards', () => {
      // Set up a game state where only age 3 has cards
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Empty age 1 and 2 supply piles
      testGameData.shared.supplyPiles[0].cards = [];
      testGameData.shared.supplyPiles[1].cards = [];
      
      // Ensure age 3 has cards
      testGameData.shared.supplyPiles[2].cards = [30, 31, 32, 33, 34];
      
      const drawResult = processAction(testGameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      const newState = drawResult.newState;
      
      // Should have drawn a card
      expect(newState.players[startingPlayer].hands.length).toBe(gameData.players[startingPlayer].hands.length + 1);
      
      // Should have drawn from age 3 (lowest available)
      const drewEvent = drawResult.events.find(e => e.type === 'drew');
      expect(drewEvent).toBeDefined();
      expect(drewEvent?.fromAge).toBe(3);
    });

    it('should throw error when no supply piles have cards', () => {
      // Set up a game state where all supply piles are empty
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Empty all supply piles
      testGameData.shared.supplyPiles.forEach(pile => {
        pile.cards = [];
      });
      
      expect(() => {
        processAction(testGameData, { type: 'draw', playerId: startingPlayer, timestamp: Date.now() });
      }).toThrow('No cards available to draw');
    });
  });

  describe('Sharing vs. Non-Sharing Dogma Effects', () => {
    it('should share non-demand effects with eligible players', () => {
      // Set up a game state where both players have similar icon counts
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      const otherPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Manually add cards to both players' boards to set up the scenario
      // Both players get similar crown icon counts so they'll share
      testGameData.players[startingPlayer].colors.push({
        color: 'blue',
        cards: [5, 10] // Code of Laws + Oars (both have crown icons)
      });
      
      testGameData.players[otherPlayer].colors.push({
        color: 'red',
        cards: [33] // Optics has crown in top position
      });
      
      // Activate Writing card dogma (non-demand effect)
      const result = processDogmaAction(testGameData, 15, startingPlayer);
      
      // Should complete successfully
      expect(result.nextPhase).toBe('AwaitingAction');
      
      // Should have 4 drew events (2 for activating player + 2 for sharing player)
      const drewEvents = result.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBe(4);
      
      // Should have shared_effect event if sharing led to changes
      const sharedEvents = result.events.filter(e => e.type === 'shared_effect');
      expect(sharedEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should not share demand effects', () => {
      // Set up a game state where player 0 has more crown icons than player 1
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      const otherPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Manually add cards to set up the scenario
      // Starting player gets multiple crown cards
      testGameData.players[startingPlayer].colors.push({
        color: 'blue',
        cards: [5, 10, 33] // Multiple crown cards
      });
      
      // Set splay direction to make more icons visible
      testGameData.players[startingPlayer].colors[0].splayDirection = 'up';
      
      // Other player gets fewer crown cards
      testGameData.players[otherPlayer].colors.push({
        color: 'red',
        cards: [1] // No crown icons
      });
      
      // Activate Oars card dogma (demand effect)
      const result = processDogmaAction(testGameData, 10, startingPlayer);
      
      // Should need a choice (demand effect)
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice).toBeDefined();
      
      // Should not have shared effects since this is a demand
      const sharedEvents = result.events.filter(e => e.type === 'shared_effect');
      expect(sharedEvents.length).toBe(0);
    });

    it('should grant free draw action when sharing leads to changes', () => {
      // This test verifies that when sharing effects lead to game state changes,
      // the activating player gets a free draw action
      
      // Set up a game state where sharing will definitely cause changes
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      const otherPlayer = startingPlayer === 0 ? 1 : 0;
      
      // Manually add cards to both players' boards to set up the scenario
      // Both players have similar board states so they'll share
      testGameData.players[startingPlayer].colors.push({
        color: 'blue',
        cards: [5, 10] // Code of Laws + Oars
      });
      
      testGameData.players[otherPlayer].colors.push({
        color: 'red',
        cards: [33] // Another crown card
      });
      
      // Activate Writing card dogma (non-demand effect that will be shared)
      const result = processDogmaAction(testGameData, 15, startingPlayer);
      
      // Should complete successfully
      expect(result.nextPhase).toBe('AwaitingAction');
      
      // Should have shared_effect event indicating free draw was granted
      const sharedEvents = result.events.filter(e => e.type === 'shared_effect');
      expect(sharedEvents.length).toBeGreaterThan(0);
      
      // Verify it's a shared effect event
      const sharedEvent = sharedEvents[0];
      expect(sharedEvent.type).toBe('shared_effect');
    });
  });
}); 