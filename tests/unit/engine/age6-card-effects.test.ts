import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame, processDogmaAction, resumeDogmaExecution } from '../../../src/engine/index.js';
import { deepClone } from '../../../src/engine/utils.js';
import type { ChoiceAnswer } from '../../../src/types/choices.js';
import type { GameEvent } from '../../../src/types/events.js';
import type { SupplyPile } from '../../../src/types/game-data.js';
import { CARDS } from '../../../src/cards/database.js';
import type { PlayerId } from '../../../src/types/index.js';

describe('Age 6 Card Effects', () => {
  let gameData: ReturnType<typeof initializeGame>;
  let player1: PlayerId = 0;
  let player2: PlayerId = 1;

  beforeEach(() => {
    gameData = initializeGame({ playerCount: 2 });
    
    // Add supply piles for ages 4-10 for proper age fallback
    const additionalSupplyPiles: SupplyPile[] = [
      { age: 4, cards: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45] },
      { age: 5, cards: [46, 47, 48, 49, 50, 51, 52, 53, 54, 55] },
      { age: 6, cards: [56, 57, 58, 59, 60, 61, 62, 63, 64, 65] },
      { age: 7, cards: [66, 67, 68, 69, 70, 71, 72, 73, 74, 75] },
      { age: 8, cards: [76, 77, 78, 79, 80, 81, 82, 83, 84, 85] },
      { age: 9, cards: [86, 87, 88, 89, 90, 91, 92, 93, 94, 95] },
      { age: 10, cards: [96, 97, 98, 99, 100, 101, 102, 103, 104, 105] }
    ];
    gameData.shared.supplyPiles.push(...additionalSupplyPiles);
  });

  // Helper function to create a game state with a specific card melded for a player
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
    const newState = deepClone(state);
    for (const cardId of cardIds) {
      // Remove from supply and add to hand
      for (const pile of newState.shared.supplyPiles) {
        const cardIndex = pile.cards.indexOf(cardId);
        if (cardIndex !== -1) {
          pile.cards.splice(cardIndex, 1);
          newState.players[playerId].hands.push(cardId);
          break;
        }
      }
    }
    return newState;
  }

  // Helper function to add cards to a player's score pile
  function addCardsToScore(state: typeof gameData, playerId: PlayerId, cardIds: number[]) {
    const newState = deepClone(state);
    for (const cardId of cardIds) {
      // Remove from supply and add to score
      for (const pile of newState.shared.supplyPiles) {
        const cardIndex = pile.cards.indexOf(cardId);
        if (cardIndex !== -1) {
          pile.cards.splice(cardIndex, 1);
          newState.players[playerId].scores.push(cardId);
          break;
        }
      }
    }
    return newState;
  }

  describe('Atomic Theory (ID 56)', () => {
    it('should offer choice to splay blue right and then draw/meld a 7', () => {
      let state = createGameWithMeldCard(56, player1); // Meld Atomic Theory (blue)
      
      // Add another blue card for splaying
      state = addCardsToHand(state, player1, [48]); // Chemistry (blue)
      // Make sure Atomic Theory and Chemistry are in same blue stack
      const atomicTheoryStack = state.players[player1].colors.find(stack => stack.color === 'Blue');
      if (atomicTheoryStack) {
        atomicTheoryStack.cards.push(48);
      }
      
      const dogmaResult = processDogmaAction(state, 56, player1);
      
      // Should be awaiting choice for splaying
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice).toMatchObject({
        type: 'yes_no',
        prompt: 'You may splay your blue cards right.'
      });
      
      // Test accepting the splay choice
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'yes_no',
        answer: true
      });
      
      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Blue', direction: 'right' })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 7 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'melded' })
      );
    });

    it('should skip splaying if player chooses no and still draw/meld 7', () => {
      let state = createGameWithMeldCard(56, player1); // Meld Atomic Theory (blue)
      
      // Add another blue card for splaying
      state = addCardsToHand(state, player1, [48]); // Chemistry (blue)
      const atomicTheoryStack = state.players[player1].colors.find(stack => stack.color === 'Blue');
      if (atomicTheoryStack) {
        atomicTheoryStack.cards.push(48);
      }
      
      const dogmaResult = processDogmaAction(state, 56, player1);
      
      // Test declining the splay choice
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'yes_no',
        answer: false
      });
      
      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      // Should not splay
      expect(choiceResult.events).not.toContainEqual(
        expect.objectContaining({ type: 'splayed' })
      );
      // Should still draw and meld
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 7 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'melded' })
      );
    });

    it('should skip choice and draw/meld 7 if no blue cards to splay', () => {
      let state = createGameWithMeldCard(56, player1); // Just Atomic Theory
      
      const dogmaResult = processDogmaAction(state, 56, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 7 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'melded' })
      );
    });
  });

  describe('Machine Tools (ID 63)', () => {
    it('should draw and score a card equal to the highest score card value', () => {
      let state = createGameWithMeldCard(63, player1); // Meld Machine Tools
      
      // Add cards to score pile
      state = addCardsToScore(state, player1, [1, 16, 3]); // Writing (age 1), Calendar (age 2), City States (age 1)
      
      const dogmaResult = processDogmaAction(state, 63, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should draw and score a card of age 2 (highest score card is Calendar with age 2)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 2, requestedAge: 2 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
    });

    it('should complete without action if no score cards', () => {
      let state = createGameWithMeldCard(63, player1); // Just Machine Tools
      
      const dogmaResult = processDogmaAction(state, 63, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should not draw or score anything
      const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
      expect(drewEvents).toHaveLength(0);
      const scoredEvents = dogmaResult.events.filter(e => e.type === 'scored');
      expect(scoredEvents).toHaveLength(0);
    });
  });
}); 