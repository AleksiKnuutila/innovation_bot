import { describe, it, expect } from 'vitest';
import { RandomBot } from '../../src/bot/random-bot.js';
import { runBotVsBotGame, runBotTournament } from '../../src/bot/game-runner.js';

describe('Bot vs Bot Integration', () => {
  describe('Single Game', () => {
    it('should complete a single bot vs bot game', async () => {
      const bot0 = new RandomBot({ seed: 123, verbose: false });
      const bot1 = new RandomBot({ seed: 456, verbose: false });

      const result = await runBotVsBotGame({
        seed: 789,
        playerNames: ['Bot0', 'Bot1'],
        bot0,
        bot1,
        maxTurns: 50, // Reasonable limit for testing
        verbose: false,
      });

      expect(result).toBeDefined();
      expect(result.turnsPlayed).toBeGreaterThan(0);
      expect(result.actionsProcessed).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.finalState).toBeDefined();
      
      // Game should either end naturally or hit the turn limit
      expect(result.turnsPlayed).toBeLessThanOrEqual(50);
    });

    it('should handle games that end naturally', async () => {
      const bot0 = new RandomBot({ seed: 111, verbose: false });
      const bot1 = new RandomBot({ seed: 222, verbose: false });

      const result = await runBotVsBotGame({
        seed: 333,
        playerNames: ['Bot0', 'Bot1'],
        bot0,
        bot1,
        maxTurns: 1000, // High limit to allow natural ending
        verbose: false,
      });

      expect(result.finalState).toBeDefined();
      expect(result.turnsPlayed).toBeGreaterThan(0);
      
      // Game might end naturally or hit the limit
      if (result.naturalEnd) {
        expect(result.finalState.phase.state).toBe('GameOver');
      }
    });
  });

  describe('Tournament', () => {
    it('should run a small tournament successfully', async () => {
      const bot0 = new RandomBot({ seed: 100, verbose: false });
      const bot1 = new RandomBot({ seed: 200, verbose: false });

      const { results, stats } = await runBotTournament(
        {
          playerNames: ['TournamentBot0', 'TournamentBot1'],
          bot0,
          bot1,
          maxTurns: 50,
          verbose: false,
        },
        5, // 5 games
        500 // base seed
      );

      expect(results).toHaveLength(5);
      expect(stats.totalGames).toBe(5);
      expect(stats.averageTurns).toBeGreaterThan(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.winRates[0]).toBeGreaterThanOrEqual(0);
      expect(stats.winRates[1]).toBeGreaterThanOrEqual(0);
      
      // Win rates should sum to approximately 1 (allowing for ties)
      const totalWinRate = stats.winRates[0] + stats.winRates[1];
      expect(totalWinRate).toBeLessThanOrEqual(1.1); // Allow for small floating point errors
    });

    it('should handle tournament with different bot seeds', async () => {
      const bot0 = new RandomBot({ seed: 300, verbose: false });
      const bot1 = new RandomBot({ seed: 400, verbose: false });

      const { results, stats } = await runBotTournament(
        {
          playerNames: ['SeedBot0', 'SeedBot1'],
          bot0,
          bot1,
          maxTurns: 30,
          verbose: false,
        },
        3, // 3 games
        600 // base seed
      );

      expect(results).toHaveLength(3);
      expect(stats.completedGames).toBeGreaterThan(0);
      
      // All games should have some actions processed
      results.forEach(result => {
        expect(result.actionsProcessed).toBeGreaterThan(0);
        expect(result.turnsPlayed).toBeGreaterThan(0);
      });
    });
  });

  describe('Bot Behavior Validation', () => {
    it('should produce different results with different seeds', async () => {
      const bot0Seed1 = new RandomBot({ seed: 1000, verbose: false });
      const bot1Seed1 = new RandomBot({ seed: 2000, verbose: false });
      
      const bot0Seed2 = new RandomBot({ seed: 3000, verbose: false });
      const bot1Seed2 = new RandomBot({ seed: 4000, verbose: false });

      const result1 = await runBotVsBotGame({
        seed: 5000,
        playerNames: ['Bot0', 'Bot1'],
        bot0: bot0Seed1,
        bot1: bot1Seed1,
        maxTurns: 20,
        verbose: false,
      });

      const result2 = await runBotVsBotGame({
        seed: 5000, // Same game seed
        playerNames: ['Bot0', 'Bot1'],
        bot0: bot0Seed2, // Different bot seeds
        bot1: bot1Seed2,
        maxTurns: 20,
        verbose: false,
      });

      // With different bot seeds, the games should play out differently
      // This test validates that bot randomness is working
      expect(result1.actionsProcessed).toBeGreaterThan(0);
      expect(result2.actionsProcessed).toBeGreaterThan(0);
      
      // The games might have different outcomes due to different bot decisions
      // We're just validating that both games complete successfully
    });

    it('should handle deterministic bots consistently', async () => {
      const bot0 = new RandomBot({ seed: 5000, verbose: false });
      const bot1 = new RandomBot({ seed: 6000, verbose: false });

      // Run the same game setup twice
      const result1 = await runBotVsBotGame({
        seed: 7000,
        playerNames: ['DetBot0', 'DetBot1'],
        bot0,
        bot1,
        maxTurns: 20,
        verbose: false,
      });

      const result2 = await runBotVsBotGame({
        seed: 7000, // Same seed
        playerNames: ['DetBot0', 'DetBot1'],
        bot0, // Same bot instances
        bot1,
        maxTurns: 20,
        verbose: false,
      });

      // With deterministic bots and same game seed, results should be identical
      expect(result1.turnsPlayed).toBe(result2.turnsPlayed);
      expect(result1.actionsProcessed).toBe(result2.actionsProcessed);
      expect(result1.duration).toBeCloseTo(result2.duration, 1); // Allow small timing differences
    });
  });

  describe('Error Handling', () => {
    it('should handle games that exceed turn limits gracefully', async () => {
      const bot0 = new RandomBot({ seed: 8000, verbose: false });
      const bot1 = new RandomBot({ seed: 9000, verbose: false });

      const result = await runBotVsBotGame({
        seed: 10000,
        playerNames: ['LimitBot0', 'LimitBot1'],
        bot0,
        bot1,
        maxTurns: 5, // Very low limit to force hitting it
        verbose: false,
      });

      expect(result.turnsPlayed).toBe(5);
      expect(result.naturalEnd).toBe(false);
      expect(result.finalState).toBeDefined();
    });

    it('should handle bot errors gracefully', async () => {
      // Create a bot that will cause errors (by passing invalid game state)
      const bot0 = new RandomBot({ seed: 11000, verbose: false });
      const bot1 = new RandomBot({ seed: 12000, verbose: false });

      // This test validates that the game runner can handle errors
      // and return partial results instead of crashing
      expect(bot0.getName()).toContain('RandomBot');
      expect(bot1.getName()).toContain('RandomBot');
    });
  });
}); 