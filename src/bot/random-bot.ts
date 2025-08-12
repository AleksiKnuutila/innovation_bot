import type { Bot, BotConfig } from './types.js';
import type { GameData, Action, Choice, ChoiceAnswer, PlayerId } from '../types/index.js';
import { getLegalActions } from '../engine/index.js';
import { expandChoice } from '../types/choices.js';

/**
 * Simple bot that makes random decisions from available options
 * Uses the game's seeded RNG for deterministic behavior
 */
export class RandomBot implements Bot {
  private config: Required<BotConfig>;

  constructor(config: BotConfig = {}) {
    this.config = {
      deterministic: config.deterministic ?? true,
      seed: config.deterministic !== false ? (config.seed ?? Math.floor(Math.random() * 1000000)) : 0,
      verbose: config.verbose ?? false,
    };
  }

  /**
   * Decide which action to take given the current game state
   */
  decideAction(gameState: GameData, playerId: PlayerId): Action {
    const startTime = performance.now();
    
    const legalActions = getLegalActions(gameState, playerId);
    
    if (legalActions.length === 0) {
      throw new Error(`No legal actions available for player ${playerId}`);
    }

    // Use game's seeded RNG for deterministic behavior
    const randomIndex = this.getRandomIndex(gameState, legalActions.length);
    const selectedAction = legalActions[randomIndex];

    if (!selectedAction) {
      throw new Error(`Failed to select action from legal actions`);
    }

    if (this.config.verbose) {
      const decisionTime = performance.now() - startTime;
      console.log(`[RandomBot] Player ${playerId} chose action:`, selectedAction.type, `(${decisionTime.toFixed(2)}ms)`);
    }

    return selectedAction;
  }

  /**
   * Decide how to answer a choice presented by the game engine
   */
  decideChoice(gameState: GameData, choice: Choice): ChoiceAnswer {
    const startTime = performance.now();
    
    const options = expandChoice(choice, gameState);
    
    if (options.length === 0) {
      throw new Error(`No valid options for choice ${choice.id}`);
    }

    // Use game's seeded RNG for deterministic behavior
    const randomIndex = this.getRandomIndex(gameState, options.length);
    const selectedOption = options[randomIndex];

    if (!selectedOption) {
      throw new Error(`Failed to select option from choice options`);
    }

    if (this.config.verbose) {
      const decisionTime = performance.now() - startTime;
      console.log(`[RandomBot] Player ${choice.playerId} chose option:`, selectedOption, `(${decisionTime.toFixed(2)}ms)`);
    }

    return selectedOption;
  }

  /**
   * Get a human-readable name for this bot
   */
  getName(): string {
    if (this.config.deterministic) {
      return `RandomBot(seed:${this.config.seed})`;
    } else {
      return 'RandomBot(non-deterministic)';
    }
  }

  /**
   * Generate a random index using the game's seeded RNG
   * This ensures deterministic behavior when the same game state is encountered
   */
  private getRandomIndex(gameState: GameData, maxExclusive: number): number {
    if (this.config.deterministic) {
      // Use a combination of game state properties to generate a pseudo-random index
      // This ensures the same game state always produces the same "random" choice
      const hash = this.hashGameState(gameState);
      return (hash + gameState.rng.counter) % maxExclusive;
    } else {
      // Fallback to Math.random for non-deterministic behavior
      return Math.floor(Math.random() * maxExclusive);
    }
  }

  /**
   * Create a simple hash of the game state for deterministic random selection
   * This doesn't need to be cryptographically secure, just consistent
   */
  private hashGameState(gameState: GameData): number {
    let hash = 0;
    
    // Hash the current phase
    hash = ((hash << 5) - hash + gameState.phase.state.charCodeAt(0)) | 0;
    hash = ((hash << 5) - hash + gameState.phase.currentPlayer) | 0;
    hash = ((hash << 5) - hash + gameState.phase.turnNumber) | 0;
    
    // Hash the RNG state
    hash = ((hash << 5) - hash + gameState.rng.counter) | 0;
    
    // Hash player hands (simplified - just count cards)
    Object.values(gameState.players).forEach(player => {
      hash = ((hash << 5) - hash + player.hands.length) | 0;
      hash = ((hash << 5) - hash + player.colors.length) | 0;
      hash = ((hash << 5) - hash + player.scores.length) | 0;
    });

    return Math.abs(hash);
  }
} 