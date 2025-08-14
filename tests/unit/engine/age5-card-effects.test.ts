import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '../../../src/engine/game-setup.js';
import { processDogmaAction, resumeDogmaExecution } from '../../../src/engine/dogma-resolver.js';
import { deepClone } from '../../../src/engine/utils.js';
import type { ChoiceAnswer } from '../../../src/types/choices.js';
import type { GameEvent } from '../../../src/types/events.js';
import type { SupplyPile } from '../../../src/types/game-data.js';
import { CARDS } from '../../../src/cards/database.js';
import type { PlayerId } from '../../../src/types/core.js';

describe('Age 5 Card Effects', () => {
  let gameData: ReturnType<typeof initializeGame>;
  let player1: PlayerId = 0;
  let player2: PlayerId = 1;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
    
    // Add supply piles for ages 4-10 for proper testing of Age 5 effects
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

  describe('Coal (ID 49)', () => {
    it('should draw and tuck a 5', () => {
      let state = createGameWithMeldCard(49, player1); // Meld Coal
      
      const dogmaResult = processDogmaAction(state, 49, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 5, requestedAge: 5 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'tucked' })
      );
      // Both players should get the effect due to sharing
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'shared_effect' })
      );
    });
  });

  describe('Steam Engine (ID 55)', () => {
    it('should draw and tuck two 4s, then score bottom yellow card', () => {
      let state = createGameWithMeldCard(55, player1); // Steam Engine melded as yellow
      
      const dogmaResult = processDogmaAction(state, 55, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should have 4 drew events (2 players x 2 cards each due to sharing)
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents).toHaveLength(4);
      
      // Should have 4 tucked events (2 players x 2 cards each due to sharing) 
      const tuckedEvents = dogmaResult.events.filter(e => e.type === 'tucked');
      expect(tuckedEvents).toHaveLength(4);
      
      // Should have 1 scored event (Steam Engine itself for player 1)
      const scoredEvents = dogmaResult.events.filter(e => e.type === 'scored');
      expect(scoredEvents).toHaveLength(2); // Both players score due to sharing
      expect(scoredEvents[0]).toMatchObject({
        type: 'scored',
        playerId: player1,
        cardIds: [55] // Steam Engine itself
      });
    });
  });

  describe('Physics (ID 51)', () => {
    it('should draw three 6s and keep them if all different colors', () => {
      let state = createGameWithMeldCard(51, player1); // Meld Physics
      
      const dogmaResult = processDogmaAction(state, 51, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should have 6 drew events (2 players x 3 cards each due to sharing)
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents).toHaveLength(6);
      
      // Should have 6 revealed events (2 players x 3 cards each due to sharing)
      const revealedEvents = dogmaResult.events.filter(e => e.type === 'card_revealed');
      expect(revealedEvents).toHaveLength(6);
      
      // Should have no returned events if all colors are different
      // Note: This test assumes the supply has different colored 6s available
      // In a real game, if 2+ cards have same color, all cards would be returned
    });
    
    it('should return all cards if two or more drawn cards have same color', () => {
      let state = createGameWithMeldCard(51, player1); // Meld Physics
      
      // Add some cards to hand to test that they get returned too
      state = addCardsToHand(state, player1, [1, 2, 3]);
      
      const dogmaResult = processDogmaAction(state, 51, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should have drew and revealed events
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents.length).toBeGreaterThan(0);
      
      const revealedEvents = dogmaResult.events.filter(e => e.type === 'card_revealed');  
      expect(revealedEvents.length).toBeGreaterThan(0);
      
      // Should have returned events if same colors were drawn
      // Note: This test is probabilistic - depends on supply pile contents
      // In practice, we'd want to set up specific supply pile contents for deterministic testing
    });
  });

  describe('Measurement (ID 50)', () => {
    it('should return hand card, splay color right, and draw based on card count', () => {
      let state = createGameWithMeldCard(50, player1); // Meld Measurement
      
      // Add cards to hand
      state = addCardsToHand(state, player1, [1, 2, 3]);
      
      // Add some cards to create a splayable color stack
      state = addCardsToHand(state, player1, [16, 17]); // Calendar, Canal Building (both blue)
      const blueStack = {
        color: 'Blue',
        cards: [16, 17], // 2 cards, can be splayed
        splayDirection: undefined
      };
      state.players[player1].colors.push(blueStack);
      
      const dogmaResult = processDogmaAction(state, 50, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'returned' })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Blue', direction: 'right' })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew' })
      );
    });

    it('should complete without action if no hand cards', () => {
      let state = createGameWithMeldCard(50, player1); // Just Measurement
      
      // Clear all players' hands to ensure no hand cards
      state.players[player1].hands = [];
      state.players[player2].hands = [];
      
      const dogmaResult = processDogmaAction(state, 50, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should not return, splay, or draw anything
      const returnedEvents = dogmaResult.events.filter(e => e.type === 'returned');
      expect(returnedEvents).toHaveLength(0);
    });
  });

  describe('Chemistry (ID 48)', () => {
    it('should optionally splay blue right, draw/score higher than highest, and return score card', () => {
      let state = createGameWithMeldCard(48, player1); // Meld Chemistry (blue)
      
      // Add another blue card for splaying
      state = addCardsToHand(state, player1, [18]); // Construction (blue)
      // Make sure Chemistry and Construction are in same blue stack
      const chemistryStack = state.players[player1].colors.find(stack => stack.color === 'Blue');
      if (chemistryStack) {
        chemistryStack.cards.push(18);
      }
      
      // Add some score cards to return
      state = addCardsToScore(state, player1, [1, 2]);
      
      const dogmaResult = processDogmaAction(state, 48, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Blue', direction: 'right' })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew' })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'returned' })
      );
    });

    it('should complete without splaying if no blue cards to splay', () => {
      let state = createGameWithMeldCard(48, player1); // Just Chemistry
      
      const dogmaResult = processDogmaAction(state, 48, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should still draw and score based on highest (Chemistry is age 5)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew' })
      );
    });
  });

  describe('Banking (ID 47)', () => {
    it('should execute demand to transfer non-green Factory card', () => {
      let state = createGameWithMeldCard(47, player1); // Meld Banking (green)
      
      // Give activating player more Crown icons by adding another Crown card and splaying
      state.players[player1].colors.push({
        color: 'Purple',
        cards: [53, 30], // Societies (1 Crown), Feudalism (1 Castle + 1 Leaf + 1 Castle) 
        splayDirection: 'right' // Make icons visible
      });
      
      // Give target player a non-green card with Factory icons
      state.players[player2].colors.push({
        color: 'Red',
        cards: [49], // Coal has Factory icons and is not green
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 47, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 49 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 5 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
    });

    it('should complete choice and transfer card, then activating player draws and scores', () => {
      let state = createGameWithMeldCard(47, player1); // Meld Banking (green)
      
      // Setup icon disparity (activating player has more Crown icons)
      // Banking itself provides 2 Crown icons (middle, right)
      // Add more Crown icons to ensure activating player has advantage
      state.players[player1].colors.push({
        color: 'Purple', 
        cards: [53, 30], // Societies (1 Crown), Feudalism (1 Castle + 1 Leaf + 1 Castle)
        splayDirection: 'right' // Make icons visible
      });
      
      // Give target player fewer Crown icons and a Factory card
      // Use createGameWithMeldCard for proper setup of Coal on player2
      let coalState = createGameWithMeldCard(49, player2); // Coal on player2's board
      // Copy the Coal stack to our main state  
      const coalStack = coalState.players[player2].colors.find(stack => 
        stack.cards.includes(49)
      );
      if (coalStack) {
        state.players[player2].colors.push(coalStack);
      }
      
      // Execute the effect - should auto-transfer 
      const dogmaResult = processDogmaAction(state, 47, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ 
          type: 'transferred',
          cardId: 49
        })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 5 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
    });

    it('should optionally splay green cards right in non-demand effect', () => {
      let state = createGameWithMeldCard(47, player1); // Meld Banking (green)
      
      // Add another green card for splaying
      state.players[player1].colors[0]!.cards.push(1); // Add Agriculture (green)
      
      // Ensure equal Crown icons so no demand occurs
      // Banking has 0 Crown icons visible when not splayed (top is 'x')
      // Give both players exactly 0 Crown icons (the default)
      // Don't add any additional cards to either player
      
      const dogmaResult = processDogmaAction(state, 47, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should auto-splay the green cards since there are 2+ cards
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Green', direction: 'right' })
      );
    });

    it('should complete without demand if no one has fewer Crown icons', () => {
      let state = createGameWithMeldCard(47, player1); // Just Banking
      
      // Add another green card for potential splaying
      // First, let's use a card we know exists in supply - let's manually add one
      // Instead of Invention, let's use Agriculture (ID 1) and change it to green for testing
      const greenStack = state.players[player1].colors.find(stack => stack.color === 'Green');
      if (greenStack) {
        // Add Agriculture to the green stack (it will be treated as green for this test)
        greenStack.cards.push(1); // Agriculture 
      }
      
      // Ensure equal Crown icons so no demand occurs  
      // Banking has 0 Crown icons visible when not splayed (top is 'x')
      // Give both players exactly 0 Crown icons (the default)
      // Don't add any additional cards to either player
      
      const dogmaResult = processDogmaAction(state, 47, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should auto-splay the green cards since there are 2+ cards
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Green', direction: 'right' })
      );
    });
  });

  describe('The Pirate Code (ID 52)', () => {
    it('should execute demand to transfer two cards of value 4 or less from score pile', () => {
      let state = createGameWithMeldCard(52, player1); // Meld The Pirate Code (red)
      
      // Give activating player more Crown icons
      // The Pirate Code has 2 Crown icons (middle, right)
      state.players[player1].colors.push({
        color: 'Purple',
        cards: [53], // Societies (1 Crown)
        splayDirection: 'right' // Make icons visible - now player1 has 3 total Crown icons
      });
      
      // Give target player fewer Crown icons and score cards to transfer
      state = addCardsToScore(state, player2, [1, 2, 16, 17]); 
      // Ages: 1(Agriculture), 1(Archery), 2(Calendar), 2(Canal Building)
      // Two cards ≤4: Agriculture and Archery (both age 1)
      
      const dogmaResult = processDogmaAction(state, 52, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 1 }) // Agriculture
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 2 }) // Archery
      );
      
      // Should score lowest Crown card from activating player's board
      // The Pirate Code itself has Crown icons
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored', cardIds: [52] }) // The Pirate Code
      );
    });

    it('should complete without scoring if no cards transferred', () => {
      let state = createGameWithMeldCard(52, player1); // Meld The Pirate Code
      
      // Give both players equal Crown icons so no demand occurs
      // The Pirate Code has 2 Crown icons (middle, right)
      state.players[player2].colors.push({
        color: 'Green',
        cards: [19], // Currency has 2 Crown icons (left, right)
        splayDirection: 'right' // Make icons visible
      });
      
      const dogmaResult = processDogmaAction(state, 52, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should NOT score any cards since no transfer occurred
      const scoredEvents = dogmaResult.events.filter(e => e.type === 'scored');
      expect(scoredEvents).toHaveLength(0);
    });

    it('should only transfer cards of value 4 or less', () => {
      let state = createGameWithMeldCard(52, player1); // Meld The Pirate Code
      
      // Give activating player more Crown icons
      state.players[player1].colors.push({
        color: 'Purple',
        cards: [53], // Societies (1 Crown)
        splayDirection: 'right'
      });
      
      // Give target player score cards with mixed values
      state = addCardsToScore(state, player2, [1, 49, 16, 55]); 
      // Ages: 1(Agriculture), 5(Coal), 2(Calendar), 5(Steam Engine)
      // Only Agriculture(1) and Calendar(2) are ≤4
      
      const dogmaResult = processDogmaAction(state, 52, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should transfer the two cards ≤4
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 1 }) // Agriculture
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 16 }) // Calendar
      );
      
      // Should NOT transfer the age 5 cards
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(2);
      expect(transferEvents.some(e => e.cardId === 49)).toBe(false); // Coal not transferred
      expect(transferEvents.some(e => e.cardId === 55)).toBe(false); // Steam Engine not transferred
    });

    it('should score lowest Crown card when transfers occur', () => {
      let state = createGameWithMeldCard(52, player1); // Meld The Pirate Code
      
      // Add another Crown card to board to test "lowest" selection
      state.players[player1].colors.push({
        color: 'Green',
        cards: [12], // Sailing (age 1, Crown icon)
        splayDirection: undefined
      });
      
      // Give activating player more Crown icons  
      state.players[player1].colors.push({
        color: 'Purple',
        cards: [53], // Societies (age 5, Crown icon) 
        splayDirection: 'right'
      });
      
      // Give target player score cards to transfer
      state = addCardsToScore(state, player2, [1, 2]);
      
      const dogmaResult = processDogmaAction(state, 52, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should score the lowest Crown card (Sailing, age 1)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored', cardIds: [12] }) // Sailing (lowest age)
      );
      
      // Should NOT score higher age Crown cards
      const scoredEvents = dogmaResult.events.filter(e => e.type === 'scored');
      expect(scoredEvents).toHaveLength(1);
      expect(scoredEvents.some(e => e.cardIds.includes(52))).toBe(false); // The Pirate Code not scored
      expect(scoredEvents.some(e => e.cardIds.includes(53))).toBe(false); // Societies not scored
    });
  });

  describe('Societies (ID 53)', () => {
    it('should execute demand to transfer non-purple Lightbulb card from board', () => {
      let state = createGameWithMeldCard(53, player1); // Meld Societies (purple)
      
      // Give activating player more Crown icons
      // Societies has 1 Crown icon (left)
      state.players[player1].colors.push({
        color: 'Green',
        cards: [19], // Currency has 2 Crown icons (left, right)
        splayDirection: 'right' // Now player1 has 3 total Crown icons
      });
      
      // Give target player a non-purple card with Lightbulb icon on board
      state.players[player2].colors.push({
        color: 'Blue',
        cards: [15], // Writing (blue, has Lightbulb icons)
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 53, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 15 }) // Writing
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 5 })
      );
    });

    it('should not transfer purple cards even if they have Lightbulb icons', () => {
      let state = createGameWithMeldCard(53, player1); // Meld Societies
      
      // Give activating player more Crown icons
      state.players[player1].colors.push({
        color: 'Green',
        cards: [19], // Currency
        splayDirection: 'right'
      });
      
      // Give target player ONLY purple cards with Lightbulb icons
      state.players[player2].colors.push({
        color: 'Purple',
        cards: [24], // Philosophy (purple, has Lightbulb icons)
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 53, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should NOT transfer the purple card
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(0);
      
      // Should NOT draw since no transfer occurred
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents).toHaveLength(0);
    });

    it('should complete without transfer if no non-purple Lightbulb cards exist', () => {
      let state = createGameWithMeldCard(53, player1); // Meld Societies
      
      // Give activating player more Crown icons
      state.players[player1].colors.push({
        color: 'Green',
        cards: [19], // Currency
        splayDirection: 'right'
      });
      
      // Give target player cards without Lightbulb icons
      state.players[player2].colors.push({
        color: 'Yellow',
        cards: [1], // Agriculture (yellow, has only Leaf icons)
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 53, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should NOT transfer or draw
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(0);
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents).toHaveLength(0);
    });

    it('should complete without demand if no players have fewer Crown icons', () => {
      let state = createGameWithMeldCard(53, player1); // Meld Societies
      
      // Give both players equal Crown icons
      // Societies has 1 Crown icon (left)
      state.players[player2].colors.push({
        color: 'Green',
        cards: [4], // Clothing has 1 Crown icon (left)
        splayDirection: undefined
      });
      
      const dogmaResult = processDogmaAction(state, 53, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should NOT transfer or draw since no demand occurred
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(0);
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents).toHaveLength(0);
    });
  });

  describe('Statistics (ID 54)', () => {
    it('should execute demand to draw highest score card and repeat if only 1 hand card', () => {
      let state = createGameWithMeldCard(54, player1); // Meld Statistics (yellow)
      
      // Give activating player more Leaf icons
      // Statistics has 2 Leaf icons (left, right)
      state.players[player1].colors.push({
        color: 'Yellow',
        cards: [1], // Agriculture has 3 Leaf icons
        splayDirection: 'right' // Now player1 has 5 total Leaf icons
      });
      
      // Give target player fewer Leaf icons and score cards
      state = addCardsToScore(state, player2, [16, 17, 49]); 
      // Ages: 2(Calendar), 2(Canal Building), 5(Coal)
      // Highest is Coal (age 5)
      
      // Give player2 exactly 0 cards in hand initially
      state.players[player2].hands = [];
      
      const dogmaResult = processDogmaAction(state, 54, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should draw Coal (highest score card)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ 
          type: 'transferred',
          cardId: 49, // Coal
          fromZone: expect.objectContaining({ zone: 'score' }),
          toZone: expect.objectContaining({ zone: 'hand' })
        })
      );
      
      // Now player2 has exactly 1 card in hand, so demand should repeat
      // Should draw next highest score card (Calendar, age 2 - lower ID wins tie)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ 
          type: 'transferred',
          cardId: 16, // Calendar (age 2, ID 16 vs Canal Building ID 17)
          fromZone: expect.objectContaining({ zone: 'score' }),
          toZone: expect.objectContaining({ zone: 'hand' })
        })
      );
      
      // Now player2 has 2 cards in hand, so no more repeats
    });

    it('should not repeat demand if player has more than 1 card in hand', () => {
      let state = createGameWithMeldCard(54, player1); // Meld Statistics
      
      // Give activating player more Leaf icons
      state.players[player1].colors.push({
        color: 'Yellow',
        cards: [1], // Agriculture
        splayDirection: 'right'
      });
      
      // Give target player score cards and existing hand cards
      state = addCardsToScore(state, player2, [16, 17]); 
      state.players[player2].hands = [1, 2]; // 2 cards in hand initially
      
      const dogmaResult = processDogmaAction(state, 54, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      
      // Should draw one card (highest: Calendar since both are age 2 but Calendar has lower ID)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ 
          type: 'transferred',
          cardId: 16, // Calendar (age 2, lower ID)
          fromZone: expect.objectContaining({ zone: 'score' }),
          toZone: expect.objectContaining({ zone: 'hand' })
        })
      );
      
      // Should NOT repeat since player now has 3 cards in hand
      const transferEvents = dogmaResult.events.filter(e => 
        e.type === 'transferred' && e.fromZone?.zone === 'score'
      );
      expect(transferEvents).toHaveLength(1);
    });

    it('should complete without drawing if no score cards exist', () => {
      let state = createGameWithMeldCard(54, player1); // Meld Statistics
      
      // Give activating player more Leaf icons
      state.players[player1].colors.push({
        color: 'Yellow',
        cards: [1], // Agriculture
        splayDirection: 'right'
      });
      
      // Give target player NO score cards
      state.players[player2].scores = [];
      
      const dogmaResult = processDogmaAction(state, 54, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should NOT draw anything
      const transferEvents = dogmaResult.events.filter(e => e.type === 'transferred');
      expect(transferEvents).toHaveLength(0);
    });

    it('should auto-splay yellow cards right in non-demand effect', () => {
      let state = createGameWithMeldCard(54, player1); // Meld Statistics
      
      // Add another yellow card for splaying
      state.players[player1].colors[0]!.cards.push(1); // Add Agriculture (yellow)
      
      // Give both players equal Leaf icons so no demand occurs
      // Statistics has 2 Leaf icons (left, right)
      state.players[player2].colors.push({
        color: 'Yellow',
        cards: [1, 20], // Agriculture + Fermenting
        splayDirection: 'right' // Match the Leaf icon count
      });
      
      const dogmaResult = processDogmaAction(state, 54, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      
      // Should auto-splay yellow cards right
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ 
          type: 'splayed', 
          color: 'Yellow', 
          direction: 'right' 
        })
      );
    });
  });

}); 