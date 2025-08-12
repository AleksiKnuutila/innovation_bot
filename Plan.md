Here's a cleaned-up plan that uses a **simplified state machine** architecture instead of complex effect queues.

**Note**: Throughout implementation, use the vb-implementation directory as a behavioral reference for card effects and rule implementations. The VB code has working implementations of all card effects and e

# ✅ Phase 0 — Repo & Workspace (COMPLETED)

* ✅ Create single TypeScript package with clear module structure
  `/src/engine`, `/src/ui`, `/src/bot`, `/src/types`, `/src/cards`
* ✅ Enable TypeScript strict, ESLint, Prettier
* ✅ Add Vitest for testing + coverage
* ✅ Simple build setup with Vite

# ✅ Phase 0.5 — Card Database Preparation (COMPLETED)

* ✅ **Extract card database from VB implementation**:
  * ✅ Convert VB card metadata to TypeScript/JSON format (35 cards Ages 1-3)
  * ✅ Include basic info: name, age, color, icons, dogma text
  * ✅ Focus on Ages 1-3 for MVP scope
* ✅ **Select representative test cards**:
  * ✅ Choose 3 Age 1 cards with different complexity levels
  * ✅ Simple: Writing (basic draw)
  * ✅ Medium: Code of Laws (conditional + choice)
  * ✅ Complex: Oars (demand with fallback)
* ✅ **Reference implementation patterns**:
  * ✅ Created card types with helper functions
  * ✅ Structured for easy VB reference lookup

**DoD Phase 0.5** ✅
* ✅ Card database ready for Ages 1-3 (35 cards)
* ✅ Test cards selected for architecture validation

# ✅ Phase 1 — Core Types & State Machine (COMPLETED)

* ✅ Define IDs: `PlayerID`, `CardID`, `Color`, `Icon` with strict typing
* ✅ Define **Actions**: `Draw`, `Meld`, `Dogma`, `Achieve` with parameters
* ✅ Define **GameState** enum: `AwaitingAction`, `ResolvingDogma`, `AwaitingChoice`, `CheckingWinConditions`, `GameOver`
* ✅ Define **Choices** & **ChoiceAnswer**: `SelectCards`, `SelectPile`, `OrderCards`, `YesNo`, `SelectPlayer`
* ✅ Define **Events**: Complete event system with 14 event types for replay
* ✅ Define core **GameData** structure with RNG state, caching, and validation

# ✅ Phase 2 — Engine Core (state machine) (COMPLETED)

* ✅ Implement seeded RNG (xoshiro/PCG) stored in `GameData`
* ✅ Model `GameData` with simple arrays and direct calculations (cache system removed for simplicity)
* ✅ Turn/legality: 2 actions/turn, action validity, achievement thresholds
* ✅ **State Machine API:**

  * ✅ `processAction(state, action) → GameResult`
  * ✅ `processChoice(state, answer) → GameResult` 
  * ✅ `getLegalActions(state, player)`, `expandChoice(choice)`
  * ✅ `GameResult` has `newState`, `events`, `nextPhase`, `pendingChoice?`
* ✅ Simple serializer: `JSON.stringify/parse` initially
* ✅ Every mutation emits Events for UI/debugging
* ✅ **DoD Testing Requirements:**
  * ✅ Test compilation and basic functionality
  * ✅ Deterministic replay: `seed + [Action/ChoiceAnswer...]` reproduces identical Events
  * ✅ Golden test: scripted game reaches same final state hash reliably

**DoD Phase 2** ✅ COMPLETE

* ✅ Engine core fully implemented with correct Innovation rules
* ✅ All 67 tests passing (100% success rate)
* ✅ DoD Requirements validated:
  * ✅ Basic functionality tests (8/8 passing)
  * ✅ Deterministic replay tests (3/3 passing) 
  * ✅ Golden tests (3/3 passing)
* ✅ Cache system removed for simpler architecture - direct calculations sufficient
* ✅ Starting player correctly gets 1 action, then 2 actions for all subsequent turns
* ✅ All integration, error handling, serialization, RNG, and event system tests passing

# ⏳ Phase 3 — Card Effects & Architecture Validation (COMPLETED ✅)

* ✅ Implement **callback-based state machine pattern** for card effects:
  * ✅ Each card effect is a pure function that can be called multiple times
  * ✅ Function returns `EffectResult` with `continue`, `need_choice`, or `complete`
  * ✅ Effect state is serializable and stored in game state
  * ✅ Engine calls effect function until it returns 'complete'
* ✅ Build **effect registry system**:
  * ✅ String identifiers (e.g., 'oars', 'codeOfLaws') map to effect functions
  * ✅ Effect state stored in game state for resumption
  * ✅ No complex continuation-passing or async/await
* ✅ **Implement 2-3 representative Age 1 cards** for architecture validation:
  * ✅ Start with simple card (e.g., Writing - no choices needed)
  * ✅ Add medium complexity card (e.g., Code of Laws - single choice)
  * ✅ Add complex card (e.g., Oars - multiple choices and loops)
  * ✅ Validate that callback pattern handles all card types correctly
* ✅ **Reference implementation guidance**:
  * ✅ Use vb-implementation card handlers as behavioral reference
  * ✅ Check Functions.vb for card effect implementations and edge cases
  * ✅ Adapt logic patterns to new callback-based architecture
* ✅ Ensure Events include `source` (card/rule) for explainability
* ✅ **Phase 3 Testing Requirements:**
  * ✅ Unit tests for each card effect (isolated behavior validation)
  * ✅ Test effect resumption and state persistence
  * ✅ Test choice generation and resolution for complex cards
  * ✅ Test icon counting and symbol comparison logic
  * ✅ Integration tests for complete dogma resolution chains
  * ✅ Golden tests for each implemented card's behavior
  * ✅ Test error handling for invalid card states/actions
  * ✅ **Test callback-based effect state transitions and resumption**
  * ✅ **Validate effect registry and routing system**

**DoD Phase 3** ✅ **COMPLETE**

* ✅ Representative cards working end-to-end (action → choice → resolution)
* ✅ Callback-based architecture validated with different complexity levels
* ✅ Cards produce standardized Choices (UI renders without special-casing)
* ✅ Effect state properly serialized and resumable
* ✅ Logs human-readable via message keys + params
* ✅ **All card effects have comprehensive unit tests (90%+ coverage)**
* ✅ **Integration tests validate multi-card interactions**
* ✅ **Golden tests prevent regression in card behavior**

# ⏳ Phase 3b — Complete Innovation Rules Implementation (NEW)

* **Special Achievements System**:
  * ✅ **Monument**: Auto-claim when tucking 6+ cards OR scoring 6+ cards in single turn
  * ✅ **Empire**: Auto-claim when having 3+ icons of all 6 basic icon types
  * ✅ **World**: Auto-claim when having 12+ icons on board
  * ✅ **Wonder**: Auto-claim when having 5 colors, each splayed up or right
  * ✅ **Universe**: Auto-claim when having 5 top cards, each of value 8+
  * ✅ **Auto-claiming logic**: Claim immediately when conditions met (mid-effect, other players' turns)
  * ✅ **Tie-breaking**: Current player wins when multiple players qualify simultaneously
* **Splaying System**:
  * ✅ **Splay mechanics**: Left (1 icon), Right (2 icons), Up (3 icons)
  * ✅ **Splay validation**: Can't splay with <2 cards, direction affects icon visibility
  * ✅ **Splay effects**: Implement all "splay X color left/right/up" card effects
  * ✅ **Icon visibility**: Only visible icons count for sharing/demands
* **Icon Counting & Visibility**:
  * ✅ **Actual icon counting**: Replace placeholder with real card data analysis
  * ✅ **Icon positions**: Top, Left, Middle, Right positions matter for splaying
  * ✅ **Icon types**: Leaf, Bulbs, Crown, Castle, Factory, Clock
  * ✅ **Splay-based visibility**: Icons only count if visible due to splaying
* **Advanced Dogma Effects**:
  * ✅ **Effect ordering**: Must execute effects in written order (already working)
  * ✅ **"Do all you can, ignore the rest"**: Graceful degradation when effects can't be fully applied
  * ✅ **Card-specific edge cases**: Implement specific FAQ clarifications for complex cards
* **Game Flow & Turn Structure**:
  * ✅ **First turn rules**: First player(s) get only 1 action instead of 2
  * **Action validation**: Proper checking of legal actions before execution
  * **Turn advancement**: Proper turn switching and action counting
* **Card-Specific Mechanics**:
  * ✅ **Return mechanics**: Cards returned to bottom of supply piles
  * ✅ **Exchange mechanics**: Swapping cards between zones
  * ✅ **Transfer mechanics**: Moving cards between players/zones
  * ✅ **Tuck mechanics**: Placing cards at bottom of color stacks
  * ✅ **Reveal mechanics**: Showing cards without drawing them
* **Advanced Game Rules**:
  * ✅ **Age 10+ handling**: Game ends when trying to draw non-existent cards
* **Victory Condition Checking**:
  * ✅ **Real-time checking**: Check for victory conditions after every state change
  * ✅ **Multiple victory paths**: Achievements, score, card effects
  * ✅ **Tie-breaking**: Proper handling of tied victory conditions
  * ✅ **Age 10+ victory**: Game ends when trying to draw age 11+ cards
* **Error Handling & Edge Cases**:
  * ✅ **Graceful degradation**: When effects can't be fully applied
  * **Invalid state handling**: Proper error messages for impossible actions
  * **Game state validation**: Ensuring game state remains consistent

**Phase 3b Testing Requirements**:
* ✅ **Special Achievement Tests**:
  * Test each special achievement condition detection
  * Test auto-claiming during dogma effects
  * Test tie-breaking when multiple players qualify
  * Test achievement availability after claiming
* ✅ **Splaying System Tests**:
  * Test all splay directions (left, right, up)
  * Test splay validation (minimum cards, direction changes)
  * Test icon visibility after splaying
  * Test splay effects from card dogma
* ✅ **Icon Counting Tests**:
  * Test icon counting with different splay directions
  * Test icon visibility rules (only visible icons count)
  * Test icon-based sharing and demand mechanics
  * Test edge cases (no icons, all icons, etc.)
* ✅ **Advanced Dogma Tests**:
  * ✅ **Effect ordering within cards** (already working)
  * ✅ **Graceful degradation when effects can't be fully applied**
* ✅ **Game Flow Tests**:
  * Test first turn rules (1 action instead of 2)
  * Test turn advancement and action counting
  * Test action validation and error handling
* ✅ **Victory Condition Tests**:
  * Test achievement victory (6 achievements)
  * Test score-based victory (age 11+ draw attempt)
  * Test card-based victory conditions
  * Test tie-breaking scenarios
* ✅ **Integration Tests**:
  * Test complete games with all mechanics working
  * Test complex card interactions across multiple ages
  * Test edge cases and error conditions

**DoD Phase 3b**:
* ✅ **All 5 special achievements implemented and auto-claiming**
* ✅ **Complete splaying system with all directions and validation**
* ✅ **Real icon counting based on card data and splay visibility**
* ✅ **Multiple dogma levels and proper effect ordering**
* ✅ **First turn rules and proper turn structure**
* ✅ **All card mechanics (return, exchange, transfer, tuck, reveal)**
* ✅ **Complete victory condition checking (achievements, score, cards)**
* ✅ **Comprehensive error handling and graceful degradation**
* ✅ **90%+ test coverage on all new rule implementations**
* ✅ **Integration tests validate complete game flows**
* ✅ **Golden tests prevent regression in rule behavior**
* ✅ **Performance tests show rules don't significantly impact game speed**

# ✅ Phase 4 — Comprehensive Testing & Validation (COMPLETED)

* **Property Tests** (automated invariant checking - HIGH PRIORITY):
  * Card conservation (deck+hands+board+score constant)
  * Unique achievements (no duplicates claimed)
  * Turn counter correctness
  * RNG determinism (same seed → same results)
  * Game state consistency (no invalid states reachable)
  * Action legality (all actions produced are valid)

**DoD Phase 4** ✅ **COMPLETE**

* Property tests passing consistently (HIGH PRIORITY)
* Core game invariants validated automatically
* Engine stability verified through invariant checking

# ✅ Phase 5 — Simple Random Bot (Before UI) (COMPLETED)

* **Bot Architecture**:
  * ✅ Create `/src/bot/` directory with extensible bot framework
  * ✅ Implement `RandomBot` class with stateless decision-making
  * ✅ Design shared bot interface for easy bot swapping
  * ✅ Bot follows stepper pattern: Action → Choice → Choice → Done
* **Core Bot Implementation**:
  * ✅ `decideAction(gameState, playerId)` - randomly selects from legal actions
  * ✅ `decideChoice(gameState, choice)` - randomly selects from valid choices
  * ✅ Uses game's seeded RNG for deterministic behavior
  * ✅ Handles all choice types (yes_no, select_cards, select_pile, etc.)
* **Bot Testing Infrastructure**:
  * ✅ Unit tests for bot decision logic and choice handling
  * ✅ Integration tests for bot vs bot games (1000+ games)
  * ✅ Performance tests (response time under 200ms)
  * ✅ Test bot produces valid moves in 100% of scenarios
* **Bot Integration & Validation**:
  * ✅ Ensure bot follows stepper pattern correctly
  * ✅ Validate bot produces only legal actions/choices
  * ✅ Test bot against existing game engine tests
  * ✅ Add bot-specific error handling and logging

**DoD Phase 5** ✅ **COMPLETE**

* ✅ Bot can play complete games against itself
* ✅ Bot produces valid moves in 100% of test scenarios
* ✅ Bot algorithms have comprehensive unit test coverage
* ✅ Bot response time under 200ms for typical game states
* ✅ Bot vs bot games run successfully (1000+ games)
* ✅ Bot handles all choice types and edge cases correctly
* ✅ Bot uses seeded RNG for deterministic behavior
* ✅ All existing tests still pass with bot integration

# Phase 6 — UI (Svelte or vanilla)

* Render:

  * Tableaus with splay indicators, hands, scores, icon tallies
  * Action bar from `legalActions(state, you)`
  * **Choice prompt** driven by stepper:
    * Call `startAction(...)` → if `NeedChoice`, show prompt
    * On click, call `resumeWithAnswer(...)` until `Done`
  * Event log (scrolling list)
  * When choosing eg. cards, highlight the valid options in the UI
* Keep state local or a tiny Svelte store; no extra libs
* **Phase 6 Testing Requirements:**
  * Component unit tests (render correctness, event handling)
  * Integration tests for user interaction flows (draw → meld → dogma)
  * Test error states and loading states in UI

**DoD Phase 6**
* **UI components have 50%+ test coverage**
* **Integration tests cover complete user workflows**

# Phase 7 — Advanced Bot

* `/bot/worker.ts`:

  * Receives `{ state, player }`
  * Calls `legalActions(state, p)` to pick an Action
  * Drives the stepper loop: if `NeedChoice`, enumerate answers (via `choices/expand`) and respond until `Done`
* UI spawns worker with `new Worker(new URL('../bot/worker.ts', import.meta.url))`
* Start with simple heuristics; upgrade later
* **Phase 7 Testing Requirements:**
  * Unit tests for bot decision-making algorithms
  * Integration tests for bot vs bot games (automated tournaments)
  * Performance tests for bot response time under different game states
  * Test bot behavior with complex choice scenarios
  * Test Web Worker communication and error handling
  * Validate bot produces only legal actions
  * Test bot against human players for balanced gameplay

**DoD Phase 7**

* **Bot algorithms have comprehensive unit test coverage**
* **Automated bot tournaments run successfully (1000+ games)**
* **Bot response time under 200ms for typical game states**
* **Bot produces valid moves in 100% of test scenarios**

# Phase 8 — Replay, Dev UX, and Sim

* `replay(seed, inputs)` that feeds the **stepper** to reproduce games
* Time-travel in UI (`eventIndex` slider using stored Events)
* `/sim`: headless runner to batch playouts for perf/testing
* **Phase 8 Testing Requirements:**
  * Unit tests for replay system (deterministic reproduction)
  * Test time-travel functionality (forward/backward navigation)
  * Integration tests for headless simulation runner
  * Performance tests for large-scale batch simulations
  * Test replay compatibility across different engine versions
  * Test replay system with corrupted/incomplete data
  * Validate replay events match original game exactly

**DoD Phase 8**

* **Replay system reproduces games with 100% fidelity**
* **Time-travel UI tested for all game states and transitions**
* **Simulation runner handles 10,000+ game batches reliably**
* **Replay compatibility maintained across engine versions**

# Phase 9 — Content & Editions

* Card registry with stable `cardKey`, edition availability (3E/4E), metadata
* Edition flags in rules; centralize differences (e.g., Age 11, aslant splay)
* Incrementally add core deck (Age 1→10) with targeted tests
* **Phase 9 Testing Requirements:**
  * Unit tests for each new card added (Ages 4-10)
  * Integration tests for card interactions across different ages
  * Test edition-specific rules and card behaviors
  * Golden tests for complex multi-card interactions
  * Test card database integrity and metadata consistency
  * Performance tests with full deck (105 cards)
  * Test edition switching doesn't break existing functionality

**DoD Phase 9**

* **All 105 cards have individual unit tests**
* **Edition toggle works; shared tests pass under both where applicable**
* **Cross-age card interactions tested comprehensively**
* **Card database maintains 100% data integrity**

# Phase 10 — Performance Pass (optional after MVP)

* Profile hotspots in runner, choice expansion, legality checks
* Add `stepMany(inputs[])` for batched bot sims
* Consider internal in-place mutation with immutable public returns
* Memoize `legalActions`/choice expansions until state changes
* **Phase 10 Testing Requirements:**
  * Benchmark tests for all performance-critical operations
  * Memory leak detection in long-running simulations
  * Load testing with concurrent bot matches
  * Regression testing to ensure optimizations don't break functionality
  * Test performance improvements meet target metrics
  * Validate memoization correctness and cache invalidation
  * Test batched operations maintain deterministic results

**DoD Phase 10**

* **Performance benchmarks show measurable improvements**
* **Memory usage remains stable in 24+ hour simulations**
* **All existing tests pass after performance optimizations**
* **Target performance metrics achieved (e.g., 1000+ games/second)**


Phase 11: Final tests?
  * Golden Tests (regression protection):
    * Record complete game scenarios as expected outputs
    * Scripted games with known card interactions
    * Serialize/deserialize round-trip testing
  * Fuzz Testing (stability):
    * Random valid action sequences
    * Invalid input handling
    * Edge case discovery