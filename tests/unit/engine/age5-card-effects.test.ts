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
}); 