// Game state machine definitions for Innovation

// Core game states representing different phases of gameplay
export type GameState = 
  | 'AwaitingAction'      // Player needs to choose Draw/Meld/Dogma/Achieve
  | 'ResolvingDogma'      // Automatic dogma resolution in progress  
  | 'AwaitingChoice'      // Player needs to make a choice (select cards, etc.)
  | 'CheckingWinConditions' // Auto-checking achievements and special wins
  | 'GameOver';           // Game completed with winner determined

// Game phase information
export interface GamePhase {
  readonly state: GameState;
  readonly currentPlayer: import('./core.js').PlayerId;
  readonly turnNumber: import('./core.js').TurnNumber;
  readonly actionsRemaining: number; // 0, 1, or 2 actions left in turn
  readonly pendingChoice?: import('./choices.js').Choice; // Only set when state is AwaitingChoice
}

// State transition helpers
export function isGameActive(state: GameState): boolean {
  return state !== 'GameOver';
}

export function requiresPlayerInput(state: GameState): boolean {
  return state === 'AwaitingAction' || state === 'AwaitingChoice';
}

export function isAutomaticState(state: GameState): boolean {
  return state === 'ResolvingDogma' || state === 'CheckingWinConditions';
}

// Valid state transitions (for validation)
export const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  'AwaitingAction': ['ResolvingDogma', 'CheckingWinConditions', 'GameOver'],
  'ResolvingDogma': ['AwaitingChoice', 'CheckingWinConditions', 'AwaitingAction'],
  'AwaitingChoice': ['ResolvingDogma', 'CheckingWinConditions', 'AwaitingAction'],
  'CheckingWinConditions': ['AwaitingAction', 'GameOver'],
  'GameOver': [], // Terminal state
};

export function isValidTransition(from: GameState, to: GameState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}