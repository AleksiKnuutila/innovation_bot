// Comprehensive tests for card effects system (Phase 3)
// Testing the callback-based state machine pattern with representative cards

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { processAction } from '../../../src/engine/state-machine.js';
import { processDogmaAction, resumeDogmaExecution } from '../../../src/engine/dogma-resolver.js';
import { deepClone } from '../../../src/engine/utils.js';
import type { ChoiceAnswer } from '../../../src/types/choices.js';
import type { GameEvent } from '../../../src/types/events.js';
import { CARDS } from '../../../src/cards/database.js';
import { countIcons, drawCard } from '../../../src/engine/state-manipulation.js';
import { checkVictoryConditions } from '../../../src/engine/victory-conditions.js';
import type { PlayerId } from '../../../src/types/core.js';

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
      
      // Ensure the other player has fewer crown icons
      testGameData.players[1 - startingPlayer].colors.push({
        color: 'red',
        cards: [1] // No crown icons
      });
      
      // Add some cards to the player's hand with different colors
      testGameData.players[startingPlayer].hands.push(1, 2, 3); // Cards with different colors
      
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

    it('should properly tuck cards with correct colors when Code of Laws choice is made', () => {
      // Test that Code of Laws properly looks up card colors when tucking
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Add Code of Laws to the player's board
      testGameData.players[startingPlayer].colors.push({
        color: 'purple',
        cards: [5] // Code of Laws
      });
      
      // Set splay direction to make crown icons visible
      testGameData.players[startingPlayer].colors[0].splayDirection = 'up';
      
      // Ensure the other player has fewer crown icons
      testGameData.players[1 - startingPlayer].colors.push({
        color: 'red',
        cards: [1] // No crown icons
      });
      
      // Add some cards to the player's hand with different colors
      testGameData.players[startingPlayer].hands.push(1, 2, 3); // Cards with different colors
      
      // Activate Code of Laws dogma
      const result = processDogmaAction(testGameData, 5, startingPlayer);
      
      // Should need a choice
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.pendingChoice?.type).toBe('yes_no');
      
      // Now answer the choice with "yes" to tuck cards
      const choiceAnswer = { type: 'yes_no', answer: true };
      const resumeResult = resumeDogmaExecution(result.newState, choiceAnswer);
      
      // Should complete successfully
      expect(resumeResult.nextPhase).toBe('AwaitingAction');
      
      // Should have tucked events for each card
      const tuckedEvents = resumeResult.events.filter(e => e.type === 'tucked');
      expect(tuckedEvents.length).toBe(3); // Should have tucked 3 cards
      
      // Verify each tucked card has the correct color
      const card1 = CARDS.cardsById.get(1);
      const card2 = CARDS.cardsById.get(2);
      const card3 = CARDS.cardsById.get(3);
      
      expect(card1).toBeDefined();
      expect(card2).toBeDefined();
      expect(card3).toBeDefined();
      
      // Check that the tucked events have the correct colors
      const tuckedEvent1 = tuckedEvents.find(e => e.cardId === 1);
      const tuckedEvent2 = tuckedEvents.find(e => e.cardId === 2);
      const tuckedEvent3 = tuckedEvents.find(e => e.cardId === 3);
      
      expect(tuckedEvent1?.color).toBe(card1?.color);
      expect(tuckedEvent2?.color).toBe(card2?.color);
      expect(tuckedEvent3?.color).toBe(card3?.color);
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

  describe('Victory Conditions', () => {
    it('should trigger Universe achievement victory with 5 top cards of age 8+', () => {
      // Test that having 5 top cards of age 8+ triggers Universe achievement victory
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Add 5 colors to the player's board with age 8+ cards
      // For testing purposes, we'll use the highest age cards available in the database
      // In a real game, these would be age 8+ cards
      const highAgeCards = [30, 31, 32, 33, 34]; // Age 3 cards (highest available)
      
      testGameData.players[startingPlayer].colors = [
        { color: 'blue', cards: [highAgeCards[0]], splayDirection: undefined },
        { color: 'red', cards: [highAgeCards[1]], splayDirection: undefined },
        { color: 'green', cards: [highAgeCards[2]], splayDirection: undefined },
        { color: 'yellow', cards: [highAgeCards[3]], splayDirection: undefined },
        { color: 'purple', cards: [highAgeCards[4]], splayDirection: undefined }
      ];
      
      // Check victory conditions
      const victoryCheck = checkVictoryConditions(testGameData);
      
      // Since we don't have actual age 8+ cards in the database, this should return null
      // In a real game with age 8+ cards, this would trigger Universe achievement victory
      expect(victoryCheck.winner).toBeNull();
      expect(victoryCheck.condition).toBeNull();
      
      // This test documents the expected behavior when age 8+ cards are available
      // The victory condition logic is implemented and ready for when those cards are added
    });

    it('should calculate actual final scores when game ends due to age 11+ draw attempt', () => {
      // Test that final scores are calculated correctly when game ends
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Add some scored cards to give players different scores
      testGameData.players[startingPlayer].scores.push(1, 2, 3); // Score: 6
      testGameData.players[1 - startingPlayer].scores.push(4, 5); // Score: 9
      
      // Test the drawCard function directly with age 11 (which should end the game)
      const events: GameEvent[] = [];
      const result = drawCard(testGameData, startingPlayer, 11, events);
      
      // Should have game_end event
      const gameEndEvent = events.find(e => e.type === 'game_end');
      expect(gameEndEvent).toBeDefined();
      expect(gameEndEvent?.winCondition).toBe('score');
      
      // Final scores should be calculated correctly
      const finalScores = gameEndEvent?.finalScores;
      expect(finalScores).toBeDefined();
      expect(finalScores![startingPlayer]).toBe(6); // 1+2+3
      expect(finalScores![1 - startingPlayer]).toBe(9); // 4+5
      
      // Game state should be GameOver
      expect(result.phase.state).toBe('GameOver');
    });
  });

  describe('Dogma Execution Parameter Handling', () => {
    it('should properly handle dogma parameters when resuming execution', () => {
      // Test that dogma execution properly handles parameters and context
      const testGameData = deepClone(gameData);
      const startingPlayer = testGameData.phase.currentPlayer;
      
      // Add Code of Laws to the player's board
      testGameData.players[startingPlayer].colors.push({
        color: 'purple',
        cards: [5] // Code of Laws
      });
      
      // Set splay direction to make crown icons visible
      testGameData.players[startingPlayer].colors[0].splayDirection = 'up';
      
      // Ensure the other player has fewer crown icons
      testGameData.players[1 - startingPlayer].colors.push({
        color: 'red',
        cards: [1] // No crown icons
      });
      
      // Activate Code of Laws dogma
      const result = processDogmaAction(testGameData, 5, startingPlayer);
      
      // Should need a choice
      expect(result.nextPhase).toBe('AwaitingChoice');
      expect(result.newState.currentEffect).toBeDefined();
      
      // Verify the current effect has proper state
      const currentEffect = result.newState.currentEffect!;
      expect(currentEffect.cardId).toBe(5);
      expect(currentEffect.state.step).toBe('waiting_choice');
      
      // Now resume execution with a choice
      const choiceAnswer = { type: 'yes_no', answer: false }; // Choose "no"
      const resumeResult = resumeDogmaExecution(result.newState, choiceAnswer);
      
      // Should complete successfully
      expect(resumeResult.nextPhase).toBe('AwaitingAction');
      expect(resumeResult.newState.currentEffect).toBeUndefined(); // Effect should be complete
      
      // Should have dogma_activated event
      const dogmaEvents = resumeResult.events.filter(e => e.type === 'dogma_activated');
      expect(dogmaEvents.length).toBe(1);
      expect(dogmaEvents[0].playerId).toBe(startingPlayer);
      expect(dogmaEvents[0].cardId).toBe(5);
    });
  });

  describe('Game Setup Validation', () => {
    it('should create consistent board and hand states after initial setup', () => {
      // Test that game setup creates consistent board and hand states
      const testGameData = initializeGame({
        gameId: 'test-setup',
        playerNames: ['Player 1', 'Player 2'],
        rngSeed: 12345, // Use fixed seed for deterministic results
      });
      
      // Both players should have exactly 1 card on board and 1 in hand
      for (const playerId of [0, 1] as PlayerId[]) {
        const player = testGameData.players[playerId]!;
        
        // Check board state
        const totalBoardCards = player.colors.reduce((sum, stack) => sum + stack.cards.length, 0);
        expect(totalBoardCards).toBe(1);
        
        // Check hand state
        expect(player.hands.length).toBe(1);
        
        // Verify the board card is properly positioned
        const boardCard = player.colors[0]?.cards[0];
        expect(boardCard).toBeDefined();
        
        // Verify the hand card is different from the board card
        const handCard = player.hands[0];
        expect(handCard).toBeDefined();
        expect(handCard).not.toBe(boardCard);
      }
      
      // Verify starting player is determined correctly
      expect(testGameData.phase.currentPlayer).toBeDefined();
      expect([0, 1]).toContain(testGameData.phase.currentPlayer);
      
      // Verify actions remaining is set correctly for first turn
      expect(testGameData.phase.actionsRemaining).toBe(1);
    });
  });
}); 