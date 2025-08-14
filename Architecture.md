# Simplified Architecture Overview

## Goals

- Single deterministic game rules engine shared by UI and AI bot
- Simple **state machine** approach instead of complex effect queues
- Clear separation of concerns with single package structure initially

## Core Components

- **Engine** – game state + rules logic in simple state machine
- **UI** – renders state and handles user input  
- **Bot** – makes decisions using same game API
- **Types** – shared interfaces and data structures

## Package Structure (Simplified)

Start with single package, split later if needed:

```
/src
  /engine     # core game logic
  /ui         # svelte components  
  /bot        # AI decision making
  /types      # shared types
  /cards      # card definitions and effects
```

## State Machine Approach

Instead of complex effect queues, use explicit game states:

```typescript
type GameState = 
  | "AwaitingAction"      // Player needs to choose Draw/Meld/Dogma/Achieve
  | "ResolvingDogma"      // Automatic dogma resolution in progress
  | "AwaitingChoice"      // Player needs to make a choice (select cards, etc.)
  | "CheckingWinConditions" // Checking achievements, special wins
  | "GameOver"            // Game completed

type GamePhase = {
  state: GameState
  currentPlayer: PlayerId
  pendingChoice?: Choice  // Only set when state is AwaitingChoice
  // ... other state data
}
```

## Engine API (Simplified)

```typescript
// Main game loop
function processAction(gameState: GameData, action: Action): GameResult
function processChoice(gameState: GameData, choice: ChoiceAnswer): GameResult

type GameResult = {
  newState: GameData
  events: Event[]
  nextPhase: GameState
  pendingChoice?: Choice
}

// Queries
function getLegalActions(gameState: GameData, player: PlayerId): Action[]
function expandChoice(choice: Choice): ChoiceOption[]
```

## Benefits of State Machine

1. **Simpler to Debug**: Clear state transitions, no complex queues
2. **Easier to Test**: Each state transition can be unit tested
3. **Clearer Logic Flow**: Game phases are explicit, not hidden in effect stacks
4. **Less Complex**: Avoid continuation/resumption complexity
5. **MVP Appropriate**: Get working game faster, optimize later

## Card Effects

Handle card effects through **callback-based state machine pattern** rather than effect primitives:

```typescript
// The contract every card effect follows
interface CardEffectFunction {
  (context: DogmaContext, effectState: any, choiceAnswer?: ChoiceAnswer): EffectResult;
}

// What the function can return
type EffectResult =
  | { type: 'continue'; newState: GameData; events: GameEvent[]; nextState: any }
  | { type: 'need_choice'; newState: GameData; events: GameEvent[]; choice: Choice; nextState: any }
  | { type: 'complete'; newState: GameData; events: GameEvent[] };

// Effect registry maps string identifiers to functions
interface EffectRegistry {
  readonly [cardKey: string]: CardEffectFunction;
}

// Engine calls the function until it returns 'complete'
function processDogmaAction(gameData: GameData, cardId: number): GameResult {
  const cardKey = getCardKey(cardId);
  const effectFunction = effectRegistry[cardKey];
  
  if (!effectFunction) {
    throw new Error(`No effect handler for card: ${cardKey}`);
  }
  
  // Get or create effect state
  let effectState = gameData.activeEffects.find(e => e.cardId === cardId)?.effectState || { step: 'start' };
  
  // Call effect function until completion
  while (true) {
    const result = effectFunction(context, effectState);
    
    switch (result.type) {
      case 'continue':
        effectState = result.nextState;
        continue;
        
      case 'need_choice':
        return {
          newState: { ...result.newState, activeEffects: [...gameData.activeEffects, { cardId, effectState: result.nextState }] },
          events: result.events,
          nextPhase: 'AwaitingChoice',
          pendingChoice: result.choice
        };
        
      case 'complete':
        return {
          newState: result.newState,
          events: result.events,
          nextPhase: 'AwaitingAction'
        };
    }
  }
}
```

## Benefits of Callback-Based State Machine

1. **Pure Functions**: Each effect is a pure function, easy to test and reason about
2. **Serializable State**: Effect state is just plain objects, perfect for save/load
3. **Resumable Execution**: Engine can pause/resume effects at any point
4. **Clear State Transitions**: Each step is explicit, making debugging easier
5. **No Complex Continuations**: Avoid async/await complexity while maintaining resumability
6. **Deterministic**: Same inputs always produce same outputs
7. **Testable**: Each step can be unit tested independently

## Effect State Management

```typescript
interface GameData {
  // ... existing fields ...
  readonly activeEffects: ActiveEffect[];
}

interface ActiveEffect {
  readonly cardId: number;
  readonly effectState: any; // Serializable state for the effect
  readonly priority: number; // For handling multiple active effects
}

// When resuming after a choice:
function processChoice(gameData: GameData, choiceAnswer: ChoiceAnswer): GameResult {
  const activeEffect = gameData.activeEffects[0]; // Process highest priority first
  const cardKey = getCardKey(activeEffect.cardId);
  const effectFunction = effectRegistry[cardKey];
  
  const result = effectFunction(context, activeEffect.effectState, choiceAnswer);
  
  // Update effect state or remove if complete
  const newActiveEffects = result.type === 'complete' 
    ? gameData.activeEffects.filter(e => e.cardId !== activeEffect.cardId)
    : gameData.activeEffects.map(e => 
        e.cardId === activeEffect.cardId 
          ? { ...e, effectState: result.nextState }
          : e
      );
  
  return {
    newState: { ...result.newState, activeEffects: newActiveEffects },
    events: result.events,
    nextPhase: result.type === 'complete' ? 'AwaitingAction' : 'AwaitingChoice',
    pendingChoice: result.type === 'need_choice' ? result.choice : undefined
  };
}
```

## Callback-Based Pattern Examples

### Simple Card: Writing (No Choices)

```typescript
interface WritingState {
  step: 'execute';
}

function writingEffect(context: DogmaContext, state: WritingState): EffectResult {
  // Draw two cards from age 1
  const newState = drawCards(context.gameState, context.activatingPlayer, 1, 2);
  const events = [
    emitDrewEvent(newState, context.activatingPlayer, /* cardId1 */, 1, 'writing'),
    emitDrewEvent(newState, context.activatingPlayer, /* cardId2 */, 1, 'writing')
  ];

  return { type: 'complete', newState, events };
}
```

### Medium Card: Code of Laws (Single Choice)

```typescript
interface CodeOfLawsState {
  step: 'check_condition' | 'waiting_choice';
}

function codeOfLawsEffect(
  context: DogmaContext, 
  state: CodeOfLawsState, 
  choiceAnswer?: ChoiceAnswer
): EffectResult {

  switch (state.step) {
    case 'check_condition': {
      if (!hasHighestIconCount(context.gameState, context.activatingPlayer, 'crown')) {
        return { type: 'complete', newState: context.gameState, events: [] };
      }

      return {
        type: 'need_choice',
        newState: context.gameState,
        events: [],
        choice: createYesNoChoice('Tuck all cards from your hand?'),
        nextState: { step: 'waiting_choice' }
      };
    }

    case 'waiting_choice': {
      const answer = (choiceAnswer as YesNoAnswer).answer;
      if (!answer) {
        return { type: 'complete', newState: context.gameState, events: [] };
      }

      const [newState, events] = tuckAllHandCards(context.gameState, context.activatingPlayer);
      return { type: 'complete', newState, events };
    }
  }
}
```

### Complex Card: Oars (Demand with Multiple Choices)

```typescript
interface OarsState {
  step: 'execute_demand' | 'waiting_transfer_choice' | 'waiting_draw_choice';
  affectedPlayers: PlayerId[];
  currentPlayerIndex: number;
}

function oarsEffect(
  context: DogmaContext, 
  state: OarsState, 
  choiceAnswer?: ChoiceAnswer
): EffectResult {

  switch (state.step) {
    case 'execute_demand': {
      const affectedPlayers = getPlayersWithFewerIcons(
        context.gameState,
        context.activatingPlayer,
        'crown'
      );

      if (affectedPlayers.length === 0) {
        // No one affected by demand - execute non-demand effect
        const [newState, events] = drawAndScore(context.gameState, context.activatingPlayer);
        return { type: 'complete', newState, events };
      }

      // Start processing first affected player
      const firstPlayer = affectedPlayers[0];
      const hasCards = hasCardsInHand(context.gameState, firstPlayer);

      if (!hasCards) {
        // Skip to next player or complete
        if (affectedPlayers.length === 1) {
          const [newState, events] = drawAndScore(context.gameState, context.activatingPlayer);
          return { type: 'complete', newState, events };
        }

        return {
          type: 'continue',
          newState: context.gameState,
          events: [],
          nextState: {
            ...state,
            step: 'execute_demand',
            affectedPlayers: affectedPlayers.slice(1)
          }
        };
      }

      return {
        type: 'need_choice',
        newState: context.gameState,
        events: [],
        choice: createSelectCardsChoice(
          firstPlayer,
          'Select a card to transfer',
          { from: 'hand', minCards: 1, maxCards: 1 }
        ),
        nextState: {
          step: 'waiting_transfer_choice',
          affectedPlayers,
          currentPlayerIndex: 0
        }
      };
    }

    case 'waiting_transfer_choice': {
      const selectedCards = (choiceAnswer as SelectCardsAnswer).selectedCards;
      const currentPlayer = state.affectedPlayers[state.currentPlayerIndex];

      // Transfer the selected card
      const [newState, events] = transferCard(
        context.gameState,
        currentPlayer,
        context.activatingPlayer,
        selectedCards[0]
      );

      // Check if more players need to be processed
      if (state.currentPlayerIndex < state.affectedPlayers.length - 1) {
        const nextPlayer = state.affectedPlayers[state.currentPlayerIndex + 1];

        return {
          type: 'need_choice',
          newState,
          events,
          choice: createSelectCardsChoice(
            nextPlayer,
            'Select a card to transfer'
          ),
          nextState: {
            ...state,
            currentPlayerIndex: state.currentPlayerIndex + 1
          }
        };
      }

      // All players processed - offer optional draw to activating player
      return {
        type: 'need_choice',
        newState,
        events,
        choice: createYesNoChoice(
          context.activatingPlayer,
          'Draw and score a card?'
        ),
        nextState: { step: 'waiting_draw_choice', affectedPlayers: [], currentPlayerIndex: 0 }
      };
    }

    case 'waiting_draw_choice': {
      const answer = (choiceAnswer as YesNoAnswer).answer;
      if (!answer) {
        return { type: 'complete', newState: context.gameState, events: [] };
      }

      const [newState, events] = drawAndScore(context.gameState, context.activatingPlayer);
      return { type: 'complete', newState, events };
    }
  }
}
```

## Best Practices for Callback-Based Effects

### 1. Minimize State Complexity
Keep effect state as simple as possible. Prefer enums over complex objects.

```typescript
// ✅ Good - Simple enum state
interface SimpleCardState {
  step: 'check_condition' | 'waiting_choice' | 'done';
  hasQualified?: boolean;
}

// ❌ Avoid - Complex nested state
interface ComplexCardState {
  step: string;
  data: {
    phase: number;
    subPhase: { type: string; flags: boolean[] };
    cache: Map<string, any>;
  };
}
```

### 2. Step Naming and Initial State Registry

**Critical Discovery**: The engine uses a centralized registry to define the initial step for each card effect. This registry is located in `src/engine/dogma-resolver.ts` in the `getInitialState()` function.

```typescript
// In src/engine/dogma-resolver.ts
function getInitialState(cardName: string): any {
  switch (cardName) {
    case 'Code of Laws':
      return { step: 'check_condition' };
    case 'Oars':
      return { 
        step: 'execute_demand', 
        affectedPlayers: [], 
        currentPlayerIndex: 0 
      };
    case 'Invention':
      return { step: 'check_splay_options' };
    // ... more cards
    default:
      return { step: 'start' };
  }
}
```

**Step Naming Conventions**:
- `'check_condition'` - For effects that need to validate prerequisites
- `'execute_demand'` - For demand effects that process vulnerable players
- `'waiting_[action]_choice'` - For steps that require player input
- `'start'` - Default for simple effects or placeholder implementations

**When Adding New Cards**:
1. **Add to the registry first** - Define the initial step in `getInitialState()`
2. **Match the step name** - Your effect's first `case` must match the registry
3. **Use descriptive names** - Step names should clearly indicate what happens

```typescript
// ✅ Good - Registry and effect match
// In getInitialState():
case 'My New Card':
  return { step: 'check_prerequisites' };

// In effect function:
switch (state.step) {
  case 'check_prerequisites': {
    // Implementation here
  }
}

// ❌ Bad - Mismatch will cause "Unknown step" errors
// Registry says 'check_prerequisites' but effect expects 'start'
```

**Simple Effects vs State Machine Effects**:
- **Simple Effects**: Use `createSimpleEffect()` wrapper, get `{ step: 'start' }` by default
- **State Machine Effects**: Need explicit registry entry with meaningful first step name

### 3. Multi-Step Effect Flow with 'continue'

**Critical Pattern**: When an effect needs to proceed through multiple steps automatically (without user input), use `type: 'continue'` to chain steps together.

```typescript
// Example: Effect that validates, then processes, then completes
switch (state.step) {
  case 'check_prerequisites': {
    if (!meetsRequirements) {
      return { type: 'complete', newState, events };
    }
    
    // Continue to next step automatically
    return {
      type: 'continue',
      newState,
      events,
      nextState: { step: 'process_action' }
    };
  }
  
  case 'process_action': {
    // Do the main work
    const processedState = doMainWork(newState);
    
    // Continue to final step
    return {
      type: 'continue', 
      newState: processedState,
      events: [...events, ...workEvents],
      nextState: { step: 'finalize' }
    };
  }
  
  case 'finalize': {
    // Final cleanup
    return { type: 'complete', newState, events };
  }
}
```

**When to use 'continue' vs 'complete'**:
- Use `'continue'` when you need to proceed to another step automatically
- Use `'complete'` when the effect is entirely finished
- Use `'need_choice'` when you need player input before proceeding

**Engine Behavior**:
- `'continue'` results set `nextPhase: 'AwaitingAction'` but continue effect execution
- The engine automatically calls the effect function again with the `nextState`
- Tests see the final accumulated events from all steps

### 4. Avoid Unnecessary Step Branches
Combine simple logic into single steps. Only create new steps when you truly need to pause execution.

```typescript
// ✅ Good - Combined logic
case 'waiting_choice': {
  const answer = (choiceAnswer as YesNoAnswer).answer;
  if (!answer) {
    return { type: 'complete', newState: context.gameState, events: [] };
  }

  // Execute immediately if choice is yes
  const newState = executeEffect(context.gameState);
  return { type: 'complete', newState, events: [...] };
}

// ❌ Avoid - Unnecessary step
case 'waiting_choice': {
  const answer = (choiceAnswer as YesNoAnswer).answer;
  return {
    type: 'continue',
    nextState: { step: 'execute_effect', shouldExecute: answer }
  };
}
case 'execute_effect': {
  if (!state.shouldExecute) {
    return { type: 'complete', ... };
  }
  // ... execute
}
```

### 5. Critical Implementation Pitfalls and Solutions

**⚠️ IMPORTANT**: These are lessons learned from implementing 65+ card effects across Ages 1-6. Following these patterns will save significant debugging time.

#### A) The 'continue' vs 'complete' Trap

**Common Error**: Using `type: 'continue'` when you should execute logic immediately within the same step.

```typescript
// ❌ BAD - Causes premature AwaitingAction state
case 'waiting_return_choice': {
  if (choiceAnswer?.selectedCards.length === 0) {
    return { type: 'complete', newState, events };
  }
  
  // Process the returned card
  newState = returnCard(newState, activatingPlayer, cardId, age, events);
  
  // DON'T do this - causes engine to stop here
  return {
    type: 'continue',
    newState,
    events,
    nextState: { step: 'score_cards' }
  };
}

// ✅ GOOD - Execute scoring logic immediately
case 'waiting_return_choice': {
  if (choiceAnswer?.selectedCards.length === 0) {
    return { type: 'complete', newState, events };
  }
  
  // Process the returned card
  newState = returnCard(newState, activatingPlayer, cardId, age, events);
  
  // Execute scoring logic immediately - no continue needed
  const iconCount = countIcons(newState, activatingPlayer, 'Lightbulb');
  const cardsToScore = Math.floor(iconCount / 2);
  
  for (let i = 0; i < cardsToScore && player.hands.length > 0; i++) {
    const cardToScore = player.hands[player.hands.length - 1];
    newState = scoreCard(newState, activatingPlayer, cardToScore, events);
  }
  
  return { type: 'complete', newState, events };
}
```

**Rule**: Only use `continue` when you genuinely need to pause execution and transition to a different logical step. If you can execute the logic immediately after a choice, do it in the same case.

#### B) Icon Visibility and Splaying Gotchas

**Common Error**: Expecting icons to be visible when cards aren't properly splayed.

```typescript
// ❌ BAD - Icons might not be visible
const factoryCount = countIcons(gameData, activatingPlayer, 'Factory');
// factoryCount returns 0 because cards aren't splayed!

// ✅ GOOD - Test setup ensures icon visibility
// In test setup:
const industrializationStack = state.players[player1].colors.find(stack => stack.color === 'Red');
if (industrializationStack) {
  industrializationStack.cards.push(63); // Add second card
  industrializationStack.splayDirection = 'right'; // CRITICAL - makes icons visible
}
```

**Icon Visibility Rules**:
- Single cards: Only top card's icons visible
- Unsplayed stacks: Only top card's icons visible  
- Splayed stacks: Icons from lower cards become visible
- **Test Setup**: Always splay stacks in tests when expecting icon counts > top card

#### C) Zone Confusion - Hand vs Score vs Board

**Common Error**: Using wrong primitive for the source zone.

```typescript
// ❌ BAD - returnCard expects cards to be in hand
// But Vaccination needs to return from score pile
newState = returnCard(newState, playerId, cardId, age, events);
// Error: Card not found in player's hand

// ✅ GOOD - Manual score pile return
const scoreIndex = player.scores.indexOf(cardId);
if (scoreIndex !== -1) {
  player.scores.splice(scoreIndex, 1);
  
  const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
  if (supplyPile) {
    supplyPile.cards.push(cardId);
  }
  
  const returnEvent = emitEvent(newState, 'returned', {
    playerId,
    cardId,
    fromZone: { playerId, zone: 'score' },
    toAge: card.age,
  });
  events.push(returnEvent);
}
```

**Zone Primitive Guidelines**:
- `returnCard()`: Hand → Supply
- `scoreCard()`: Hand → Score pile  
- `meldCard()`: Hand → Board
- `transferCard()`: Any zone → Any zone (most flexible)
- **Custom logic needed**: Score pile → Supply, Board → Score pile

#### D) Test Event Assertion Specificity

**Common Error**: Testing event structure too specifically.

```typescript
// ❌ BAD - Tests internal event structure
expect(choiceResult.events).toContainEqual(
  expect.objectContaining({ 
    type: 'transferred', 
    cardId: 1,
    fromPlayer: player2, // Full player object - implementation detail
    toPlayer: player1
  })
);

// ✅ GOOD - Test essential fields only
expect(choiceResult.events).toContainEqual(
  expect.objectContaining({ 
    type: 'transferred', 
    cardId: 1,
    toPlayer: player1
  })
);
```

**Event Testing Principles**:
- Test event type and key data (cardId, playerId, etc.)
- Avoid testing internal object structures  
- Focus on game-relevant information
- Use `expect.objectContaining()` for partial matching

#### E) Demand Effect Targeting Setup

**Common Error**: Forgetting to set up proper icon disparities for demand effects.

```typescript
// ❌ BAD - Both players have same icon count
// Demand won't trigger because activatingPlayer doesn't have MORE icons
const dogmaResult = processDogmaAction(state, 60, player1);
// No one affected by demand

// ✅ GOOD - Ensure activating player has more icons
// Add icons to activating player and splay to make visible
const emancipationStack = state.players[player1].colors.find(stack => stack.color === 'Purple');
if (emancipationStack) {
  emancipationStack.cards.push(55); // Add Factory card
  emancipationStack.splayDirection = 'right'; // Make icons visible
}
// Target player (player2) has fewer or no Factory icons
```

**Demand Effect Test Patterns**:
- **Activating player**: Must have MORE of the demand icon
- **Target players**: Must have FEWER of the demand icon
- **Icon visibility**: Ensure stacks are splayed to reveal icons
- **Edge cases**: Test with no affected players, no cards to transfer

#### F) Card Data Access Patterns

**Common Error**: Hardcoding card properties instead of using the database.

```typescript
// ❌ BAD - Hardcoded assumptions about cards
if (cardId === 1) {
  // Assuming Agriculture is age 1 - could break
}

// ✅ GOOD - Use card database
const card = CARDS.cardsById.get(cardId);
if (!card) {
  throw new Error(`Card ${cardId} not found in database`);
}
if (card.age === 1) {
  // Correct approach using actual card data
}
```

**Card Database Best Practices**:
- Always look up card data via `CARDS.cardsById.get()`
- Check for null/undefined results
- Use card properties (age, color, positions) instead of assumptions
- Validate card IDs in tests match intended cards

#### G) Multi-Card Selection Logic

**Common Error**: Not handling multiple cards correctly in loops.

```typescript
// ❌ BAD - Index shifting during removal
for (const cardId of lowestCards) {
  const scoreIndex = player.scores.indexOf(cardId);
  player.scores.splice(scoreIndex, 1); // Shifts other indices!
}

// ✅ GOOD - Remove in reverse order or use filter
const cardsToRemove = new Set(lowestCards);
player.scores = player.scores.filter(cardId => !cardsToRemove.has(cardId));

// Or remove in reverse order
for (let i = lowestCards.length - 1; i >= 0; i--) {
  const cardId = lowestCards[i];
  const scoreIndex = player.scores.indexOf(cardId);
  if (scoreIndex !== -1) {
    player.scores.splice(scoreIndex, 1);
  }
}
```

#### H) Supply Pile Age Mismatch

**Common Error**: Not finding the correct supply pile for card returns.

```typescript
// ❌ BAD - Assumes supply pile exists
const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
supplyPile.cards.push(cardId); // Could be undefined!

// ✅ GOOD - Validate supply pile exists
const supplyPile = newState.shared.supplyPiles.find(pile => pile.age === card.age);
if (!supplyPile) {
  throw new Error(`Supply pile for age ${card.age} not found`);
}
supplyPile.cards.push(cardId);
```

#### I) Test Data Setup for Complex Conditions

**Common Error**: Insufficient test setup for complex card conditions.

```typescript
// ❌ BAD - Unclear what cards are where
state = addCardsToScore(state, player1, [1, 2, 3]);

// ✅ GOOD - Explicit setup with comments
// Add cards to score pile - mix of ages to test "lowest" logic
state = addCardsToScore(state, player2, [1, 16, 17, 3]); 
// Ages: 1(Agriculture), 2(Calendar), 2(Canal Building), 1(City States)
// Lowest cards should be Agriculture and City States (both age 1)
```

**Test Setup Best Practices**:
- Comment complex setups with card names and ages
- Use distinct card IDs to avoid confusion
- Set up both positive and negative test cases
- Ensure test data matches the game rules being tested

### 6. Use Helper Functions Extensively
Break complex operations into small, testable helper functions.

```typescript
// ✅ Good - Clear, reusable helpers
function hasRequiredIcons(gameState: GameData, playerId: PlayerId): boolean {
  return getPlayerIconCount(gameState, playerId, 'crown') >= 3;
}

function executeCardTucking(gameState: GameData, playerId: PlayerId): [GameData, GameEvent[]] {
  // Focused, testable logic
}

// In card effect:
case 'check_condition': {
  if (!hasRequiredIcons(context.gameState, context.activatingPlayer)) {
    return { type: 'complete', newState: context.gameState, events: [] };
  }
  // ...
}
```

### 7. Keep Effects Brief
Target 20-40 lines per card effect. If longer, break into helper functions.

### 8. Use Descriptive Step Names
Step names should clearly indicate what the step does.

```typescript
// ✅ Good step names
step: 'check_sharing_eligibility' | 'offer_optional_splay' | 'execute_demand'

// ❌ Poor step names  
step: 'step1' | 'step2' | 'processing' | 'handle_stuff'
```

### 9. Handle Edge Cases Early
Validate conditions and handle edge cases at the beginning of each step.

```typescript
case 'waiting_card_selection': {
  if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
    throw new Error('Expected card selection');
  }

  const selectedCards = (choiceAnswer as SelectCardsAnswer).selectedCards;
  if (selectedCards.length === 0) {
    return { type: 'complete', newState: context.gameState, events: [] };
  }

  // Main logic here
}
```

## Data Flow

1. **UI/Bot** → sends Action → **Engine**
2. **Engine** → processes Action → returns GameResult  
3. If GameResult has pendingChoice → **UI/Bot** → sends ChoiceAnswer → **Engine**
4. Repeat until no pending choices
5. **UI** renders new state, **Bot** plans next action

This approach trades some flexibility for significant simplicity, making it much more achievable for an MVP while still supporting the full game mechanics.

## Error Handling Strategy

### Error Types and Handling

```typescript
// Error categories
type GameError = 
  | "IllegalAction"     // Action not allowed in current state
  | "InvalidChoice"     // Choice answer doesn't match choice constraints  
  | "CorruptState"      // Game state is internally inconsistent
  | "SerializationError" // Failed to save/load game state
  | "CardError"         // Card effect failed to execute properly

type ErrorResult = {
  error: GameError
  message: string
  details?: any
  recoverable: boolean
}
```

### Error Recovery Strategies

1. **Illegal Actions**: Return error, don't mutate state. UI disables invalid buttons.
2. **Invalid Choices**: Validate choice answers, return error with valid options.
3. **Corrupt State**: Detect with validation functions, attempt auto-repair or rollback.
4. **Serialization Errors**: Keep backup states, graceful degradation to memory-only.
5. **Card Errors**: Log error, skip effect, continue game (with event notification).

### Validation and Invariants

```typescript
// State validation functions
function validateGameState(state: GameData): ErrorResult | null
function validatePlayerState(player: PlayerData): ErrorResult | null
function validateCardCounts(state: GameData): ErrorResult | null

// Called after every state mutation
function checkInvariants(state: GameData): void
```

## State Serialization Format

### Serialization Structure

```typescript
type SaveGame = {
  version: "1.0.0"           // Schema version for migration
  timestamp: number          // When saved
  metadata: {
    players: string[]        // Player names
    gameId: string          // Unique game identifier
    turnCount: number       // Current turn number
  }
  gameState: {
    // Core game data
    currentPlayer: PlayerId
    phase: GameState
    rngSeed: number
    rngState: number        // RNG advancement counter
    
    // Player data (arrays indexed by PlayerId)
    hands: CardId[][]       // Each player's hand
    boards: PlayerBoard[]   // Each player's tableau
    scores: CardId[][]      // Each player's score pile
    achievements: number[]  // Which achievements each player has
    
    // Shared game state  
    decks: CardId[][]       // Supply piles by age
    availableAchievements: number[]  // Unclaimed achievements
    availableSpecialAchievements: string[]  // Unclaimed specials
    
    // Current turn state
    actionsRemaining: number
    pendingChoice?: Choice
    eventLog: Event[]       // Full game history
  }
}
```

### Serialization Methods

```typescript
// Save/load functions
function serializeGame(state: GameData): SaveGame
function deserializeGame(save: SaveGame): GameData | ErrorResult
function validateSaveGame(save: SaveGame): ErrorResult | null

// Compression for storage
function compressGameState(save: SaveGame): Uint8Array
function decompressGameState(data: Uint8Array): SaveGame | ErrorResult
```

### Migration Strategy

- **Version field** enables schema migration
- **Backup compatibility** - keep 1-2 previous versions supported
- **Graceful degradation** - missing fields get sensible defaults
- **Validation** - reject saves that can't be safely loaded

**Benefits:**
- Human-readable JSON for debugging
- Versioned for future compatibility  
- Complete game state capture for perfect replays
- Efficient compression for storage
- Error recovery with validation

## Testing Strategy

### Test Structure

```
/tests
  /unit            # Individual component tests
    /engine        # Engine core functionality
    /types         # Type validation and helpers
    /cards         # Card-specific logic
  /integration     # Cross-component workflows
  /golden          # Regression and determinism tests
```

### Test Categories

#### 1. Unit Tests (`/tests/unit/`)
- **Engine Core**: Game initialization, action processing, turn management
- **State Machine**: State transitions, validation, error handling  
- **RNG System**: Deterministic behavior, state management
- **Serialization**: Save/load, compression, migration
- **Event System**: Event emission, filtering, replay
- **Callback-Based Effects**: Individual effect function testing, state transitions, choice handling

#### 2. Integration Tests (`/tests/integration/`)
- **End-to-End Workflows**: Complete game sequences from init to win
- **Action Chains**: Multi-turn scenarios with state persistence
- **Serialize/Deserialize**: Round-trip state preservation
- **Error Recovery**: Invalid inputs, corrupt states, resilience

#### 3. Golden Tests (`/tests/golden/`)
- **Deterministic Replay**: Same seed + actions → identical events (Phase 2 DoD)
- **Scripted Games**: Fixed scenarios with expected final state hashes (Phase 2 DoD)
- **Regression Protection**: Detect unintended engine changes
- **State Consistency**: Validate invariants across game progression

### Testing Requirements by Phase

#### Phase 2 DoD (Definition of Done)
- ✅ **Basic Functionality**: Engine compiles and processes actions
- ✅ **Deterministic Replay**: `seed + [Action/ChoiceAnswer...]` reproduces identical Events  
- ✅ **Golden Test**: Scripted game reaches same final state hash reliably

#### Phase 3 DoD 
- **Card Effect Tests**: Representative Age 1 cards working end-to-end
- **Architecture Validation**: State machine handles different complexity levels
- **Choice/Answer Cycles**: Complex dogma effects with player choices

#### Phase 4 DoD (Comprehensive Testing)
- **90%+ Test Coverage**: All core engine paths tested
- **Property Tests**: Card conservation, icon cache consistency, RNG determinism
- **Fuzz Testing**: 1000+ random game sequences without crashes
- **Performance Baselines**: Action processing speed benchmarks

### Critical Testing Patterns and Lessons Learned

**⚠️ IMPORTANT**: These patterns emerged from implementing 65+ card effects across Ages 1-6. Following these will prevent common testing errors and improve test reliability.

#### A) Card Effect Test Structure

**Standard Pattern**: Every card effect test should follow this structure:

```typescript
describe('Card Name (ID X)', () => {
  it('should handle main effect path', () => {
    // 1. Setup game state with proper card placement and icon visibility
    let state = createGameWithMeldCard(cardId, player1);
    
    // 2. Setup specific conditions (icons, cards in zones, etc.)
    // Use comments to explain what each setup achieves
    
    // 3. Execute the effect
    const dogmaResult = processDogmaAction(state, cardId, player1);
    
    // 4. Assert the result type (AwaitingAction, AwaitingChoice)
    expect(dogmaResult.nextPhase).toBe('AwaitingAction');
    
    // 5. Assert the expected events occurred
    expect(dogmaResult.events).toContainEqual(
      expect.objectContaining({ type: 'dogma_activated' })
    );
    
    // 6. Assert specific game mechanics were applied
    // Focus on game-relevant outcomes, not implementation details
  });

  it('should handle edge case: no valid targets', () => {
    // Test with minimal setup to trigger edge case
  });

  it('should handle choice: player declines optional effect', () => {
    // Test choice-based effects with negative choices
  });
});
```

#### B) Icon Visibility Test Setup

**Critical Pattern**: Many card effects rely on icon counting, which depends on proper splaying.

```typescript
// ✅ GOOD - Explicit icon setup with comments
function setupFactoryIcons(state: any, playerId: PlayerId, targetCount: number) {
  // Ensure activating player has more Factory icons than target
  const factoryStack = state.players[playerId].colors.find(stack => stack.color === 'Purple');
  if (factoryStack && factoryStack.cards.length === 1) {
    factoryStack.cards.push(55); // Add Steam Engine (2 Factory icons)
    factoryStack.splayDirection = 'right'; // CRITICAL - makes icons visible
  }
  // Result: 2 visible Factory icons (Emancipation: 1, Steam Engine: 2, but only 2 visible due to splaying)
}

// ❌ BAD - Unclear icon setup
function setupIcons(state: any, playerId: PlayerId) {
  state.players[playerId].colors.push({ color: 'Red', cards: [62, 63] });
  // Missing: splayDirection, unclear which icons are visible
}
```

**Icon Setup Guidelines**:
- **Single card**: Only that card's icons are visible
- **Multiple cards, not splayed**: Only top card's icons visible
- **Multiple cards, splayed**: Lower cards' icons become visible
- **Test setup**: Always explicitly set `splayDirection` when you need icon visibility
- **Comments**: Explain expected icon counts after setup

#### C) Multi-Step Effect Testing

**Pattern**: Effects with choices need to test the complete flow.

```typescript
describe('Complex Card with Choices', () => {
  it('should complete full choice sequence', () => {
    let state = createGameWithMeldCard(cardId, player1);
    
    // Phase 1: Initial activation should offer choice
    const dogmaResult = processDogmaAction(state, cardId, player1);
    expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
    expect(dogmaResult.pendingChoice).toMatchObject({
      type: 'yes_no',
      prompt: expect.stringContaining('You may')
    });
    
    // Phase 2: Accept choice and continue
    const choiceResult = resumeDogmaExecution(dogmaResult.newState, {
      type: 'yes_no',
      answer: true
    });
    
    // Phase 3: Verify final state
    expect(choiceResult.nextPhase).toBe('AwaitingAction');
    expect(choiceResult.events).toContainEqual(
      expect.objectContaining({ type: 'drew' })
    );
  });
});
```

#### D) Demand Effect Testing

**Specific Pattern**: Demand effects need careful setup of icon disparities.

```typescript
describe('Demand Effect Card', () => {
  it('should execute demand when target has fewer icons', () => {
    let state = createGameWithMeldCard(demandCardId, player1);
    
    // Setup: Activating player has MORE icons
    setupDemandIcons(state, player1, 3); // Give 3 demand icons
    
    // Setup: Target player has FEWER icons  
    setupDemandIcons(state, player2, 1); // Give 1 demand icon
    
    // Setup: Target has cards to transfer
    state = addCardsToHand(state, player2, [1, 2]);
    
    const dogmaResult = processDogmaAction(state, demandCardId, player1);
    
    // Should offer choice to target player
    expect(dogmaResult.nextPhase).toBe('AwaitingChoice');
    expect(dogmaResult.pendingChoice?.playerId).toBe(player2);
  });

  it('should skip demand when no one affected', () => {
    let state = createGameWithMeldCard(demandCardId, player1);
    
    // Setup: All players have equal or more icons
    setupDemandIcons(state, player1, 2);
    setupDemandIcons(state, player2, 3); // More icons = not affected
    
    const dogmaResult = processDogmaAction(state, demandCardId, player1);
    
    // Should complete immediately without choice
    expect(dogmaResult.nextPhase).toBe('AwaitingAction');
  });
});
```

#### E) Test Data Organization

**Best Practice**: Use descriptive variables and comments for test data.

```typescript
// ✅ GOOD - Clear, documented test data
describe('Card with Age-Based Logic', () => {
  it('should find lowest age cards correctly', () => {
    let state = createGameWithMeldCard(cardId, player1);
    
    // Setup score pile with mixed ages - lowest should be age 1 cards
    const scoreCards = [
      1,  // Agriculture (Age 1) - should be returned
      16, // Calendar (Age 2)  
      17, // Canal Building (Age 2)
      3   // City States (Age 1) - should be returned
    ];
    state = addCardsToScore(state, player2, scoreCards);
    
    const dogmaResult = processDogmaAction(state, cardId, player1);
    
    // Should return both age 1 cards
    expect(dogmaResult.events).toContainEqual(
      expect.objectContaining({ type: 'returned', cardId: 1 }) // Agriculture
    );
    expect(dogmaResult.events).toContainEqual(
      expect.objectContaining({ type: 'returned', cardId: 3 }) // City States
    );
  });
});

// ❌ BAD - Unclear test data  
describe('Card with Age Logic', () => {
  it('should work', () => {
    let state = createGameWithMeldCard(65, 0);
    state = addCardsToScore(state, 1, [1, 2, 3, 4]);
    // What ages are these? Which should be returned?
  });
});
```

#### F) Event Assertion Best Practices

**Pattern**: Test events at the right level of detail.

```typescript
// ✅ GOOD - Test game-relevant event data
expect(dogmaResult.events).toContainEqual(
  expect.objectContaining({
    type: 'transferred',
    cardId: 1,
    toPlayer: player1,
    toZone: { zone: 'score', playerId: player1 }
  })
);

// ✅ GOOD - Count events when quantity matters
const drewEvents = dogmaResult.events.filter(e => e.type === 'drew');
expect(drewEvents).toHaveLength(2); // Expected 2 draws

// ❌ BAD - Too specific about internal structure
expect(dogmaResult.events).toContainEqual({
  type: 'transferred',
  cardId: 1,
  fromPlayer: { 
    id: 1, 
    hands: [...], 
    scores: [...] 
  }, // Testing implementation details
  timestamp: expect.any(Number),
  source: 'card_effect_handler'
});
```

#### G) Helper Function Testing Patterns

**Pattern**: Create reusable test helpers for common setups.

```typescript
// Test helpers for common patterns
function createDemandTestSetup(
  cardId: number, 
  activatingPlayer: PlayerId,
  targetPlayer: PlayerId,
  iconType: string,
  activatingIcons: number,
  targetIcons: number
) {
  let state = createGameWithMeldCard(cardId, activatingPlayer);
  
  // Setup icon disparity
  setupIcons(state, activatingPlayer, iconType, activatingIcons);
  setupIcons(state, targetPlayer, iconType, targetIcons);
  
  return state;
}

function expectTransferEvents(events: GameEvent[], expectedTransfers: Array<{cardId: number, fromPlayer: PlayerId, toPlayer: PlayerId}>) {
  for (const transfer of expectedTransfers) {
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'transferred',
        cardId: transfer.cardId,
        fromPlayer: transfer.fromPlayer,
        toPlayer: transfer.toPlayer
      })
    );
  }
}
```

#### H) Error State Testing

**Pattern**: Test error conditions and edge cases.

```typescript
describe('Card Effect Error Handling', () => {
  it('should handle empty zones gracefully', () => {
    let state = createGameWithMeldCard(cardId, player1);
    
    // Clear all relevant zones
    state.players[player1].hands = [];
    state.players[player1].scores = [];
    
    const dogmaResult = processDogmaAction(state, cardId, player1);
    
    // Should complete without errors
    expect(dogmaResult.nextPhase).toBe('AwaitingAction');
    expect(dogmaResult.events).toContainEqual(
      expect.objectContaining({ type: 'dogma_activated' })
    );
  });

  it('should validate choice answers', () => {
    let state = createGameWithMeldCard(cardId, player1);
    const dogmaResult = processDogmaAction(state, cardId, player1);
    
    // Test with invalid choice answer
    const invalidResult = resumeDogmaExecution(dogmaResult.newState, undefined);
    
    // Should handle gracefully (complete or maintain state)
    expect(['AwaitingAction', 'AwaitingChoice']).toContain(invalidResult.nextPhase);
  });
});
```

**Testing Principles Summary**:
1. **Setup First**: Establish clear game state before testing
2. **Document Intent**: Use comments to explain what setup achieves
3. **Test Outcomes**: Focus on game mechanics, not implementation
4. **Edge Cases**: Test empty zones, declined choices, invalid states
5. **Event Validation**: Assert event types and key data, avoid internal structure
6. **Helper Functions**: Reuse common setup patterns
7. **Multiple Phases**: Test complete choice sequences for complex effects

# 12. Validation & Errors

- All public validators return **error codes** (enums) plus fields for explanation. UI localizes.
- Illegal Action/Choice does not mutate state; return `{ errors: [...] }`.

# 13. UI Architecture & Component Design

## Phase 6: Svelte UI Implementation

### Component Architecture

The UI follows a **component-based architecture** that integrates seamlessly with the engine's stepper pattern:

```
src/ui/
├── App.svelte              # Main app container and game state management
├── components/
│   ├── GameBoard.svelte    # Main game area with player tableaus
│   ├── PlayerTableau.svelte # Individual player's cards, achievements, icons
│   ├── ActionBar.svelte    # Draw/Meld/Dogma/Achieve buttons from legalActions
│   ├── ChoicePrompt.svelte # Handle pending choices from stepper
│   ├── EventLog.svelte     # Scrolling event history with time travel
│   └── Card.svelte         # Individual card display with splay indicators
└── stores/
    └── gameStore.ts        # Minimal Svelte store for UI state only
```

### Stepper Pattern Integration

The UI integrates with the engine's stepper pattern through a **reactive state flow**:

1. **Action Phase**: UI shows `legalActions(state, currentPlayer)` as buttons
2. **Choice Phase**: If `pendingChoice` exists, UI shows `ChoicePrompt` component
3. **Resolution**: UI calls `processChoice()` until `pendingChoice` is null
4. **Update**: UI re-renders based on new game state and events

### State Management Principles

- **Single Source of Truth**: Game state comes entirely from the engine
- **UI State Only**: Svelte store contains only UI-specific data (selections, animations)
- **Reactive Updates**: UI automatically re-renders when engine state changes
- **No Drift**: UI state cannot diverge from engine state

### Component Responsibilities

#### `App.svelte`
- Manages game state and engine integration
- Handles the stepper loop (Action → Choice → Done)
- Coordinates between engine and child components
- Manages game initialization and cleanup

#### `GameBoard.svelte`
- Renders the main game area
- Manages player tableaus and game flow
- Handles game-wide interactions

#### `PlayerTableau.svelte`
- Displays individual player's cards, achievements, and icons
- Shows splay directions and card visibility
- Handles card interactions (clicking, hovering)

#### `ActionBar.svelte`
- Renders action buttons based on `legalActions(state, currentPlayer)`
- Disables invalid actions
- Triggers action processing through the stepper

#### `ChoicePrompt.svelte`
- Handles all choice types (yes_no, select_cards, select_pile, etc.)
- Uses `expandChoice()` to show valid options
- Highlights valid choices and prevents invalid selections

#### `EventLog.svelte`
- Displays game history as scrollable list
- Supports time travel (jump to specific event)
- Shows event details with human-readable messages

#### `Card.svelte`
- Renders individual cards with proper styling
- Shows splay indicators (left, right, up)
- Displays card information (name, age, color, icons)

### Visual Design Principles

- **Card-Game Style**: Clean, colorful design appropriate for Innovation
- **Splay Indicators**: Clear visual representation of card splaying
- **Icon Visibility**: Icons are only shown when visible due to splaying
- **Responsive Layout**: Works on different screen sizes
- **Accessibility**: Proper contrast, keyboard navigation, screen reader support

### Testing Strategy

- **Component Unit Tests**: Test individual component behavior
- **Integration Tests**: Test complete user workflows
- **Stepper Integration Tests**: Verify choice handling works correctly
- **Visual Consistency**: Ensure UI matches game state accurately
- **Performance Tests**: Verify smooth 60fps rendering

### Future Enhancements

- **Animations**: Smooth transitions between game states
- **Sound Effects**: Audio feedback for actions and choices
- **Themes**: Multiple visual themes for different preferences
- **Mobile Support**: Touch-friendly interface for mobile devices
 
## Summary: Critical Lessons from 65+ Card Implementation

**🎯 Executive Summary**: After implementing 65+ card effects across Ages 1-6, these are the most important patterns and pitfalls that will save significant development time.

### Top 5 Implementation Gotchas

1. **'continue' vs 'complete' Confusion**: 
   - **Problem**: Using `type: 'continue'` causes premature `AwaitingAction` state
   - **Solution**: Execute logic immediately within choice steps when possible
   - **When to use continue**: Only when genuinely need to pause and transition steps

2. **Icon Visibility Requirements**:
   - **Problem**: `countIcons()` returns 0 when stacks aren't splayed properly
   - **Solution**: Always set `splayDirection: 'right'` in test setup when expecting icons
   - **Rule**: Single cards = top icons only, splayed stacks = lower icons visible

3. **Zone-Specific Primitives**:
   - **Problem**: Using `returnCard()` for score pile returns (expects hand)
   - **Solution**: Know your primitives - `returnCard()` (hand→supply), `transferCard()` (any→any)
   - **Custom needed**: Score→supply, board→score operations

4. **Demand Effect Icon Setup**:
   - **Problem**: Both players have same icon count, demand doesn't trigger
   - **Solution**: Activating player must have MORE demand icons, targets must have FEWER
   - **Test pattern**: Always set up icon disparity explicitly

5. **Test Event Specificity**:
   - **Problem**: Testing internal event structure breaks when implementation changes
   - **Solution**: Test event type and key data only, use `expect.objectContaining()`
   - **Focus**: Game-relevant outcomes, not implementation details

### Top 5 Testing Patterns

1. **Standard Test Structure**: Setup → Execute → Assert phase + events + mechanics
2. **Icon Setup Comments**: Always document expected icon counts after splaying
3. **Multi-Step Testing**: Test complete choice sequences for complex effects
4. **Edge Case Coverage**: Empty zones, declined choices, no valid targets
5. **Helper Functions**: Reuse common setup patterns (demand, icons, cards)

### Architectural Success Patterns

1. **Simplified Effects**: Use `createSimpleEffect()` for straightforward cards
2. **State Machine**: Use explicit steps only when pausing execution is needed
3. **Registry System**: Centralized initial state mapping in `dogma-resolver.ts`
4. **Event Emission**: Automatic `dogma_activated` events in simplified effects
5. **File Organization**: Age-specific files for maintainability

### Code Quality Wins

1. **Comprehensive Testing**: 34 tests for Age 6 cards, 100% pass rate
2. **Clear Error Messages**: Specific validation with helpful error text
3. **Database-Driven**: Always use `CARDS.cardsById.get()` instead of hardcoding
4. **Edge Case Handling**: Graceful degradation for empty zones, invalid choices
5. **Documentation**: Comments explaining complex setup and expected outcomes

### Performance and Maintainability

1. **Parallel Tool Calls**: Implementing multiple cards simultaneously improved velocity
2. **TDD Workflow**: Write tests first, implement to pass, refactor for clarity
3. **Incremental Commits**: One card per commit with comprehensive commit messages
4. **Modular Architecture**: Age-specific files, centralized registry, reusable primitives
5. **Technical Debt Management**: Immediate fixes for structural issues vs feature additions

**Final Takeaway**: The callback-based state machine with simplified effects proved highly successful. Of 65 implemented cards, 62 use simple effects (95%), only 3 need complex state machines. This validates the architectural approach and suggests most Innovation cards can be implemented straightforwardly once the patterns are established.
