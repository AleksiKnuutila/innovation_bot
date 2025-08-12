// Choice and ChoiceAnswer types for mid-resolution prompts

import type { CardId, Color, PlayerId, ZoneRef } from './core.js';

// Unique identifier for each choice (for tracking and validation)
export type ChoiceId = string;

// Base choice interface
interface BaseChoice {
  readonly id: ChoiceId;
  readonly playerId: PlayerId; // Who must answer this choice
  readonly prompt: string;     // Human-readable description
  readonly source: string;     // Card or rule that triggered this choice
}

// Select one or more cards with constraints
export interface SelectCardsChoice extends BaseChoice {
  readonly type: 'select_cards';
  readonly from: ZoneRef;         // Where to select from
  readonly minCards: number;      // Minimum cards to select (0 = optional)
  readonly maxCards: number;      // Maximum cards to select
  readonly filter?: CardFilter;   // Optional constraints on selectable cards
}

// Select a color pile for splaying or other operations
export interface SelectPileChoice extends BaseChoice {
  readonly type: 'select_pile';
  readonly availableColors: Color[]; // Which colors are valid choices
  readonly operation: string;        // What will happen (for UI display)
}

// Arrange cards in a specific order
export interface OrderCardsChoice extends BaseChoice {
  readonly type: 'order_cards';
  readonly cards: CardId[];       // Cards to arrange
  readonly instruction: string;   // How to order them (e.g., "highest to lowest")
}

// Yes/No decision for optional effects
export interface YesNoChoice extends BaseChoice {
  readonly type: 'yes_no';
  readonly yesText: string;  // What happens if yes
  readonly noText: string;   // What happens if no
}

// Select target player for effects
export interface SelectPlayerChoice extends BaseChoice {
  readonly type: 'select_player';
  readonly availablePlayers: PlayerId[];
  readonly operation: string; // What will happen to selected player
}

// Union of all choice types
export type Choice = 
  | SelectCardsChoice 
  | SelectPileChoice 
  | OrderCardsChoice 
  | YesNoChoice
  | SelectPlayerChoice;

// Card filtering for SelectCardsChoice
export interface CardFilter {
  readonly ages?: number[];        // Must be one of these ages
  readonly colors?: Color[];       // Must be one of these colors  
  readonly hasIcons?: import('./cards.js').Icon[];    // Must have at least one of these icons
  readonly minValue?: number;      // Minimum card value
  readonly maxValue?: number;      // Maximum card value
  readonly custom?: (cardId: CardId) => boolean; // Custom filter function
}

// ============ Choice Answer Types ============

interface BaseChoiceAnswer {
  readonly choiceId: ChoiceId;
  readonly playerId: PlayerId;
  readonly timestamp: number;
}

export interface SelectCardsAnswer extends BaseChoiceAnswer {
  readonly type: 'select_cards';
  readonly selectedCards: CardId[];
}

export interface SelectPileAnswer extends BaseChoiceAnswer {
  readonly type: 'select_pile';
  readonly selectedColor: Color;
}

export interface OrderCardsAnswer extends BaseChoiceAnswer {
  readonly type: 'order_cards';  
  readonly orderedCards: CardId[];
}

export interface YesNoAnswer extends BaseChoiceAnswer {
  readonly type: 'yes_no';
  readonly answer: boolean;
}

export interface SelectPlayerAnswer extends BaseChoiceAnswer {
  readonly type: 'select_player';
  readonly selectedPlayer: PlayerId;
}

// Union of all answer types
export type ChoiceAnswer = 
  | SelectCardsAnswer
  | SelectPileAnswer  
  | OrderCardsAnswer
  | YesNoAnswer
  | SelectPlayerAnswer;

// Helper functions to create choices
export function createSelectCardsChoice(
  id: ChoiceId,
  playerId: PlayerId,
  prompt: string,
  source: string,
  from: ZoneRef,
  minCards: number,
  maxCards: number,
  filter?: CardFilter
): SelectCardsChoice {
  const choice: SelectCardsChoice = {
    type: 'select_cards',
    id,
    playerId,
    prompt,
    source,
    from,
    minCards,
    maxCards,
  };
  
  if (filter !== undefined) {
    (choice as any).filter = filter;
  }
  
  return choice;
}

export function createYesNoChoice(
  id: ChoiceId,
  playerId: PlayerId,
  prompt: string,
  source: string,
  yesText: string,
  noText: string
): YesNoChoice {
  return {
    type: 'yes_no',
    id,
    playerId,
    prompt,
    source,
    yesText,
    noText,
  };
}

// Helper functions to create answers
export function createSelectCardsAnswer(
  choiceId: ChoiceId,
  playerId: PlayerId,
  selectedCards: CardId[]
): SelectCardsAnswer {
  return {
    type: 'select_cards',
    choiceId,
    playerId,
    selectedCards,
    timestamp: Date.now(),
  };
}

export function createYesNoAnswer(
  choiceId: ChoiceId,
  playerId: PlayerId,
  answer: boolean
): YesNoAnswer {
  return {
    type: 'yes_no',
    choiceId,
    playerId,
    answer,
    timestamp: Date.now(),
  };
}

export function createSelectPileAnswer(
  choiceId: ChoiceId,
  playerId: PlayerId,
  selectedColor: Color
): SelectPileAnswer {
  return {
    type: 'select_pile',
    choiceId,
    playerId,
    selectedColor,
    timestamp: Date.now(),
  };
}

export function createOrderCardsAnswer(
  choiceId: ChoiceId,
  playerId: PlayerId,
  orderedCards: CardId[]
): OrderCardsAnswer {
  return {
    type: 'order_cards',
    choiceId,
    playerId,
    orderedCards,
    timestamp: Date.now(),
  };
}

export function createSelectPlayerAnswer(
  choiceId: ChoiceId,
  playerId: PlayerId,
  selectedPlayer: PlayerId
): SelectPlayerAnswer {
  return {
    type: 'select_player',
    choiceId,
    playerId,
    selectedPlayer,
    timestamp: Date.now(),
  };
}

// Type guards
export function isSelectCardsChoice(choice: Choice): choice is SelectCardsChoice {
  return choice.type === 'select_cards';
}

export function isYesNoChoice(choice: Choice): choice is YesNoChoice {
  return choice.type === 'yes_no';
}

// Validation helpers
export function isValidAnswerForChoice(choice: Choice, answer: ChoiceAnswer): boolean {
  return choice.id === answer.choiceId && 
         choice.playerId === answer.playerId &&
         choice.type === answer.type;
}

/**
 * Expand a choice into all possible valid answers
 * This utility function is used by both UI and bot to understand available options
 */
export function expandChoice(choice: Choice, gameState: import('./game-data.js').GameData): ChoiceAnswer[] {
  const player = gameState.players[choice.playerId];
  if (!player) {
    throw new Error(`Player ${choice.playerId} not found in game state`);
  }

  switch (choice.type) {
    case 'select_cards': {
      const availableCards = getAvailableCardsFromZone(choice.from, player, gameState);
      const validSelections = generateValidCardSelections(availableCards, choice.minCards, choice.maxCards);
      return validSelections.map(cards => 
        createSelectCardsAnswer(choice.id, choice.playerId, cards)
      );
    }

    case 'select_pile': {
      return choice.availableColors.map(color => 
        createSelectPileAnswer(choice.id, choice.playerId, color)
      );
    }

    case 'order_cards': {
      // Generate all possible orderings of the cards
      const permutations = generatePermutations(choice.cards);
      return permutations.map(orderedCards => 
        createOrderCardsAnswer(choice.id, choice.playerId, orderedCards)
      );
    }

    case 'yes_no': {
      return [
        createYesNoAnswer(choice.id, choice.playerId, true),
        createYesNoAnswer(choice.id, choice.playerId, false)
      ];
    }

    case 'select_player': {
      return choice.availablePlayers.map(playerId => 
        createSelectPlayerAnswer(choice.id, choice.playerId, playerId)
      );
    }

    default:
      throw new Error(`Unsupported choice type: ${(choice as any).type}`);
  }
}

/**
 * Get available cards from a zone reference
 */
function getAvailableCardsFromZone(zoneRef: ZoneRef, player: any, _gameState: import('./game-data.js').GameData): number[] {
  switch (zoneRef.zone) {
    case 'hand':
      return player.hands;
    case 'board':
      if (zoneRef.color) {
        const colorStack = player.colors.find((stack: any) => stack.color === zoneRef.color);
        return colorStack ? colorStack.cards : [];
      }
      return [];
    case 'score':
      return player.scores;
    default:
      return [];
  }
}

/**
 * Generate valid card selections within min/max constraints
 */
function generateValidCardSelections(availableCards: number[], minCards: number, maxCards: number): number[][] {
  const result: number[][] = [];
  
  // Handle optional selection (minCards = 0)
  if (minCards === 0) {
    result.push([]);
  }
  
  // Generate combinations of different sizes
  for (let size = Math.max(minCards, 1); size <= Math.min(maxCards, availableCards.length); size++) {
    const combinations = generateCombinations(availableCards, size);
    result.push(...combinations);
  }
  
  return result;
}

/**
 * Generate all combinations of size k from array
 */
function generateCombinations(array: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (k > array.length) return [];
  
  const result: number[][] = [];
  
  for (let i = 0; i <= array.length - k; i++) {
    const head = array[i];
    if (head === undefined) continue; // Skip undefined elements
    const tailCombinations = generateCombinations(array.slice(i + 1), k - 1);
    
    for (const tail of tailCombinations) {
      result.push([head, ...tail]);
    }
  }
  
  return result;
}

/**
 * Generate all permutations of an array
 */
function generatePermutations(array: number[]): number[][] {
  if (array.length <= 1) return [array];
  
  const result: number[][] = [];
  
  for (let i = 0; i < array.length; i++) {
    const current = array[i];
    if (current === undefined) continue; // Skip undefined elements
    const remaining = array.filter((_, index) => index !== i);
    const perms = generatePermutations(remaining);
    
    for (const perm of perms) {
      result.push([current, ...perm]);
    }
  }
  
  return result;
}