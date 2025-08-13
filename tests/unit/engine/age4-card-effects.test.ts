import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame, processDogmaAction, resumeDogmaExecution } from '../../../src/engine/index.js';
import { countIcons } from '../../../src/engine/state-manipulation.js';
import { deepClone } from '../../../src/engine/utils.js';
import type { ChoiceAnswer } from '../../../src/types/choices.js';
import type { GameEvent } from '../../../src/types/events.js';
import type { SupplyPile } from '../../../src/types/game-data.js';
import { CARDS } from '../../../src/cards/database.js';
import type { PlayerId } from '../../../src/types/index.js';

describe('Age 4 Card Effects', () => {
  let gameData: ReturnType<typeof initializeGame>;
  let player1: PlayerId = 0;
  let player2: PlayerId = 1;

  beforeEach(() => {
    gameData = initializeGame({
      gameId: 'test-game',
      playerNames: ['Player 1', 'Player 2'],
      rngSeed: 12345,
    });
    
    // Add supply piles for ages 4-10 for proper testing of Age 4 effects
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

  describe('Experimentation (ID 39)', () => {
    it('should draw and meld a 5', () => {
      let state = createGameWithMeldCard(39, player1); // Meld Experimentation
      
      const dogmaResult = processDogmaAction(state, 39, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      // Now with proper supply piles, it should draw from age 5 as requested
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 5, requestedAge: 5 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'melded' })
      );
      // Both players should get the effect due to sharing
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'shared_effect' })
      );
    });
  });

  describe('Invention (ID 41)', () => {
    it('should splay red or yellow right if currently splayed left, then draw and score a 4', () => {
      let state = createGameWithMeldCard(41, player1); // Meld Invention
      
      // Add some red cards splayed left to player 1's board
      state = addCardsToHand(state, player1, [2, 7]); // Archery (red), Masonry (red)
      const redColorStack = {
        color: 'Red',
        cards: [2, 7], // Archery, Masonry
        splayDirection: 'left' as const
      };
      state.players[player1].colors.push(redColorStack);
      
      const dogmaResult = processDogmaAction(state, 41, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice?.type).toBe('select_pile');
      expect(dogmaResult.pendingChoice?.playerId).toBe(player1);

      // Player 1 chooses to splay red right
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_pile',
        choiceId: `invention_splay_${player1}`,
        playerId: player1,
        selectedColor: 'Red',
        timestamp: Date.now()
      });

      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Red', direction: 'right' })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 4 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
    });

    it('should complete immediately if no colors are splayed left', () => {
      let state = createGameWithMeldCard(41, player1); // Meld Invention
      
      const dogmaResult = processDogmaAction(state, 41, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should not draw/score since no splay occurred
      expect(dogmaResult.events).not.toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 4 })
      );
    });
  });

  describe('Colonialism (ID 37)', () => {
    it('should draw and tuck a 3', () => {
      let state = createGameWithMeldCard(37, player1); // Meld Colonialism
      
      const dogmaResult = processDogmaAction(state, 37, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 3, requestedAge: 3 })
      );
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'tucked' })
      );
    });
  });

  describe('Navigation (ID 42)', () => {
    it('should complete without demand when both players have equal Crown icons', () => {
      let state = createGameWithMeldCard(42, player1); // Meld Navigation
      state = addCardsToScore(state, player2, [16, 17, 1]); // Add some score cards
      
      const dogmaResult = processDogmaAction(state, 42, player1);
      
      // Navigation should complete without offering choice since both players
      // get equal Crown icons from sharing Navigation effect
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
    });
  });

  describe('Navigation (ID 42) - When Implemented', () => {
    it.skip('should complete immediately if opponent has no age 2 or 3 cards in score', () => {
      let state = createGameWithMeldCard(42, player1); // Meld Navigation
      state = addCardsToScore(state, player2, [1, 2]); // Add only age 1 cards to score
      
      const dogmaResult = processDogmaAction(state, 42, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
    });
  });

  describe('Perspective (ID 43)', () => {
    it('should offer optional choice to return hand card and score based on Lightbulb icons', () => {
      let state = createGameWithMeldCard(43, player1); // Meld Perspective (has 2 Lightbulb icons)
      
      // Add cards to hand
      state = addCardsToHand(state, player1, [1, 2, 3]); // Some cards to return/score
      
      const dogmaResult = processDogmaAction(state, 43, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice?.type).toBe('select_cards');
      expect(dogmaResult.pendingChoice?.playerId).toBe(player1);

      // Player 1 chooses to return a card
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_cards',
        choiceId: `perspective_return_${player1}`,
        playerId: player1,
        selectedCards: [1], // Return Writing
        timestamp: Date.now()
      });

      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'returned', cardId: 1 })
      );
      // Should score 1 card (2 Lightbulb icons / 2 = 1 card)
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
    });

    it('should complete without scoring if player chooses not to return card', () => {
      let state = createGameWithMeldCard(43, player1); // Meld Perspective
      state = addCardsToHand(state, player1, [1, 2]); // Some cards in hand
      
      const dogmaResult = processDogmaAction(state, 43, player1);
      
      // Player chooses not to return a card (selects 0 cards)
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_cards',
        choiceId: `perspective_return_${player1}`,
        playerId: player1,
        selectedCards: [], // Return no cards
        timestamp: Date.now()
      });

      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      // Should not score any cards
      const scoredEvents = choiceResult.events.filter(e => e.type === 'scored');
      expect(scoredEvents).toHaveLength(0);
    });
  });

  describe('Printing Press (ID 44)', () => {
    it('should offer optional choices for returning score card and splaying blue', () => {
      let state = createGameWithMeldCard(44, player1); // Meld Printing Press
      
      // Add cards to score pile
      state = addCardsToScore(state, player1, [1, 2, 3]); 
      
      // Add some blue cards to board for splaying
      state = addCardsToHand(state, player1, [18]); // Construction (blue)
      const blueStack = {
        color: 'Blue',
        cards: [44, 18], // Printing Press + Construction  
        splayDirection: undefined
      };
      state.players[player1].colors.push(blueStack);
      
      const dogmaResult = processDogmaAction(state, 44, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice?.type).toBe('select_cards');
      expect(dogmaResult.pendingChoice?.playerId).toBe(player1);

      // Player 1 chooses to return a score card
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_cards',
        choiceId: `printing_press_return_${player1}`,
        playerId: player1,
        selectedCards: [1], // Return Writing
        timestamp: Date.now()
      });

      // Should proceed to splay choice after drawing
      expect(choiceResult.nextPhase).toBe('AwaitingChoice');
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'returned', cardId: 1 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew' }) // Drew age 2 (0 + 2)
      );
    });

    it('should complete without choices when no score cards and no blue cards', () => {
      let state = createGameWithMeldCard(44, player1); // Just Printing Press
      
      const dogmaResult = processDogmaAction(state, 44, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
    });
  });

  describe('Reformation (ID 45)', () => {
    it('should tuck cards based on Leaf icons and splay yellow/purple right', () => {
      let state = createGameWithMeldCard(45, player1); // Meld Reformation (has 2 Leaf icons)
      
      // Add cards to hand to tuck
      state = addCardsToHand(state, player1, [1, 2, 3]); // Some cards to tuck
      
      // Add some yellow/purple cards for splaying
      state = addCardsToHand(state, player1, [3, 9]); // City States (purple), Mysticism (purple)
      // Meld City States to create a purple stack with 2+ cards
      const cityStatesColorStack = {
        color: 'Purple',
        cards: [3], // City States
        splayDirection: undefined
      };
      state.players[player1].colors.push(cityStatesColorStack);
      
      // Now Reformation and City States should be in separate purple stacks, but let's merge them
      // Find the existing purple stack (Reformation) and add City States to it
      const reformationStack = state.players[player1].colors.find(stack => stack.color === 'Purple');
      if (reformationStack) {
        reformationStack.cards.push(3); // Add City States to the same stack
      }
      
      const dogmaResult = processDogmaAction(state, 45, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should tuck 1 card (2 Leaf icons / 2 = 1 card)
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'tucked' })
      );
      // Should splay purple right
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'splayed', color: 'Purple', direction: 'right' })
      );
    });

    it('should complete without tucking if no hand cards', () => {
      let state = createGameWithMeldCard(45, player1); // Just Reformation
      
      const dogmaResult = processDogmaAction(state, 45, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should not tuck any cards
      const tuckedEvents = dogmaResult.events.filter(e => e.type === 'tucked');
      expect(tuckedEvents).toHaveLength(0);
    });
  });

  // Add tests for actual implementation once we implement the effects
  describe('Perspective (ID 43) - When Implemented', () => {
    it.skip('should return all hand cards and draw and score cards equal to different colors returned', () => {
      // Test will be written when we implement the actual effect
    });
  });

  describe('Printing Press (ID 44) - When Implemented', () => {
    it.skip('should splay purple and blue left if possible, then draw and meld equal to leaves from splayed cards', () => {
      // Test will be written when we implement the actual effect
    });
  });

  describe('Reformation (ID 45) - When Implemented', () => {
    it.skip('should tuck all score cards and draw an equal number of 4s', () => {
      // Test will be written when we implement the actual effect
    });
  });

  /*
  describe('Anatomy (ID 36)', () => {
    it('should demand opponent return a card from score pile and then return equal value card from board', () => {
      let state = createGameWithMeldCard(36, player1); // Meld Anatomy
      state = addCardsToScore(state, player2, [1, 2, 3]); // Add age 1, 2, 3 cards to score
      
      // Add some cards to player 2's board for the second choice
      state = addCardsToHand(state, player2, [6, 7]); // Domestication, Masonry
      state = createGameWithMeldCard(6, player2); // Meld Domestication
      state = createGameWithMeldCard(7, player2); // Meld Masonry

      const dogmaResult = processDogmaAction(state, 36, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice?.type).toBe('select_cards');
      expect(dogmaResult.pendingChoice?.playerId).toBe(player2);
      expect((dogmaResult.pendingChoice as any)?.from).toBe('score');

      // Player 2 chooses to return age 1 card from score
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_cards',
        playerId: player2,
        selectedCards: [1]
      });

      expect(choiceResult.nextPhase).toBe('AwaitingChoice');
      expect(choiceResult.pendingChoice?.type).toBe('select_cards');
      expect(choiceResult.pendingChoice?.playerId).toBe(player2);
      expect((choiceResult.pendingChoice as any)?.from).toBe('board');

      // Player 2 chooses to return age 1 card from board
      const finalResult = resumeDogmaExecution(choiceResult.newState, {
        type: 'select_cards',
        playerId: player2,
        selectedCards: [6] // Domestication (age 1)
      });

      expect(finalResult.nextPhase).toBe('AwaitingAction');
      expect(finalResult.events).toContainEqual(
        expect.objectContaining({ type: 'returned', cardId: 1, fromZone: 'score' })
      );
      expect(finalResult.events).toContainEqual(
        expect.objectContaining({ type: 'returned', cardId: 6, fromZone: 'board' })
      );
    });

    it('should complete immediately if opponent has no score cards', () => {
      let state = createGameWithMeldCard(36, player1); // Meld Anatomy
      // Clear player 2's score pile
      state.players[player2].scores = [];

      const dogmaResult = processDogmaAction(state, 36, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
    });
  });

  describe('Enterprise (ID 38)', () => {
    it('should demand transfer of non-purple Crown card and then draw and meld a 4', () => {
      let state = createGameWithMeldCard(38, player1); // Meld Enterprise
      
      // Add some cards to player 2's board for transfer
      state = addCardsToHand(state, player2, [4, 1, 2]); // Clothing, Writing, Archery
      state = createGameWithMeldCard(4, player2); // Meld Clothing (green Crown card)
      state = createGameWithMeldCard(1, player2); // Meld Writing (blue, no Crown)
      state = createGameWithMeldCard(2, player2); // Meld Archery (red, no Crown)

      const dogmaResult = processDogmaAction(state, 38, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice?.type).toBe('select_cards');
      expect(dogmaResult.pendingChoice?.playerId).toBe(player2);
      expect((dogmaResult.pendingChoice as any)?.from).toBe('board');

      // Player 2 chooses to transfer Clothing (green Crown card)
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_cards',
        playerId: player2,
        selectedCards: [4]
      });

      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 4 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 4 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'melded' })
      );
    });

    it('should complete without transfer if no valid cards to transfer', () => {
      let state = createGameWithMeldCard(38, player1); // Meld Enterprise
      
      // Add only purple Crown cards or non-Crown cards
      state = addCardsToHand(state, player2, [5, 1]); // Code of Laws (purple Crown), Writing (no Crown)
      state = createGameWithMeldCard(5, player2); // Meld Code of Laws (purple Crown)
      state = createGameWithMeldCard(1, player2); // Meld Writing (no Crown)

      const dogmaResult = processDogmaAction(state, 38, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should not draw and meld since no transfer occurred
      expect(dogmaResult.events).not.toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 4 })
      );
    });
  });

  describe('Gunpowder (ID 40)', () => {
    it('should demand transfer of Castle card and then draw and score a 2 if transferred', () => {
      let state = createGameWithMeldCard(40, player1); // Meld Gunpowder
      
      // Add some cards to player 2's board for transfer
      state = addCardsToHand(state, player2, [7, 4]); // Masonry, Clothing
      state = createGameWithMeldCard(7, player2); // Meld Masonry (Castle card)
      state = createGameWithMeldCard(4, player2); // Meld Clothing (no Castle)

      const dogmaResult = processDogmaAction(state, 40, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
      expect(dogmaResult.pendingChoice?.type).toBe('select_cards');
      expect(dogmaResult.pendingChoice?.playerId).toBe(player2);
      expect((dogmaResult.pendingChoice as any)?.from).toBe('board');

      // Player 2 chooses to transfer Masonry (Castle card)
      const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
        type: 'select_cards',
        playerId: player2,
        selectedCards: [7]
      });

      expect(choiceResult.nextPhase).toBe('AwaitingAction');
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'transferred', cardId: 7 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 2 })
      );
      expect(choiceResult.events).toContainEqual(
        expect.objectContaining({ type: 'scored' })
      );
    });

    it('should not draw and score if no Castle card was transferred', () => {
      let state = createGameWithMeldCard(40, player1); // Meld Gunpowder
      
      // Add only non-Castle cards
      state = addCardsToHand(state, player2, [4, 1]); // Clothing, Writing
      state = createGameWithMeldCard(4, player2); // Meld Clothing (no Castle)
      state = createGameWithMeldCard(1, player2); // Meld Writing (no Castle)

      const dogmaResult = processDogmaAction(state, 40, player1);
      
      expect(dogmaResult.nextPhase).toBe('AwaitingAction');
      expect(dogmaResult.events).toContainEqual(
        expect.objectContaining({ type: 'dogma_activated' })
      );
      // Should not draw and score since no transfer occurred
      expect(dogmaResult.events).not.toContainEqual(
        expect.objectContaining({ type: 'drew', fromAge: 2 })
      );
    });
  });
  */
}); 