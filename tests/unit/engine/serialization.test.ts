// Serialization system tests - testing save/load, corruption detection, and data integrity
import { describe, it, expect } from 'vitest';
import { initializeGame } from '@/engine/game-setup.js';
import { serializeGame, deserializeGame, createSaveData, loadSaveData } from '@/engine/serializer.js';

describe('Serialization System', () => {
  const createTestGame = () => initializeGame({
    gameId: 'serialization-test',
    rngSeed: 12345,
    playerNames: ['Alice', 'Bob']
  });

  describe('Basic serialization', () => {
    it('should serialize and deserialize game state', () => {
      const originalGame = createTestGame();
      
      const serialized = serializeGame(originalGame);
      const deserialized = deserializeGame(serialized);
      
      expect(deserialized.gameId).toBe(originalGame.gameId);
      expect(deserialized.version).toBe(originalGame.version);
      expect(deserialized.phase).toEqual(originalGame.phase);
      expect(deserialized.players).toEqual(originalGame.players);
      expect(deserialized.shared).toEqual(originalGame.shared);
    });

    it('should create valid serialized game structure', () => {
      const game = createTestGame();
      const serialized = serializeGame(game);
      
      expect(serialized).toMatchObject({
        version: expect.any(String),
        timestamp: expect.any(Number),
        data: expect.any(String),
        checksum: expect.any(Number)
      });
      
      // Data should be valid JSON
      expect(() => JSON.parse(serialized.data)).not.toThrow();
    });
  });

  describe('Checksum validation', () => {
    it('should detect data corruption', () => {
      const game = createTestGame();
      const serialized = serializeGame(game);
      
      // Corrupt the data but keep the original checksum to trigger mismatch
      const corruptedSerialized = {
        ...serialized,
        data: serialized.data.replace('gameId', 'hacked'), // Change a guaranteed field
      };
      
      expect(() => deserializeGame(corruptedSerialized))
        .toThrow('corrupted (checksum mismatch)');
    });

    it('should generate consistent checksums for identical data', () => {
      const game1 = createTestGame();
      const game2 = createTestGame();
      
      const serialized1 = serializeGame(game1);
      const serialized2 = serializeGame(game2);
      
      expect(serialized1.checksum).toBe(serialized2.checksum);
    });

    it('should generate different checksums for different data', () => {
      const game1 = initializeGame({
        gameId: 'test1',
        rngSeed: 1,
        playerNames: ['Alice', 'Bob']
      });
      
      const game2 = initializeGame({
        gameId: 'test2', 
        rngSeed: 2,
        playerNames: ['Charlie', 'Dave']
      });
      
      const serialized1 = serializeGame(game1);
      const serialized2 = serializeGame(game2);
      
      expect(serialized1.checksum).not.toBe(serialized2.checksum);
    });
  });

  describe('Save data format', () => {
    it('should create and load save data', () => {
      const originalGame = createTestGame();
      
      const saveData = createSaveData(originalGame);
      const loadedGame = loadSaveData(saveData);
      
      expect(loadedGame.gameId).toBe(originalGame.gameId);
      expect(loadedGame.phase).toEqual(originalGame.phase);
    });

    it('should handle invalid save data gracefully', () => {
      expect(() => loadSaveData('invalid json'))
        .toThrow('Failed to parse save data');
      
      expect(() => loadSaveData('{"invalid": "data"}'))
        .toThrow(); // Should throw some error when trying to deserialize invalid structure
    });
  });

  describe('Round-trip consistency', () => {
    it('should preserve all game state through serialize/deserialize cycle', () => {
      const originalGame = createTestGame();
      
      // Multiple round trips
      let currentGame = originalGame;
      for (let i = 0; i < 3; i++) {
        const serialized = serializeGame(currentGame);
        currentGame = deserializeGame(serialized);
      }
      
      expect(currentGame).toEqual(originalGame);
    });

    it('should preserve RNG state accurately', () => {
      const originalGame = createTestGame();
      
      const serialized = serializeGame(originalGame);
      const deserialized = deserializeGame(serialized);
      
      expect(deserialized.rng).toEqual(originalGame.rng);
    });

    it('should preserve event log completely', () => {
      const game = createTestGame();
      
      const serialized = serializeGame(game);
      const deserialized = deserializeGame(serialized);
      
      expect(deserialized.eventLog.events).toEqual(game.eventLog.events);
      expect(deserialized.eventLog.nextEventId).toBe(game.eventLog.nextEventId);
    });
  });

  describe('Error handling', () => {
    it('should reject malformed game data during serialization', () => {
      const malformedGame = {
        ...createTestGame(),
        players: null // Invalid players
      } as any;
      
      expect(() => serializeGame(malformedGame))
        .toThrow('Players data missing');
    });

    it('should reject invalid JSON during deserialization', () => {
      const invalidSerialized = {
        version: '1.0.0',
        timestamp: Date.now(),
        data: '{ invalid json',
        checksum: 12345
      };
      
      expect(() => deserializeGame(invalidSerialized))
        .toThrow('corrupted');
    });
  });
});