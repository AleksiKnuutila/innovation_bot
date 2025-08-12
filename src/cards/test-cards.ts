// Representative Age 1 cards selected for architecture validation
// These cards demonstrate different complexity levels and mechanics

import { CARDS } from './database.js';

// Selected test cards for Phase 3 implementation
export const TEST_CARD_IDS = {
  // Simple card: Basic draw effect, no choices
  SIMPLE: 15, // Writing: "Draw a 2"
  
  // Medium card: Conditional effect with choice
  MEDIUM: 5, // Code of Laws: "You may tuck a card... If you do, you may splay..."
  
  // Complex card: Demand with multiple conditions and effects  
  COMPLEX: 10, // Oars: Demand + fallback effect based on transfer result
} as const;

export const TEST_CARDS = {
  SIMPLE: CARDS.cardsById.get(TEST_CARD_IDS.SIMPLE)!,
  MEDIUM: CARDS.cardsById.get(TEST_CARD_IDS.MEDIUM)!,
  COMPLEX: CARDS.cardsById.get(TEST_CARD_IDS.COMPLEX)!,
};

// Card complexity analysis for reference during implementation:

/*
SIMPLE - Writing (ID: 15)
- Dogma Icon: Lightbulb
- Effect: "Draw a 2"
- Complexity: Straightforward draw action, no player choices
- Implementation: Direct state manipulation

MEDIUM - Code of Laws (ID: 5) 
- Dogma Icon: Crown
- Effect: "You may tuck a card from your hand of the same color as any card on your board. If you do, you may splay that color of your cards left."
- Complexity: Optional choice -> conditional effect -> optional choice
- Implementation: Requires choice handling and conditional logic

COMPLEX - Oars (ID: 10)
- Dogma Icon: Castle  
- Effects: 
  1. "I demand you transfer a card with a [Crown] from your hand to my score pile! If you do, draw a 1."
  2. "If no cards were transferred due to this demand, draw a 1."
- Complexity: Demand targeting opponents -> conditional effects based on success/failure
- Implementation: Multi-player targeting, demand resolution, conditional follow-up
*/