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

### 2. Avoid Unnecessary Step Branches
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

### 3. Use Helper Functions Extensively
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

### 4. Keep Effects Brief
Target 20-40 lines per card effect. If longer, break into helper functions.

### 5. Use Descriptive Step Names
Step names should clearly indicate what the step does.

```typescript
// ✅ Good step names
step: 'check_sharing_eligibility' | 'offer_optional_splay' | 'execute_demand'

// ❌ Poor step names  
step: 'step1' | 'step2' | 'processing' | 'handle_stuff'
```

### 6. Handle Edge Cases Early
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

### Test Execution

```bash
# Run all tests
npm test

# Run specific categories
npm run test:unit
npm run test:integration  
npm run test:golden

# Coverage reporting
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Testing Principles

1. **Determinism First**: Every test must be reproducible with fixed seeds
2. **State Validation**: Check game invariants after every major operation
3. **Fail Fast**: Tests should detect regressions immediately
4. **Documentation**: Tests serve as executable specifications
5. **Performance Aware**: Monitor test execution time, flag regressions

### Testing Callback-Based Effects

The callback-based pattern makes testing card effects much easier. Each step can be tested independently:

```typescript
describe('Code of Laws Effect', () => {
  it('should complete immediately if player lacks highest crown count', () => {
    const context = createTestContext();
    const state = { step: 'check_condition' as const };

    const result = codeOfLawsEffect(context, state);

    expect(result.type).toBe('complete');
    expect(result.events).toHaveLength(0);
  });

  it('should offer choice if player has highest crown count', () => {
    const context = createTestContextWithHighestCrown();
    const state = { step: 'check_condition' as const };

    const result = codeOfLawsEffect(context, state);

    expect(result.type).toBe('need_choice');
    expect(result.choice.type).toBe('yes_no');
  });

  it('should tuck cards when player chooses yes', () => {
    const context = createTestContext();
    const state = { step: 'waiting_choice' as const };
    const choiceAnswer = createYesNoAnswer('test', 0, true);

    const result = codeOfLawsEffect(context, state, choiceAnswer);

    expect(result.type).toBe('complete');
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'tucked' })
    );
  });

  it('should handle effect state transitions correctly', () => {
    const context = createTestContextWithHighestCrown();
    const state = { step: 'check_condition' as const };

    // First call should request choice
    const choiceResult = codeOfLawsEffect(context, state);
    expect(choiceResult.type).toBe('need_choice');
    expect(choiceResult.nextState.step).toBe('waiting_choice');

    // Second call with choice should complete
    const choiceAnswer = createYesNoAnswer('test', 0, true);
    const completeResult = codeOfLawsEffect(context, choiceResult.nextState, choiceAnswer);
    expect(completeResult.type).toBe('complete');
  });
});
```

**Key Testing Benefits:**

1. **Step Isolation**: Each step can be tested independently
2. **State Validation**: Verify that `nextState` transitions correctly
3. **Choice Handling**: Test both with and without choice answers
4. **Edge Cases**: Easy to test different game states and conditions
5. **Regression Prevention**: State transitions are explicit and testable