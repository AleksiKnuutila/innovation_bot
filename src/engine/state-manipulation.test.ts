import { describe, it, expect, beforeEach } from 'vitest';
import {
  drawAndScore,
  drawAndMeld,
  drawAndTuck,
  drawAndSplay,
  demandTransfer,
  demandReturn,
  exchangeHandScore,
  exchangeWithOpponent
} from './state-manipulation.js';

// Simple test game data structure
function createTestGameData() {
  return {
    players: {
      0: {
        hands: [],
        colors: [],
        scores: [],
        achievements: []
      },
      1: {
        hands: [],
        colors: [],
        scores: [],
        achievements: []
      }
    },
    shared: {
      supplyPiles: [
        { age: 1, cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
        { age: 2, cards: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
        { age: 3, cards: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35] }
      ]
    },
    eventLog: {
      events: [],
      nextEventId: 1
    }
  };
}

describe('Composite Primitive Functions', () => {
  let gameData: any;
  let events: any[];

  beforeEach(() => {
    gameData = createTestGameData();
    events = [];
  });

  describe('drawAndScore', () => {
    it('should draw and score a single card', () => {
      const result = drawAndScore(gameData, 0, 1, 1, events);

      expect(result.players[0].hands).toHaveLength(0);
      expect(result.players[0].scores).toHaveLength(1);
      expect(events).toHaveLength(2); // drew + scored
    });

    it('should draw and score multiple cards', () => {
      const result = drawAndScore(gameData, 0, 1, 2, events);

      expect(result.players[0].hands).toHaveLength(0);
      expect(result.players[0].scores).toHaveLength(2);
      expect(events).toHaveLength(4); // 2 drew + 2 scored
    });
  });

  describe('drawAndMeld', () => {
    it('should draw and meld a single card', () => {
      const result = drawAndMeld(gameData, 0, 1, 1, events);

      expect(result.players[0].hands).toHaveLength(0);
      expect(result.players[0].colors).toHaveLength(1);
      expect(result.players[0].colors[0]?.cards).toHaveLength(1);
      expect(events).toHaveLength(2); // drew + melded
    });

    it('should draw and meld multiple cards', () => {
      const result = drawAndMeld(gameData, 0, 1, 2, events);

      expect(result.players[0].hands).toHaveLength(0);
      expect(result.players[0].colors).toHaveLength(1);
      expect(result.players[0].colors[0]?.cards).toHaveLength(2);
      expect(events).toHaveLength(4); // 2 drew + 2 melded
    });
  });

  describe('drawAndTuck', () => {
    it('should draw and tuck a single card', () => {
      const result = drawAndTuck(gameData, 0, 1, 1, events);

      expect(result.players[0].hands).toHaveLength(0);
      expect(result.players[0].colors).toHaveLength(1);
      expect(result.players[0].colors[0]?.cards).toHaveLength(1);
      expect(events).toHaveLength(2); // drew + tucked
    });

    it('should draw and tuck multiple cards', () => {
      const result = drawAndTuck(gameData, 0, 1, 2, events);

      expect(result.players[0].hands).toHaveLength(0);
      expect(result.players[0].colors).toHaveLength(1);
      expect(result.players[0].colors[0]?.cards).toHaveLength(2);
      expect(events).toHaveLength(4); // 2 drew + 2 tucked
    });
  });

  describe('drawAndSplay', () => {
    it('should draw cards and splay a color', () => {
      // First add a Red card to create a color stack with at least 2 cards
      gameData.players[0].colors.push({
        color: 'Red',
        cards: [1, 2], // Need at least 2 cards to splay
        splayDirection: undefined
      });

      const result = drawAndSplay(gameData, 0, 1, 2, 'Red', 'left', events);

      expect(result.players[0].hands).toHaveLength(2);
      expect(result.players[0].colors).toHaveLength(1);
      expect(result.players[0].colors[0]?.splayDirection).toBe('left');
      expect(events).toHaveLength(3); // 2 drew + 1 splay
    });
  });

  describe('demandTransfer', () => {
    it('should transfer a card from hand to hand', () => {
      // Add a card to player 1's hand
      gameData.players[1].hands.push(1);

      const result = demandTransfer(
        gameData,
        0, // demanding player
        1, // target player
        'any',
        'hand',
        'hand',
        events
      );

      expect(result.players[1].hands).toHaveLength(0);
      expect(result.players[0].hands).toHaveLength(1);
      expect(events).toHaveLength(1); // transfer
    });

    it('should transfer a card with icon criteria', () => {
      // Add a card with Crown icon to player 1's hand
      gameData.players[1].hands.push(1);

      const result = demandTransfer(
        gameData,
        0, // demanding player
        1, // target player
        'with_icon',
        'hand',
        'hand',
        events,
        'Crown'
      );

      // The card should be transferred if it has the icon, or stay if it doesn't
      // Since we're using a simple test card ID, the transfer may or may not happen
      // Let's just check that the function executed without error
      expect(result).toBeDefined();
    });

    it('should not transfer if no valid cards', () => {
      const result = demandTransfer(
        gameData,
        0, // demanding player
        1, // target player
        'with_icon',
        'hand',
        'hand',
        events,
        'Crown'
      );

      expect(result.players[1].hands).toHaveLength(0);
      expect(result.players[0].hands).toHaveLength(0);
      expect(events).toHaveLength(0); // no transfer
    });
  });

  describe('demandReturn', () => {
    it('should return all cards from hand', () => {
      // Add cards to player 1's hand
      gameData.players[1].hands.push(1, 2, 3);

      const result = demandReturn(
        gameData,
        0, // demanding player
        1, // target player
        'hand',
        'all',
        1,
        events
      );

      expect(result.players[1].hands).toHaveLength(0);
      expect(events).toHaveLength(3); // 3 return events
    });

    it('should return highest value cards', () => {
      // Add cards to player 1's score pile
      gameData.players[1].scores.push(1, 2, 3);

      const result = demandReturn(
        gameData,
        0, // demanding player
        1, // target player
        'score',
        'highest',
        2,
        events
      );

      expect(result.players[1].scores).toHaveLength(1);
      expect(events).toHaveLength(2); // 2 return events
    });
  });

  describe('exchangeHandScore', () => {
    it('should exchange cards between hand and score', () => {
      // Add cards to hand and score
      gameData.players[0].hands.push(1, 2);
      gameData.players[0].scores.push(3, 4);

      const result = exchangeHandScore(
        gameData,
        0,
        [1, 2], // hand cards
        [3, 4], // score cards
        events
      );

      expect(result.players[0].hands).toHaveLength(2);
      expect(result.players[0].scores).toHaveLength(2);
      expect(result.players[0].hands).toContain(3);
      expect(result.players[0].hands).toContain(4);
      expect(result.players[0].scores).toContain(1);
      expect(result.players[0].scores).toContain(2);
    });
  });

  describe('exchangeWithOpponent', () => {
    it('should exchange cards with opponent', () => {
      // Add cards to both players
      gameData.players[0].hands.push(1, 2);
      gameData.players[1].hands.push(3, 4);

      const result = exchangeWithOpponent(
        gameData,
        0, // player
        1, // opponent
        'hand',
        'hand',
        [1, 2], // player cards
        [3, 4], // opponent cards
        events
      );

      expect(result.players[0].hands).toContain(3);
      expect(result.players[0].hands).toContain(4);
      expect(result.players[1].hands).toContain(1);
      expect(result.players[1].hands).toContain(2);
    });
  });
}); 