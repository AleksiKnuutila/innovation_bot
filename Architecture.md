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

Handle card effects through direct state manipulation rather than effect primitives:

```typescript
// Card handler signature
type DogmaHandler = (state: GameData, context: DogmaContext) => DogmaResult

type DogmaResult = {
  stateChanges: StateChange[]
  events: Event[]  
  pendingChoice?: Choice  // If player input needed
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