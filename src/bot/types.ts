import type { GameData } from '../types/game-data.js';
import type { PlayerId } from '../types/core.js';
import type { Action } from '../types/actions.js';
import type { Choice, ChoiceAnswer } from '../types/choices.js';

/**
 * Base interface that all bots must implement
 */
export interface Bot {
  /**
   * Decide which action to take given the current game state
   */
  decideAction(gameState: GameData, playerId: PlayerId): Action;

  /**
   * Decide how to answer a choice presented by the game engine
   */
  decideChoice(gameState: GameData, choice: Choice): ChoiceAnswer;

  /**
   * Get a human-readable name for this bot
   */
  getName(): string;
}

/**
 * Configuration options for bot behavior
 */
export interface BotConfig {
  /** Whether to use deterministic RNG (default: true) */
  deterministic?: boolean;
  /** Seed for deterministic behavior (only used if deterministic: true) */
  seed?: number;
  /** Whether to log bot decisions for debugging */
  verbose?: boolean;
}

/**
 * Result of a bot's decision-making process
 */
export interface BotDecision {
  /** The action or choice the bot decided on */
  decision: Action | ChoiceAnswer;
  /** Time taken to make the decision in milliseconds */
  decisionTime: number;
  /** Any reasoning or context about the decision */
  reasoning?: string;
} 