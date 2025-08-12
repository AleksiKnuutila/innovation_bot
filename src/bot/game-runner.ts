import type { Bot, GameData } from '../types/index.js';
import { initializeGame } from '../engine/index.js';
import { processAction, processChoice } from '../engine/index.js';

/**
 * Configuration for running bot vs bot games
 */
export interface BotGameConfig {
  /** Seed for deterministic game setup */
  seed: number;
  /** Player names for the game */
  playerNames: [string, string];
  /** Bot for player 0 */
  bot0: Bot;
  /** Bot for player 1 */
  bot1: Bot;
  /** Maximum turns before forcing game end (safety) */
  maxTurns?: number;
  /** Whether to log game progress */
  verbose?: boolean;
}

/**
 * Result of a bot vs bot game
 */
export interface BotGameResult {
  /** Final game state */
  finalState: GameData;
  /** Winner player ID (null if tie) */
  winner: number | null;
  /** How the game was won */
  winCondition: string | null;
  /** Total turns played */
  turnsPlayed: number;
  /** Total actions processed */
  actionsProcessed: number;
  /** Game duration in milliseconds */
  duration: number;
  /** Whether the game ended naturally or was forced */
  naturalEnd: boolean;
}

/**
 * Run a complete game between two bots
 */
export async function runBotVsBotGame(config: BotGameConfig): Promise<BotGameResult> {
  const startTime = performance.now();
  
  // Initialize the game
  const gameState = initializeGame({
    gameId: `bot-vs-bot-${Date.now()}`,
    playerNames: config.playerNames,
    rngSeed: config.seed,
  });

  let currentState = gameState;
  let turnsPlayed = 0;
  let actionsProcessed = 0;
  const maxTurns = config.maxTurns ?? 1000; // Safety limit

  if (config.verbose) {
    console.log(`[GameRunner] Starting game between ${config.bot0.getName()} and ${config.bot1.getName()}`);
    console.log(`[GameRunner] Seed: ${config.seed}`);
  }

  try {
    // Main game loop
    while (currentState.phase.state !== 'GameOver' && turnsPlayed < maxTurns) {
      const currentPlayer = currentState.phase.currentPlayer;
      const currentBot = currentPlayer === 0 ? config.bot0 : config.bot1;

      // Process actions for this turn
      let actionsThisTurn = 0;
      const actionsPerTurn = turnsPlayed === 0 && currentPlayer === 0 ? 1 : 2; // First player gets 1 action on first turn

      while (actionsThisTurn < actionsPerTurn && currentState.phase.state === 'AwaitingAction') {
        try {
          // Bot decides on action
          const action = currentBot.decideAction(currentState, currentPlayer);
          
          // Process the action
          const result = processAction(currentState, action);
          currentState = result.newState;
          actionsProcessed++;

          // Handle any pending choices
          let pendingChoice = result.pendingChoice;
          while (pendingChoice && currentState.phase.state === 'AwaitingChoice') {
            const choice = pendingChoice;
            const choiceBot = choice.playerId === 0 ? config.bot0 : config.bot1;

            // Bot decides on choice
            const choiceAnswer = choiceBot.decideChoice(currentState, choice);
            
            // Process the choice
            const choiceResult = processChoice(currentState, choiceAnswer);
            currentState = choiceResult.newState;
            actionsProcessed++;

            // Update pending choice for next iteration
            pendingChoice = choiceResult.pendingChoice;
          }

          actionsThisTurn++;
        } catch (error) {
          if (config.verbose) {
            console.error(`[GameRunner] Error processing action for player ${currentPlayer}:`, error);
          }
          throw error;
        }
      }

      turnsPlayed++;

      // Check if game ended
      if (currentState.phase.state === 'GameOver') {
        break;
      }
    }

    const duration = performance.now() - startTime;
    const naturalEnd = currentState.phase.state === 'GameOver';

    if (config.verbose) {
      if (naturalEnd) {
        console.log(`[GameRunner] Game ended naturally after ${turnsPlayed} turns`);
      } else {
        console.log(`[GameRunner] Game forced to end after ${maxTurns} turns`);
      }
      console.log(`[GameRunner] Total actions processed: ${actionsProcessed}`);
      console.log(`[GameRunner] Game duration: ${duration.toFixed(2)}ms`);
    }

    // For now, we don't have winner info in the game state, so we'll return null
    // This can be enhanced later when the engine provides winner information
    return {
      finalState: currentState,
      winner: null, // TODO: Extract from game state when available
      winCondition: null, // TODO: Extract from game state when available
      turnsPlayed,
      actionsProcessed,
      duration,
      naturalEnd,
    };

  } catch (error) {
    const duration = performance.now() - startTime;
    
    if (config.verbose) {
      console.error(`[GameRunner] Game crashed after ${turnsPlayed} turns:`, error);
    }

    // Return partial result
    return {
      finalState: currentState,
      winner: null,
      winCondition: 'error',
      turnsPlayed,
      actionsProcessed,
      duration,
      naturalEnd: false,
    };
  }
}

/**
 * Run multiple bot vs bot games and collect statistics
 */
export async function runBotTournament(
  config: Omit<BotGameConfig, 'seed'>,
  numGames: number,
  baseSeed: number = 12345
): Promise<{
  results: BotGameResult[];
  stats: {
    totalGames: number;
    completedGames: number;
    averageTurns: number;
    averageDuration: number;
    winRates: { [playerId: number]: number };
  };
}> {
  const results: BotGameResult[] = [];
  const winCounts: { [playerId: number]: number } = { 0: 0, 1: 0 };

  for (let i = 0; i < numGames; i++) {
    const gameConfig: BotGameConfig = {
      ...config,
      seed: baseSeed + i,
      verbose: false, // Disable verbose logging for tournaments
    };

    const result = await runBotVsBotGame(gameConfig);
    results.push(result);

    if (result.winner !== null) {
      winCounts[result.winner] = (winCounts[result.winner] || 0) + 1;
    }

    if (config.verbose) {
      console.log(`[Tournament] Game ${i + 1}/${numGames} completed in ${result.turnsPlayed} turns`);
    }
  }

  const completedGames = results.filter(r => r.naturalEnd).length;
  const totalTurns = results.reduce((sum, r) => sum + r.turnsPlayed, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const stats = {
    totalGames: numGames,
    completedGames,
    averageTurns: totalTurns / numGames,
    averageDuration: totalDuration / numGames,
    winRates: {
      0: (winCounts[0] || 0) / numGames,
      1: (winCounts[1] || 0) / numGames,
    },
  };

  return { results, stats };
} 