// Tests for card effects system (Phase 3)

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame } from '@/engine/index.js';
import { drawCard, meldCard, countIcons } from '@/engine/index.js';
import { processDogmaAction, createDogmaContext } from '@/engine/index.js';
import type { Action } from '@/types/actions.js';

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
      const initialHandSize = gameData.players[0].hands.length;
      const initialSupplySize = gameData.shared.supplyPiles[0].cards.length;
      
      const events: any[] = [];
      const newState = drawCard(gameData, 0, 1, events);
      
      expect(newState.players[0].hands.length).toBe(initialHandSize + 1);
      expect(newState.shared.supplyPiles[0].cards.length).toBe(initialSupplySize - 1);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('drew');
    });

    it('should meld cards correctly', () => {
      // First draw a card to have something to meld
      const events: any[] = [];
      let newState = drawCard(gameData, 0, 1, events);
      
      const cardToMeld = newState.players[0].hands[0];
      const initialHandSize = newState.players[0].hands.length;
      const initialBoardSize = newState.players[0].colors.length;
      
      newState = meldCard(newState, 0, cardToMeld, events);
      
      expect(newState.players[0].hands.length).toBe(initialHandSize - 1);
      expect(newState.players[0].colors.length).toBe(initialBoardSize + 1);
      expect(events.length).toBe(2); // drew + melded
      expect(events[1].type).toBe('melded');
    });

    it('should count icons correctly', () => {
      // Draw and meld a card with Leaf icons
      const events: any[] = [];
      let newState = drawCard(gameData, 0, 1, events);
      
      // Find a card with Leaf icons (Writing has Lightbulb icons)
      const cardToMeld = newState.players[0].hands.find(cardId => {
        const card = newState.shared.supplyPiles[0].cards.find(id => id === cardId);
        return card && card.positions?.left === 'Leaf';
      });
      
      if (cardToMeld) {
        newState = meldCard(newState, 0, cardToMeld, events);
        
        const leafCount = countIcons(newState, 0, 'Leaf');
        expect(leafCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Dogma Resolution Framework', () => {
    it('should create dogma context correctly', () => {
      const context = createDogmaContext(gameData, 15, 1, 0); // Writing card, level 1, player 0
      
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

  describe('Card Effect Handlers', () => {
    it('should have Writing card effect handler registered', () => {
      // Writing is card ID 15
      const writingCard = gameData.shared.supplyPiles[0].cards.find(id => id === 15);
      expect(writingCard).toBeDefined();
      
      // Test that the dogma system can handle the Writing card
      const result = processDogmaAction(gameData, 15, 0);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.nextPhase).toBe('AwaitingAction');
    });
  });

  describe('Integration', () => {
    it('should handle complete card effect chains', () => {
      // Test a complete flow: draw -> meld -> dogma (through framework)
      const events: any[] = [];
      let newState = drawCard(gameData, 0, 1, events);
      
      // Draw a second card
      newState = drawCard(newState, 0, 1, events);
      
      // Meld one card
      const cardToMeld = newState.players[0].hands[0];
      newState = meldCard(newState, 0, cardToMeld, events);
      
      // Test dogma through the framework using Writing card (ID 15) which we know has an effect handler
      const result = processDogmaAction(newState, 15, 0);
      
      // Should have events from the dogma resolution
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.nextPhase).toBe('AwaitingAction');
    });
  });
}); 