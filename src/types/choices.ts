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
  return {
    type: 'select_cards',
    id,
    playerId,
    prompt,
    source,
    from,
    minCards,
    maxCards,
    filter,
  };
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