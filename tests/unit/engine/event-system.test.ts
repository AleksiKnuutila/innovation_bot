// Event system tests - testing event emission, querying, filtering, and structure
import { describe, it, expect } from 'vitest';
import { initializeGame } from '@/engine/game-setup.js';
import { processAction } from '@/engine/state-machine.js';
import { 
  emitDrewEvent,
  emitMeldedEvent, 
  emitSplayedEvent,
  emitScoredEvent,
  emitDogmaActivatedEvent,
  emitAchievementClaimedEvent,
  getEventsByType,
  getEventsByPlayer,
  getRecentEvents
} from '@/engine/events.js';

describe('Event System', () => {
  const createTestGame = () => initializeGame({
    gameId: 'event-test',
    rngSeed: 12345,
    playerNames: ['Alice', 'Bob']
  });

  describe('Event emission', () => {
    it('should emit drew events with correct structure', () => {
      const gameState = createTestGame();
      
      const event = emitDrewEvent(gameState, 0, 5, 1, 'test_source');
      
      expect(event).toMatchObject({
        id: expect.any(Number),
        timestamp: expect.any(Number),
        type: 'drew',
        playerId: 0,
        cardId: 5,
        fromAge: 1,
        source: 'test_source'
      });
      
      // Event should be added to log
      expect(gameState.eventLog.events).toContain(event);
      expect(gameState.eventLog.nextEventId).toBe(event.id + 1);
    });

    it('should emit melded events with correct structure', () => {
      const gameState = createTestGame();
      
      const event = emitMeldedEvent(gameState, 1, 10, 'Red', 'test_meld');
      
      expect(event).toMatchObject({
        type: 'melded',
        playerId: 1,
        cardId: 10,
        color: 'Red',
        source: 'test_meld'
      });
    });

    it('should emit splayed events with correct structure', () => {
      const gameState = createTestGame();
      
      const event = emitSplayedEvent(gameState, 0, 'Blue', 'left', 'test_splay');
      
      expect(event).toMatchObject({
        type: 'splayed',
        playerId: 0,
        color: 'Blue',
        direction: 'left',
        source: 'test_splay'
      });
    });

    it('should increment event IDs sequentially', () => {
      const gameState = createTestGame();
      const initialEventId = gameState.eventLog.nextEventId;
      
      const event1 = emitDrewEvent(gameState, 0, 1, 1, 'test1');
      const event2 = emitDrewEvent(gameState, 0, 2, 1, 'test2');
      const event3 = emitDrewEvent(gameState, 0, 3, 1, 'test3');
      
      expect(event1.id).toBe(initialEventId);
      expect(event2.id).toBe(initialEventId + 1);
      expect(event3.id).toBe(initialEventId + 2);
      expect(gameState.eventLog.nextEventId).toBe(initialEventId + 3);
    });
  });

  describe('Event querying', () => {
    it('should filter events by type', () => {
      const gameState = createTestGame();
      
      // Emit different types of events
      emitDrewEvent(gameState, 0, 1, 1, 'test');
      emitDrewEvent(gameState, 1, 2, 1, 'test');
      emitMeldedEvent(gameState, 0, 3, 'Red', 'test');
      emitDrewEvent(gameState, 0, 4, 1, 'test');
      
      const drewEvents = getEventsByType(gameState, 'drew');
      const meldedEvents = getEventsByType(gameState, 'melded');
      
      expect(drewEvents).toHaveLength(3);
      expect(meldedEvents).toHaveLength(1);
      expect(drewEvents.every(e => e.type === 'drew')).toBe(true);
      expect(meldedEvents.every(e => e.type === 'melded')).toBe(true);
    });

    it('should filter events by player', () => {
      const gameState = createTestGame();
      
      // Emit events for different players
      emitDrewEvent(gameState, 0, 1, 1, 'test');
      emitDrewEvent(gameState, 1, 2, 1, 'test');
      emitMeldedEvent(gameState, 0, 3, 'Red', 'test');
      emitDrewEvent(gameState, 1, 4, 1, 'test');
      
      const player0Events = getEventsByPlayer(gameState, 0);
      const player1Events = getEventsByPlayer(gameState, 1);
      
      expect(player0Events).toHaveLength(2);
      expect(player1Events).toHaveLength(2);
      expect(player0Events.every(e => 'playerId' in e && e.playerId === 0)).toBe(true);
      expect(player1Events.every(e => 'playerId' in e && e.playerId === 1)).toBe(true);
    });

    it('should get recent events', () => {
      const gameState = createTestGame();
      
      // Emit several events
      emitDrewEvent(gameState, 0, 1, 1, 'test1');
      emitDrewEvent(gameState, 0, 2, 1, 'test2');
      emitDrewEvent(gameState, 0, 3, 1, 'test3');
      emitDrewEvent(gameState, 0, 4, 1, 'test4');
      emitDrewEvent(gameState, 0, 5, 1, 'test5');
      
      const recent3 = getRecentEvents(gameState, 3);
      const recent10 = getRecentEvents(gameState, 10);
      
      expect(recent3).toHaveLength(3);
      expect(recent10).toHaveLength(5); // Only 5 events exist
      
      // Should be the most recent events
      expect(recent3[0]?.cardId).toBe(3);
      expect(recent3[1]?.cardId).toBe(4);
      expect(recent3[2]?.cardId).toBe(5);
    });
  });

  describe('Event integration with actions', () => {
    it('should emit events during draw actions', () => {
      let gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      const initialEventCount = gameState.eventLog.events.length;
      
      const result = processAction(gameState, { type: 'draw', playerId: currentPlayer });
      gameState = result.newState;
      
      // Should have emitted a drew event
      expect(gameState.eventLog.events.length).toBe(initialEventCount + 1);
      
      const drewEvents = getEventsByType(gameState, 'drew');
      expect(drewEvents.length).toBeGreaterThan(0);
      
      const lastDrewEvent = drewEvents[drewEvents.length - 1];
      expect(lastDrewEvent?.playerId).toBe(currentPlayer);
      expect(lastDrewEvent?.source).toBe('draw_action');
    });

    it('should emit events during meld actions', () => {
      let gameState = createTestGame();
      const currentPlayer = gameState.phase.currentPlayer;
      const handCard = gameState.players[currentPlayer]?.hands[0];
      
      if (handCard) {
        const result = processAction(gameState, { 
          type: 'meld', 
          playerId: currentPlayer, 
          cardId: handCard 
        });
        gameState = result.newState;
        
        const meldedEvents = getEventsByType(gameState, 'melded');
        expect(meldedEvents.length).toBeGreaterThan(0);
        
        const lastMeldedEvent = meldedEvents[meldedEvents.length - 1];
        expect(lastMeldedEvent?.playerId).toBe(currentPlayer);
        expect(lastMeldedEvent?.cardId).toBe(handCard);
        expect(lastMeldedEvent?.source).toBe('meld_action');
      }
    });

    it('should maintain event chronology', () => {
      let gameState = createTestGame();
      const firstPlayer = gameState.phase.currentPlayer;
      
      // First player takes their 1 action
      const result1 = processAction(gameState, { type: 'draw', playerId: firstPlayer });
      gameState = result1.newState;
      
      // Now it's the second player's turn
      const secondPlayer = gameState.phase.currentPlayer;
      const result2 = processAction(gameState, { type: 'draw', playerId: secondPlayer });
      gameState = result2.newState;
      
      // Second player can meld a card if they have one
      const handCard = gameState.players[secondPlayer]?.hands[0];
      if (handCard) {
        const result3 = processAction(gameState, { 
          type: 'meld', 
          playerId: secondPlayer, 
          cardId: handCard 
        });
        gameState = result3.newState;
      }
      
      // Events should be in chronological order
      const allEvents = gameState.eventLog.events;
      for (let i = 1; i < allEvents.length; i++) {
        expect(allEvents[i]?.timestamp).toBeGreaterThanOrEqual(allEvents[i-1]?.timestamp ?? 0);
        expect(allEvents[i]?.id).toBeGreaterThan(allEvents[i-1]?.id ?? 0);
      }
    });
  });

  describe('Event data integrity', () => {
    it('should maintain event structure consistency', () => {
      const gameState = createTestGame();
      
      const event = emitDrewEvent(gameState, 0, 5, 1, 'test');
      
      // Verify event has correct structure
      expect(event).toMatchObject({
        id: expect.any(Number),
        timestamp: expect.any(Number),
        type: 'drew',
        playerId: 0,
        cardId: 5,
        fromAge: 1,
        source: 'test'
      });
      
      // Verify event is properly stored
      const storedEvent = gameState.eventLog.events.find(e => e.id === event.id);
      expect(storedEvent).toBeDefined();
      expect(storedEvent?.type).toBe('drew');
    });

    it('should handle event source tracking', () => {
      const gameState = createTestGame();
      
      const event1 = emitDrewEvent(gameState, 0, 1, 1, 'draw_action');
      const event2 = emitMeldedEvent(gameState, 0, 2, 'Red', 'meld_action');
      const event3 = emitDogmaActivatedEvent(gameState, 0, 3, 2, 'dogma_pottery');
      
      expect(event1.source).toBe('draw_action');
      expect(event2.source).toBe('meld_action');
      expect(event3.source).toBe('dogma_pottery');
    });
  });
});